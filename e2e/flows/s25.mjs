// Notification settings (bell, desktop pop-ups, email frequency and kinds) and the
// emails they lead to: one per event, the hourly digest, a link that opens the card.
import fs from 'node:fs'
import { API, APP, MAIL, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const OWNER = { email: `notify-owner-${stamp}@example.com`, password: 'Password123!', name: 'Olena Owner' }
const ME = { email: `notify-me-${stamp}@example.com`, password: 'Password123!', name: 'Max Member' }
const owner = await createVerifiedUser(OWNER, 'PM')
const me = await createVerifiedUser(ME, 'Dev')
await me.call('PATCH', '/auth/settings', { language: 'en' })
const board = await owner.call('POST', '/board/boards', { name: 'Launch plan' })
const todo = await owner.call('POST', `/board/boards/${board._id}/columns`, { title: 'To do', position: 0 })
await owner.call('POST', `/board/boards/${board._id}/columns`, { title: 'Doing', position: 1 })
const invite = await owner.call('POST', `/board/boards/${board._id}/invites`, { role: 'member' })
await me.call('POST', `/board/invites/${invite.inviteUrl.split('/').pop()}/accept`)

const mails = () => fs.readFileSync(MAIL, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)).filter((mail) => mail.to === ME.email)
const waitForMail = async (count, timeout = 6000) => {
	const until = Date.now() + timeout
	while (Date.now() < until && mails().length < count) await new Promise((resolve) => setTimeout(resolve, 200))
	return mails()
}

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await ctx.grantPermissions(['notifications'], { origin: APP })
// Record desktop notifications instead of showing them, and act as a background tab.
await ctx.addInitScript(() => {
	window.__shown = []
	const Real = window.Notification
	class Recorded {
		constructor(title, options) { window.__shown.push({ title, body: options?.body }); this.close = () => {} }
		static get permission() { return Real.permission }
		static requestPermission() { return Real.requestPermission() }
	}
	window.Notification = Recorded
	document.hasFocus = () => !window.__background
})
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/settings#notifications`); await page.waitForSelector('.st-frequency')

// The settings.
check('email is instant by default', await page.getByRole('radio', { name: /Instantly/ }).isChecked())
check('every kind is picked, with select all', (await page.locator('.st-pref input:checked').count()) === 6)
check('it says what always emails', (await page.locator('.st-prefs-always').innerText()).includes('added to a card'))
check('desktop notifications can be switched on here', await page.getByRole('switch', { name: /Desktop notifications/ }).count() === 1 || (await page.locator('.st-desktop input[type=checkbox]').count()) === 1)

await page.locator('[data-pref=comments]').uncheck()
await page.waitForTimeout(500)
let user = await me.call('GET', '/auth/get-user')
check('a kind can be turned off', user.emailPreferences.comments === false && user.emailPreferences.dueDates === true)
check('select all shows a partial choice', await page.locator('.st-pref--all input').evaluate((input) => input.indeterminate))
await page.locator('.st-pref--all input').check()
await page.waitForTimeout(500)
user = await me.call('GET', '/auth/get-user')
check('select all turns everything back on', Object.values(user.emailPreferences).every(Boolean))

await page.getByText('Never', { exact: true }).click()
await page.waitForTimeout(400)
check('never hides the kinds and says why', (await page.locator('.st-prefs').count()) === 0 && (await page.locator('.st-prefs-off').isVisible()))
check('never is saved', (await me.call('GET', '/auth/get-user')).emailFrequency === 'never')
await page.reload(); await page.waitForSelector('.st-frequency')
check('the choice survives a reload', await page.getByRole('radio', { name: /Never/ }).isChecked())

// Signing out and back in (no reload) still shows what the account chose.
await page.locator('.app-account-trigger').click()
await page.getByRole('menuitem', { name: /log ?out|sign out/i }).click()
await page.waitForURL(/\/login|\/$/)
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.locator('.app-account-trigger').click()
await page.getByRole('menuitem', { name: 'Settings' }).click()
await page.waitForSelector('.st-frequency')
await page.evaluate(() => document.getElementById('notifications').scrollIntoView())
check('after signing in again, Never is still chosen', await page.getByRole('radio', { name: /Never/ }).isChecked())
check('…and the email kinds still say email is off', await page.locator('.st-prefs-off').isVisible())

