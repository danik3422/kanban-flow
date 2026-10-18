// On touch phones nothing pops the keyboard by itself: dialogs and sheets open with
// focus on the sheet, and a field takes focus only when tapped. Desktop keeps
// focusing the first field, and tapping "Add card" still opens the keyboard.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `keys-${stamp}@example.com`, password: 'Password123!', name: 'Kira Keys' }
const me = await createVerifiedUser(ME, 'PM')
await me.call('PATCH', '/auth/settings', { language: 'en' })
const board = await me.call('POST', '/board/boards', { name: 'Keyboard board' })
const todo = await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'To do', position: 0 })
await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Open me' })

const browser = await launch()
const typingFocused = (page) => page.evaluate(() => {
	const el = document.activeElement
	return Boolean(el && (el.matches('input:not([type=checkbox]):not([type=radio]), textarea, select') || el.isContentEditable))
})

const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const phone = await phoneCtx.newPage(); watch(phone, 'phone')
await phone.goto(`${APP}/login`); await uiLogin(phone, ME.email, ME.password); await phone.waitForURL(/\/workspaces/)
const opens = async (label, open, selector = '.ui-modal') => {
	await open()
	await phone.waitForSelector(selector, { timeout: 5000 })
	await phone.waitForTimeout(400)
	check(`${label} opens without the keyboard`, !(await typingFocused(phone)), await phone.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)))
	// Escape steps back inside the board menu, so press it until everything is closed.
	for (let step = 0; step < 3 && (await phone.locator('.ui-modal').count()); step++) {
		await phone.keyboard.press('Escape')
		await phone.waitForTimeout(350)
	}
}
await opens('search', () => phone.locator('.app-search-trigger').tap())
await phone.goto(`${APP}/workspaces/${board._id}`); await phone.waitForSelector('.task-card')
await opens('the board switcher', () => phone.locator('.bh-title .bh-phone-only').tap())
await opens('the card filter', () => phone.locator('.bh-actions .bh-filter').tap())
await opens('a card', () => phone.locator('.task-card').first().tap(), '.cm-modal')
await opens('the board description', async () => {
	await phone.locator('.bh-actions .bh-menu').tap()
	await phone.locator('.bh-about').tap()
})
await opens('creating a board', () => phone.locator('.app-bottom-nav__primary').tap())

// Tapping the field still brings the keyboard, as asked.
await phone.locator('.bh-actions .bh-filter').tap()
await phone.waitForSelector('.bh-filter-body')
await phone.locator('.bh-filter-body input[type=search]').tap()
check('tapping a field focuses it', await typingFocused(phone))
await phone.keyboard.press('Escape'); await phone.keyboard.press('Escape')

// "Add card" is a tap meant for typing: the field is ready.
await phone.locator('.bc-add-card').first().tap()
await phone.waitForTimeout(300)
check('"Add card" opens ready to type', await typingFocused(phone))

// Profile timezone picker.
await phone.goto(`${APP}/profile`); await phone.waitForSelector('#profile-timezone')
await opens('the timezone picker', () => phone.locator('#profile-timezone').tap())
await phoneCtx.close()

// Desktop keeps the quick start.
const desk = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage(); watch(desk, 'desktop')
await desk.goto(`${APP}/login`); await uiLogin(desk, ME.email, ME.password); await desk.waitForURL(/\/workspaces/); await desk.waitForSelector('.app-sidebar'); await desk.waitForTimeout(500)
await desk.keyboard.press('Control+k'); await desk.waitForSelector('.quick-switcher')
check('desktop search opens ready to type', await typingFocused(desk))
await browser.close(); done()
