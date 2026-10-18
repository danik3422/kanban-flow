// Board loading (clicking the open board in the sidebar, cached return visits, the
// skeleton) and the searchable timezone field in first-time setup and the profile.
import { API, APP, apiSession, check, createVerifiedUser, done, lastMailTo, launch, linkFrom, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const browser = await launch()

// First-time setup on a device in Tokyo.
const NEW = { email: `tz-${stamp}@example.com`, password: 'Password123!' }
const fresh = apiSession()
await fresh('POST', '/auth/signup', { ...NEW, language: 'en' })
await fresh('POST', '/auth/login', NEW)
await fresh('POST', '/auth/verify-email', { token: new URL(linkFrom(lastMailTo(NEW.email))).searchParams.get('token') })
const setupCtx = await browser.newContext({ viewport: { width: 1280, height: 860 }, timezoneId: 'Asia/Tokyo' })
const setup = await setupCtx.newPage(); watch(setup, 'setup')
await setup.goto(`${APP}/login`); await uiLogin(setup, NEW.email, NEW.password)
await setup.waitForURL(/\/setup-profile/); await setup.waitForSelector('#setup-timezone')
check('setup starts on this device’s timezone', (await setup.locator('#setup-timezone').innerText()).includes('Tokyo'))
const trigger = setup.locator('#setup-timezone')
await trigger.click()
await setup.waitForSelector('.tzp-option')
await setup.keyboard.type('Київ')
let options = await setup.locator('.tzp-option__city').allInnerTexts()
check('a city typed in Ukrainian is found', options[0] === 'Kyiv', options.slice(0, 3).join('|'))
await setup.keyboard.press('Enter')
check('Enter picks it', (await trigger.innerText()).includes('Kyiv'))
check('setup offers this device’s timezone', (await setup.getByRole('button', { name: /Use this device’s timezone \(Asia\/Tokyo\)/ }).count()) === 1)
await setup.getByRole('button', { name: /Use this device’s timezone/ }).click()
check('the device button sets it', (await trigger.innerText()).includes('Tokyo'))
const searchFor = async (page, text) => {
	await page.locator('.tzp-search input, input.tzp-search').fill(text)
	await page.waitForTimeout(100)
	return page.locator('.tzp-option__city').allInnerTexts()
}
await trigger.click(); await setup.waitForSelector('.tzp-option')
check('the list starts with this device, then popular places', (await setup.locator('.tzp-group').allInnerTexts()).join('|').startsWith('THIS DEVICE|POPULAR') || (await setup.locator('.tzp-group').allInnerTexts()).join('|').toLowerCase().startsWith('this device|popular'))
options = await searchFor(setup, 'warsaw'); check('an English city is found', options[0] === 'Warsaw', options.slice(0, 3).join('|'))
options = await searchFor(setup, 'Киев'); check('a city typed in Russian is found', options[0] === 'Kyiv', options.slice(0, 3).join('|'))
options = await searchFor(setup, 'Lisbon'); check('any city in the list is found', options.includes('Lisbon'), options.join('|'))
options = await searchFor(setup, 'Paramaribo'); check('small capitals are found too', options.includes('Paramaribo'), options.join('|'))
options = await searchFor(setup, 'UTC+9'); check('an offset finds its zones, well-known places first', options[0] === 'Seoul' || options[0] === 'Tokyo', options.slice(0, 6).join('|'))
options = await searchFor(setup, 'eastern european'); check('the zone’s name finds it', options.includes('Kyiv'), options.slice(0, 6).join('|'))
options = await searchFor(setup, 'zzqx'); check('no match says so', options.length === 0 && (await setup.locator('.tzp-modal .ui-empty, .tzp-modal [class*=empty]').count()) > 0)
await searchFor(setup, 'Kyiv'); await setup.keyboard.press('Enter')
await setup.fill('#setup-name', 'Taro Zone')
await setup.locator('.setup-submit').click()
await setup.waitForURL((url) => !url.pathname.includes('setup-profile'))
check('setup saves the chosen timezone', (await fresh('GET', '/auth/get-user')).timezone === 'Europe/Kyiv')
await setupCtx.close()

// Profile: the same field.
const ME = { email: `load-${stamp}@example.com`, password: 'Password123!', name: 'Lena Load' }
const me = await createVerifiedUser(ME, 'PM')
await me.call('PATCH', '/auth/settings', { language: 'en' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/profile`); await page.waitForSelector('#profile-timezone')
await page.locator('#profile-timezone').click(); await page.waitForSelector('.tzp-option')
check('the current zone is marked', (await page.locator('.tzp-option.is-selected .tzp-option__city').first().innerText()) === 'Kyiv')
options = await searchFor(page, 'Нью-Йорк'); check('profile search finds New York in Russian', options[0] === 'New York', options.slice(0, 3).join('|'))
await page.keyboard.press('Enter')
check('picking a zone shows the save bar', await page.locator('.pf-savebar.is-visible').isVisible())

// Boards.
const make = async (name, delayTitle) => {
	const board = await me.call('POST', '/board/boards', { name })
	for (const [position, title] of ['To do', 'Doing', delayTitle || 'Done'].entries()) await me.call('POST', `/board/boards/${board._id}/columns`, { title, position })
	return board
}
const alpha = await make('Alpha room')
const beta = await make('Beta room')
await page.goto(`${APP}/workspaces/${alpha._id}`); await page.waitForSelector('.bc-column')
check('the board opens with its lists', (await page.locator('.bc-board > .bc-column').count()) === 3)
await page.locator('.app-sidebar__section', { hasText: 'Recent' }).getByText('Alpha room').click()
await page.waitForTimeout(800)
check('clicking the open board in Recent keeps its lists', (await page.locator('.bc-board > .bc-column').count()) === 3)
check('…and shows no skeleton', (await page.locator('.bc-skeleton').count()) === 0)
await page.locator('.bc-board > .bc-column').first().hover()
await page.keyboard.press('Escape')

// A slow board shows the skeleton, then its lists.
await page.route(`${API}/board/boards/${beta._id}/content`, async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue() })
await page.keyboard.press('Control+k')
await page.locator('.quick-switcher input').fill('Beta room')
await page.keyboard.press('Enter')
await page.waitForSelector('.bc-skeleton', { timeout: 3000 })
await page.waitForTimeout(500)
check('a slow board shows list-shaped placeholders', (await page.locator('.bc-skeleton__column').count()) === 4 && (await page.locator('.bc-skeleton').evaluate((node) => Number(getComputedStyle(node).opacity))) > 0.9)
await page.waitForSelector('.bc-board > .bc-column[data-column-id]')
check('the skeleton gives way to the lists', (await page.locator('.bc-skeleton').count()) === 0 && (await page.locator('.bc-board > .bc-column').count()) === 3)
await page.unroute(`${API}/board/boards/${beta._id}/content`)

// Back to a board seen this visit: its lists show at once, then refresh.
await page.locator('.app-sidebar__section', { hasText: 'Recent' }).getByText('Alpha room').click()
await page.waitForURL(new RegExp(alpha._id))
check('a board opened earlier shows at once', (await page.locator('.bc-board > .bc-column').count()) === 3 && (await page.locator('.bc-skeleton').count()) === 0)
await me.call('POST', `/board/boards/${alpha._id}/columns`, { title: 'Later', position: 3 })
await page.locator('.app-sidebar__section', { hasText: 'Recent' }).getByText('Beta room').click()
await page.waitForURL(new RegExp(beta._id)); await page.waitForTimeout(400)
await page.locator('.app-sidebar__section', { hasText: 'Recent' }).getByText('Alpha room').click()
await page.waitForTimeout(800)
check('the cached board refreshes behind the scenes', (await page.locator('.bc-board > .bc-column').count()) === 4)

await browser.close(); done()
