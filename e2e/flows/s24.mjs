// Signed-in devices (list, sign out one, sign out the rest) and named passkeys
// (name on creation, rename, sign in with it), using Chrome's virtual authenticator.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `devices-${stamp}@example.com`, password: 'Password123!', name: 'Dev Ices' }
const me = await createVerifiedUser(ME, 'PM')
await me.call('PATCH', '/auth/settings', { language: 'en' })
// The API session above is a device too (no browser, so "Unknown device"); start clean.
await me.call('POST', '/auth/logout')
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

const browser = await launch()
const signedIn = async (userAgent, viewport, label) => {
	const ctx = await browser.newContext({ userAgent, viewport })
	const page = await ctx.newPage(); watch(page, label)
	await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
	return { ctx, page }
}
const laptop = await signedIn(MAC, { width: 1280, height: 900 }, 'laptop')
const page = laptop.page
await page.goto(`${APP}/settings#security`); await page.waitForSelector('.st-device')
const rows = () => page.locator('.st-device').allInnerTexts()
check('only this device at first', (await page.locator('.st-device').count()) === 1 && (await page.locator('.st-devices__note').count()) === 1)
check('this device is named and marked', (await rows())[0].includes('Chrome on macOS') && (await rows())[0].includes('This device') && (await rows())[0].includes('Active now'))

const phone = await signedIn(IPHONE, { width: 390, height: 844 }, 'phone')
const windows = await signedIn(WINDOWS, { width: 1280, height: 800 }, 'windows')
await page.waitForFunction(() => document.querySelectorAll('.st-device').length === 3, null, { timeout: 8000 }).catch(() => {})
let list = await rows()
check('new devices show up without reloading', list.length === 3, String(list.length))
check('each device says what it is', list.some((row) => row.includes('Safari on iOS')) && list.some((row) => row.includes('Firefox on Windows')), list.join(' | '))
check('and how it signed in', list.slice(1).every((row) => row.includes('with password')))
check('this device stays first', list[0].includes('This device'))

// Sign out the phone only.
await page.locator('.st-device', { hasText: 'Safari on iOS' }).getByRole('button', { name: /Sign out Safari on iOS/ }).click()
check('signing out one device asks first', (await page.getByRole('dialog').innerText()).includes('Sign out Safari on iOS?'))
await page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true }).click()
await page.waitForFunction(() => document.querySelectorAll('.st-device').length === 2, null, { timeout: 5000 }).catch(() => {})
list = await rows()
check('the phone leaves the list', list.length === 2 && !list.some((row) => row.includes('iOS')), list.join(' | '))
await phone.page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {})
check('the phone is sent to sign-in by itself', /\/login/.test(phone.page.url()), phone.page.url())
await windows.page.goto(`${APP}/my-tasks`); await windows.page.waitForTimeout(800)
check('the other devices stay signed in', windows.page.url().endsWith('/my-tasks'))

// Sign out every other device.
await page.click('[data-action=sign-out-others]')
await page.getByRole('dialog').getByRole('button', { name: 'Sign out others' }).click()
await page.waitForFunction(() => document.querySelectorAll('.st-device').length === 1, null, { timeout: 5000 }).catch(() => {})
check('signing out the rest leaves this device', (await page.locator('.st-device').count()) === 1, (await rows()).join(' | '))
await windows.page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {})
check('the Windows browser is signed out', /\/login/.test(windows.page.url()), windows.page.url())
await page.goto(`${APP}/my-tasks`); await page.waitForTimeout(800)
check('this device stays signed in', page.url().endsWith('/my-tasks'))

// Passkeys with names, through Chrome's virtual authenticator.
const cdp = await page.context().newCDPSession(page)
await cdp.send('WebAuthn.enable')
await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })
await page.goto(`${APP}/settings#security`); await page.waitForSelector('.st-device')
await page.getByRole('button', { name: 'Add passkey' }).click()
check('adding a passkey asks for a name first', await page.locator('#st-passkey-name').isVisible())
check('the name field is focused', await page.evaluate(() => document.activeElement?.id === 'st-passkey-name'))
await page.fill('#st-passkey-name', 'Work laptop')
await page.fill('#st-confirm-password', ME.password)
await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click()
await page.waitForSelector('.st-passkey', { timeout: 10000 })
check('the passkey keeps its name', (await page.locator('.st-passkey').first().innerText()).includes('Work laptop'))
check('the toast names it', (await page.locator('[data-sonner-toast]').allInnerTexts()).some((text) => text.includes('Work laptop')))
check('a new passkey says it was not used yet', (await page.locator('.st-passkey').first().innerText()).includes('not used yet'))

await page.getByRole('button', { name: 'Rename Work laptop' }).click()
check('rename starts from the current name', (await page.inputValue('#st-passkey-name')) === 'Work laptop')
await page.fill('#st-passkey-name', '  ')
await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
check('an empty name is refused', (await page.getByRole('dialog').locator('.ui-field__error').count()) === 1)
await page.fill('#st-passkey-name', 'Home Mac')
await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
await page.waitForTimeout(600)
check('renaming works', (await page.locator('.st-passkey').first().innerText()).includes('Home Mac'))

// The same authenticator cannot hold two passkeys for one account: it says so.
await page.getByRole('button', { name: 'Add passkey' }).click()
await page.fill('#st-confirm-password', ME.password)
await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click()
await page.waitForTimeout(1500)
check('a second passkey on the same device is explained', (await page.locator('[data-sonner-toast]').allInnerTexts()).some((text) => text.includes('already has a passkey')))

// Another authenticator, no name: it is named after this browser.
await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'usb', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })
await page.getByRole('button', { name: 'Add passkey' }).click()
await page.fill('#st-confirm-password', ME.password)
await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click()
await page.waitForFunction(() => document.querySelectorAll('.st-passkey').length === 2, null, { timeout: 10000 }).catch(() => {})
const second = await page.locator('.st-passkey').nth(1).innerText()
check('without a name a security key is called one', second.split('\n')[0] === 'Security key', second.split('\n')[0])

// Sign in with the passkey: it records when it was used, and the device says how it signed in.
await page.context().clearCookies()
await page.goto(`${APP}/login`)
await page.fill('#email', ME.email)
await page.click('button[type=submit]')
await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
await page.waitForURL(/\/workspaces/, { timeout: 10000 }).catch(() => {})
check('the passkey signs in', /\/workspaces/.test(page.url()), page.url())
await page.goto(`${APP}/settings#security`); await page.waitForSelector('.st-passkey')
const used = await page.locator('.st-passkey').allInnerTexts()
check('the used passkey shows when', used.some((text) => text.includes('last used')), used.join(' | '))
check('this device signed in with a passkey', (await page.locator('.st-device[data-current]').innerText()).includes('with a passkey'))

// Phone layout: nothing spills sideways.
const phone2 = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await page.context().storageState() })
const phonePage = await phone2.newPage(); watch(phonePage, 'phone2')
await phonePage.goto(`${APP}/settings#security`); await phonePage.waitForSelector('.st-device')
check('the security section fits a phone', await phonePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && [...document.querySelectorAll('.st-device, .st-passkey')].every((row) => row.getBoundingClientRect().right <= window.innerWidth)))
await phone2.close()

await browser.close(); done()