// Never: no email; the bell still rings, and a desktop notification shows in the background.
await page.evaluate(() => { window.__background = true })
const before = mails().length
const first = await owner.call('POST', `/board/columns/${todo._id}/task`, { title: 'Write release notes', assignees: [user._id] })
await page.waitForTimeout(1500)
check('never sends no email', mails().length === before)
const shown = await page.evaluate(() => window.__shown)
check('a desktop notification shows while in the background', shown.some((item) => item.title === 'Assigned to you' && item.body.includes('Write release notes')), JSON.stringify(shown))
await page.locator('.st-desktop input[type=checkbox]').uncheck()
await page.waitForTimeout(500)
check('the desktop switch is saved to the account', (await me.call('GET', '/auth/get-user')).desktopNotifications === false)
await owner.call('POST', `/board/columns/${todo._id}/task`, { title: 'Quiet card', assignees: [user._id] })
await page.waitForTimeout(1200)
check('desktop notifications can be turned off for the account', !(await page.evaluate(() => window.__shown)).some((item) => item.body?.includes('Quiet card')))
// Another browser of the same account sees it off too (after allowing notifications there).
const second = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await second.grantPermissions(['notifications'], { origin: APP })
const secondPage = await second.newPage(); watch(secondPage, 'second')
await secondPage.goto(`${APP}/login`); await uiLogin(secondPage, ME.email, ME.password); await secondPage.waitForURL(/\/workspaces/)
await secondPage.goto(`${APP}/settings#notifications`); await secondPage.waitForSelector('.st-desktop')
check('another browser shows the account’s desktop choice', !(await secondPage.locator('.st-desktop input[type=checkbox]').isChecked()))
await second.close()
await page.locator('.st-desktop input[type=checkbox]').check()
await page.waitForTimeout(500)
await page.evaluate(() => { window.__background = false })

// Instantly: one email per event, with a link that opens the card.
await page.getByText('Instantly', { exact: true }).click()
await page.waitForTimeout(500)
await owner.call('PATCH', `/board/tasks/${first._id}`, { dueDate: '2031-03-14' })
let inbox = await waitForMail(before + 1)
const dueMail = inbox.at(-1)
check('instantly emails the due date change', dueMail && /“Write release notes” is now due/.test(dueMail.subject), dueMail?.subject)
const link = dueMail.text.match(/https?:\/\/\S+\?task=\S+/)?.[0]
check('the email links to the card', Boolean(link), dueMail.text)
await page.goto(link); await page.waitForSelector('.cm-modal', { timeout: 8000 }).catch(() => {})
check('the link opens the card', (await page.locator('.cm-modal').count()) === 1)
await page.keyboard.press('Escape')

// Hourly summary: nothing at once, then one email with everything, in the reader's language.
await page.goto(`${APP}/settings#notifications`); await page.waitForSelector('.st-frequency')
await page.getByText('Hourly summary', { exact: true }).click()
await page.waitForTimeout(500)
await me.call('PATCH', '/auth/settings', { language: 'ru' })
const beforeDigest = mails().length
await owner.call('POST', `/board/tasks/${first._id}/comments`, { message: 'Can you add the screenshots?' })
await owner.call('POST', `/board/columns/${todo._id}/task`, { title: 'Pricing page', assignees: [user._id] })
await page.waitForTimeout(1200)
check('the hourly summary sends nothing at once', mails().length === beforeDigest)
await fetch(`${API}/dev/run-email-jobs`, { method: 'POST', headers: { origin: APP } })
inbox = await waitForMail(beforeDigest + 1)
const digest = inbox.at(-1)
check('one digest arrives with both updates', digest && /2 обновления на ваших досках/.test(digest.subject), digest?.subject)
check('the digest has the comment and the card', digest.text.includes('Can you add the screenshots?') && digest.text.includes('Pricing page'))
fs.copyFileSync(digest.html, new URL('../.tmp/last-digest.html', import.meta.url))
fs.copyFileSync(dueMail.html, new URL('../.tmp/last-activity.html', import.meta.url))

// Phone layout.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })
const phonePage = await phone.newPage(); watch(phonePage, 'phone')
await phonePage.goto(`${APP}/settings#notifications`); await phonePage.waitForSelector('.st-frequency')
check('the notification settings fit a phone', await phonePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
// Toasts on a phone drop in under the top bar and keep clear of the bottom bar.
await phonePage.locator('.st-frequency .ui-radio-card').nth(2).click()
await phonePage.waitForSelector('[data-sonner-toast]')
await phonePage.waitForTimeout(500)
const toast = await phonePage.locator('[data-sonner-toast]').first().boundingBox()
const topBar = await phonePage.locator('.app-topbar').boundingBox()
const bottomBar = await phonePage.locator('.app-bottom-nav').boundingBox()
check('a phone toast sits under the top bar', toast.y >= topBar.y + topBar.height - 1, `${toast.y} vs ${topBar.y + topBar.height}`)
check('a phone toast never covers the bottom bar', toast.y + toast.height < bottomBar.y, `${toast.y + toast.height} vs ${bottomBar.y}`)
const iconOffset = await phonePage.locator('[data-sonner-toast] [data-icon]').first().evaluate((tile) => {
	const a = tile.getBoundingClientRect(), b = tile.querySelector('svg').getBoundingClientRect()
	return Math.max(Math.abs(b.x + b.width / 2 - (a.x + a.width / 2)), Math.abs(b.y + b.height / 2 - (a.y + a.height / 2)))
})
check('the toast icon sits in the middle of its tile', iconOffset < 1, String(iconOffset))
await phone.close()

await browser.close(); done()
