// Settings: inside the app shell, instant preferences (theme, language, start page,
// week start), notification switches that persist, the password dialog, signing
// out other devices across two live sessions, and the phone layout.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `settings-${stamp}@example.com`, password: 'Password123!', name: 'Sam Settings' }
const me = await createVerifiedUser(ME, 'Ops')
await me.call('PATCH', '/auth/settings', { language: 'en' })
const plans = await me.call('POST', '/board/boards', { name: 'Plans' })
await me.call('POST', `/board/boards/${plans._id}/columns`, { title: 'To do', position: 0 })

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/settings`); await page.waitForSelector('.st-section')

check('settings live inside the app shell', (await page.locator('.app-sidebar').count()) === 1 && (await page.locator('.app-topbar__title').innerText()) === 'Settings')
check('the old navbar is gone', (await page.locator('.account-page, .settings-menu').count()) === 0)
check('the account card shows who I am', (await page.locator('.st-account').innerText()).includes('Sam Settings'))
check('the weekly digest switch is gone', !(await page.getByText(/digest/i).count()))
await page.goto(`${APP}/settings#security`); await page.waitForSelector('.st-section'); await page.waitForTimeout(300)
check('a #security link highlights that section in the nav', (await page.locator('.st-nav a[aria-current=true]').innerText()) === 'Sign-in & security')
await page.locator('.st-nav a', { hasText: 'Preferences' }).click(); await page.waitForTimeout(900)
check('the nav follows a click to another section', (await page.locator('.st-nav a[aria-current=true]').innerText()) === 'Preferences')

// Theme applies at once and agrees with the account menu.
await page.getByRole('radio', { name: 'Dark' }).click()
check('choosing Dark applies it immediately', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark')
await page.getByRole('radio', { name: 'Light' }).click()

// Notification switches save on their own and survive a reload.
const saved = page.waitForResponse((r) => r.url().includes('/auth/settings') && r.request().method() === 'PATCH')
await page.getByRole('switch', { name: /Email updates/ }).click()
check('a switch saves right away', (await saved).status() === 200)
await page.reload(); await page.waitForSelector('.st-section')
check('the email switch stays off after a reload', !(await page.getByRole('switch', { name: /Email updates/ }).isChecked()))
check('the task switch stayed on', await page.getByRole('switch', { name: /Task activity/ }).isChecked())

// Week start drives the calendar; start page drives where sign-in lands.
await page.getByRole('combobox', { name: 'Week starts on' }).selectOption('7')
await page.getByRole('combobox', { name: 'Start page' }).selectOption('calendar')
await page.goto(`${APP}/calendar`); await page.waitForSelector('.cal-grid, [role=grid]')
const firstDay = await page.locator('[role=columnheader]').first().innerText()
check('the calendar week starts on Sunday', /^sun/i.test(firstDay.trim()), firstDay)

// Language switches the page at once.
await page.goto(`${APP}/settings`); await page.waitForSelector('.st-section')
await page.getByRole('combobox', { name: 'Language' }).selectOption('uk')
await page.waitForTimeout(300)
check('changing the language translates the page', (await page.locator('.app-topbar__title').innerText()) === 'Налаштування')
await page.getByRole('combobox', { name: 'Мова' }).selectOption('en')

// The password dialog validates before sending anything.
const passwordCalls = []
page.on('request', (r) => { if (r.url().includes('/auth/change-password')) passwordCalls.push(r.method()) })
await page.click('[data-action=password]')
await page.fill('#st-password-current', ME.password)
await page.fill('#st-password-next', 'weak')
await page.fill('#st-password-repeat', 'weak')
await page.click('button[form=st-password-form]')
check('a weak password is refused locally', passwordCalls.length === 0 && (await page.getByRole('dialog').locator('.ui-field__error').count()) > 0)
await page.keyboard.press('Escape')

// Second device: it is signed out, this one is not.
const other = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const otherPage = await other.newPage(); watch(otherPage, 'other')
await otherPage.goto(`${APP}/login`); await uiLogin(otherPage, ME.email, ME.password)
await otherPage.waitForURL(/\/workspaces/)
check('the start page is per device, so a new browser opens boards', otherPage.url().endsWith('/workspaces'), otherPage.url())
await page.click('[data-action=sign-out-others]')
const ended = page.waitForResponse((r) => r.url().includes('/auth/sessions/sign-out-others'))
await page.getByRole('dialog').locator('button').last().click()
check('signing out other devices succeeds', (await ended).status() === 204)
await otherPage.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {})
check('the other device is sent to sign-in without reloading', /\/login/.test(otherPage.url()), otherPage.url())
await page.goto(`${APP}/my-tasks`); await page.waitForTimeout(1200)
check('this device stays signed in', page.url().endsWith('/my-tasks'), page.url())
await other.close()

// Same browser after signing out: lands on the chosen start page.
const again = await browser.newContext({ viewport: { width: 1280, height: 860 }, storageState: { cookies: [], origins: (await ctx.storageState()).origins } })
const againPage = await again.newPage(); watch(againPage, 'again')
await againPage.goto(`${APP}/login`); await uiLogin(againPage, ME.email, ME.password)
await againPage.waitForURL(/\/(calendar|workspaces)/)
check('signing in lands on the chosen start page', againPage.url().endsWith('/calendar'), againPage.url())
await again.close()

// Phone: no section nav, rows stack, nothing overflows.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })
const phonePage = await phone.newPage(); watch(phonePage, 'phone')
await phonePage.goto(`${APP}/settings#security`); await phonePage.waitForSelector('.st-section')
check('phones hide the section nav', !(await phonePage.locator('.st-nav').isVisible()))
check('nothing scrolls sideways on a phone', await phonePage.evaluate(() => document.querySelector('.workspace-main').scrollWidth <= window.innerWidth))
const securityTop = await phonePage.evaluate(() => Math.round(document.getElementById('security').getBoundingClientRect().top))
check('a #security link lands on that section', securityTop >= 0 && securityTop < 200, `top ${securityTop}`)

await browser.close(); done()
