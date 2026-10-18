// Public board view (guest, phone, member, unverified account, dead link) and the
// email verification page (already verified, old link, confirming on another device).
import { APP, apiSession, apiSignup, check, createVerifiedUser, done, lastMailTo, launch, linkFrom, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const OWNER = { email: `pb-owner-${stamp}@example.com`, password: 'Password123!', name: 'Paula Owner' }
const owner = await createVerifiedUser(OWNER, 'PM')
await owner.call('PATCH', '/auth/settings', { language: 'en' })
const board = await owner.call('POST', '/board/boards', { name: 'Website relaunch', visibility: 'public' })
const cols = []
for (const [position, title] of ['Backlog', 'In progress', 'Done'].entries()) cols.push(await owner.call('POST', `/board/boards/${board._id}/columns`, { title, position }))
const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE')
await owner.call('POST', `/board/columns/${cols[0]._id}/task`, { title: 'Pricing page copy', description: '<p>Rewrite the <strong>three plans</strong>.</p>', checklist: [{ text: 'Draft', completed: true }, { text: 'Review', completed: false }] })
await owner.call('POST', `/board/columns/${cols[1]._id}/task`, { title: 'New hero illustration', dueDate: yesterday, priority: 'high' })
await owner.call('POST', `/board/columns/${cols[2]._id}/task`, { title: 'Pick a domain', dueDate: yesterday })
const { publicUrl } = await owner.call('POST', `/board/boards/${board._id}/public-link`)
const path = new URL(publicUrl).pathname

const browser = await launch()
const context = async (viewport = { width: 1440, height: 900 }) => {
	const ctx = await browser.newContext({ viewport, locale: 'en-US' })
	await ctx.addInitScript(() => localStorage.setItem('kanban-language', 'en'))
	return ctx
}

// Guest on desktop.
const guestCtx = await context()
const guest = await guestCtx.newPage(); watch(guest, 'guest')
await guest.goto(APP + path); await guest.waitForSelector('.pb-column')
check('the public board has its own header, not the old navbar', (await guest.locator('.pb-header').count()) === 1 && (await guest.locator('.navbar').count()) === 0)
const meta = await guest.locator('.pb-hero__meta').innerText()
check('progress counts the last column as done', meta.includes('1 of 3 done'), meta)
check('only unfinished late work counts as overdue', meta.includes('1 overdue'), meta)
check('a late task in Done is not shown as late', (await guest.locator('.pb-card.is-done .ui-badge--danger').count()) === 0)
await guest.getByRole('button', { name: /^Overdue/ }).click()
check('the overdue filter keeps only late work', (await guest.locator('.pb-card').count()) === 1)
await guest.getByRole('button', { name: /^Overdue/ }).click()
await guest.getByLabel('Search tasks on this board').fill('nothing like this')
check('a search with no results offers to clear it', (await guest.getByRole('button', { name: 'Clear filters' }).count()) === 1)
await guest.getByRole('button', { name: 'Clear filters' }).click()
await guest.getByRole('button', { name: 'Open task Pricing page copy' }).click()
const panel = guest.getByRole('dialog')
check('a task opens read-only with its description', (await panel.locator('.pb-task__description strong').innerText()) === 'three plans')
check('the checklist shows progress', (await panel.innerText()).includes('1/2'))
await guest.keyboard.press('Escape')
check('guests are invited to create their own board', (await guest.getByRole('link', { name: 'Create your own board' }).count()) >= 1)
await guestCtx.close()

// Guest on a phone: one column at a time.
const phoneCtx = await context({ width: 390, height: 844 })
const phone = await phoneCtx.newPage(); watch(phone, 'phone')
await phone.goto(APP + path); await phone.waitForSelector('.pb-column')
check('phones show one column', (await phone.locator('.pb-column:visible').count()) === 1)
await phone.locator('.pb-tabs button', { hasText: 'In progress' }).click()
check('the column tabs switch columns', (await phone.locator('.pb-column:visible h2').innerText()) === 'In progress')
check('nothing scrolls sideways on a phone', await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
await phoneCtx.close()

// Dead link.
const deadCtx = await context()
const dead = await deadCtx.newPage(); watch(dead, 'dead')
await dead.goto(`${APP}/public/deadbeef`); await dead.waitForSelector('.pb-status')
check('a dead public link explains itself in plain words', (await dead.locator('.pb-status__title').innerText()) === 'This board is no longer shared' && !(await dead.getByText('invalid or expired').count()))
await deadCtx.close()

// Member: a way back into the app.
const memberCtx = await context()
const member = await memberCtx.newPage(); watch(member, 'member')
await member.goto(`${APP}/login`); await uiLogin(member, OWNER.email, OWNER.password); await member.waitForURL(/\/workspaces/)
await member.goto(APP + path); await member.waitForSelector('.pb-column')
check('members get Open in KanbanHub', (await member.getByRole('link', { name: 'Open in KanbanHub' }).getAttribute('href')) === `/workspaces/${board._id}`)

// Verified user on the verification page, with and without an old link.
let verifyPosts = 0
member.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/auth/verify-email')) verifyPosts++ })
await member.goto(`${APP}/verify-email?token=old-link`); await member.waitForSelector('.auth-status')
check('a verified account is told it is confirmed', (await member.locator('.auth-status h1').innerText()) === 'Your email is confirmed')
check('an old link is not submitted again', verifyPosts === 0)
check('the token does not stay in the address bar', !member.url().includes('token='), member.url())
await memberCtx.close()

// Unverified account: can still view a public board; confirming elsewhere moves on by itself.
const NEW = { email: `pb-new-${stamp}@example.com`, password: 'Password123!' }
await apiSignup(NEW.email, NEW.password)
const newCtx = await context()
const fresh = await newCtx.newPage(); watch(fresh, 'unverified')
await fresh.goto(`${APP}/login`); await uiLogin(fresh, NEW.email, NEW.password); await fresh.waitForURL(/verify-email/)
await fresh.goto(APP + path); await fresh.waitForTimeout(1200)
check('an unverified account can open a public board', (await fresh.locator('.pb-column').count()) > 0, fresh.url())
await fresh.goto(`${APP}/verify-email`); await fresh.waitForSelector('.auth-status')
const elsewhere = apiSession()
await elsewhere('POST', '/auth/login', { email: NEW.email, password: NEW.password })
await elsewhere('POST', '/auth/verify-email', { token: new URL(linkFrom(lastMailTo(NEW.email))).searchParams.get('token') })
await fresh.waitForURL(/setup-profile/, { timeout: 25000 }).catch(() => {})
check('confirming on another device moves this page on', fresh.url().includes('/setup-profile'), fresh.url())
await newCtx.close()

await browser.close(); done()
