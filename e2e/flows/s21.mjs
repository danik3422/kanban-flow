// The board dock (Planner, Board, Switch boards) with its shortcuts, the board
// switcher, the planner filtered to one board, and the list drag animation.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `dock-${stamp}@example.com`, password: 'Password123!', name: 'Dana Dock' }
const me = await createVerifiedUser(ME, 'PM')
await me.call('PATCH', '/auth/settings', { language: 'en' })
const today = new Date().toLocaleDateString('sv-SE')
const make = async (name, cardTitle, background) => {
	const board = await me.call('POST', '/board/boards', { name, background })
	const todo = await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'To do', position: 0 })
	await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'Doing', position: 1 })
	await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'Done', position: 2 })
	await me.call('POST', `/board/columns/${todo._id}/task`, { title: cardTitle, dueDate: today, assignees: [me.id] })
	return board
}
const alpha = await make('Alpha launch', 'Alpha card', { type: 'gradient', key: 'ocean' })
const beta = await make('Beta research', 'Beta card', null)
await make('Gamma ops', 'Gamma card', { type: 'color', key: 'green' })

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/workspaces/${alpha._id}`); await page.waitForSelector('.bc-column')

// The dock.
await page.waitForSelector('.bd')
check('the dock offers Planner, Board and Switch boards (no Inbox)', (await page.locator('.bd-item').allInnerTexts()).map((text) => text.split('\n')[0]).join('|') === 'Planner|Board|Switch boards')
check('only the board is shown at first', (await page.locator('.bd-item[aria-pressed="true"]').allInnerTexts()).map((text) => text.split('\n')[0]).join('|') === 'Board')
await page.locator('.bd-item', { hasText: 'Planner' }).hover()
await page.waitForTimeout(500)
check('hovering shows the shortcut', (await page.locator('.bd-item', { hasText: 'Planner' }).locator('.bd-tip').innerText()).includes('g+p'))

// "b" while typing does nothing; "b" on the board opens the switcher.
await page.locator('.bc-column').first().locator('.bc-add-card').click()
await page.keyboard.type('bb')
check('typing b in a field does not open the switcher', (await page.locator('.bs').count()) === 0)
await page.keyboard.press('Escape')
await page.mouse.click(1100, 700)
await page.keyboard.press('b')
await page.waitForSelector('.bs')
check('b opens the board switcher with the search focused', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Search your boards'))
check('the current board is marked', (await page.locator('.bs-tile.is-current').first().innerText()).includes('Alpha launch'))

// Search, arrows and Enter.
await page.keyboard.type('bet')
check('search narrows the boards', (await page.locator('.bs-tile:not(.bs-tile--create)').count()) === 1)
await page.keyboard.press('Enter')
await page.waitForURL(new RegExp(`/workspaces/${beta._id}$`))
check('Enter opens the match', page.url().endsWith(beta._id))
await page.waitForSelector('.bc-column')
await page.mouse.click(1100, 700)
await page.keyboard.press('b')
await page.waitForSelector('.bs')
await page.keyboard.press('ArrowDown')
check('ArrowDown moves from the search into the boards', await page.evaluate(() => document.activeElement?.classList.contains('bs-tile__open')))
await page.keyboard.press('ArrowRight')
check('arrow keys move between boards', await page.evaluate(() => document.activeElement?.classList.contains('bs-tile__open')))

// List view is remembered; starring from the switcher.
await page.getByRole('button', { name: 'Show as list' }).click()
check('the switcher can show a list', (await page.locator('.bs-grid--list').count()) > 0)
await page.locator('.bs-tile', { hasText: 'Gamma ops' }).first().hover()
await page.locator('.bs-tile', { hasText: 'Gamma ops' }).first().getByRole('button', { name: /^Star/ }).click()
check('a board can be starred from the switcher', (await page.locator('.bs-section', { hasText: 'Starred' }).count()) === 1)
await page.keyboard.press('Escape')
await page.mouse.click(1100, 700)
await page.keyboard.press('b')
await page.waitForSelector('.bs')
check('the list view is remembered', (await page.locator('.bs-grid--list').count()) > 0)
await page.keyboard.press('Escape')

// g then p: the planner opens beside the board, with this board's cards; its
// Calendar link opens the calendar for this board only.
await page.mouse.click(1100, 700)
await page.keyboard.press('g')
await page.keyboard.press('p')
await page.waitForSelector('.pl--side')
check('g then p opens the planner beside the board', (await page.locator('.bc-board').count()) === 1 && (await page.locator('.bd-item', { hasText: 'Planner' }).getAttribute('aria-pressed')) === 'true')
await page.keyboard.press('g')
await page.keyboard.press('b')
await page.waitForSelector('.pl--full')
check('g then b hides the board and widens the planner', (await page.locator('.bc-board').count()) === 0)
await page.keyboard.press('g')
await page.keyboard.press('b')
await page.waitForSelector('.pl--side')
await page.locator('.pl-head').getByRole('link', { name: 'Calendar' }).click()
await page.waitForURL(/\/calendar\?board=/)
await page.waitForSelector('.cal-board-filter')
check('the planner links to the calendar for this board', page.url().includes(`board=${beta._id}`) && (await page.locator('.cal-board-filter').innerText()).includes('Beta research'))
await page.waitForTimeout(800)
await page.getByRole('radio', { name: 'All' }).click()
await page.waitForTimeout(800)
const chips = await page.locator('.cal-chip').allInnerTexts()
check('the planner shows only that board', chips.some((text) => text.includes('Beta card')) && !chips.some((text) => text.includes('Alpha card')), chips.join(','))
await page.getByRole('button', { name: 'Show all boards' }).click()
await page.waitForTimeout(900)
check('clearing the board shows every board again', !page.url().includes('board=') && (await page.locator('.cal-chip', { hasText: 'Alpha card' }).count()) >= 1)

// Dragging a list: a ghost lifts off, a slot moves, the order is saved.
await page.evaluate(() => localStorage.removeItem('kh:planner'))
await page.goto(`${APP}/workspaces/${alpha._id}`); await page.waitForSelector('.bc-column')
const first = await page.locator('.bc-board > .bc-column').first().locator('.bc-column__header').boundingBox()
// Picked up and put back: it stays first, nothing is sent.
let positionCalls = 0
page.on('request', (request) => { if (request.url().includes('/position')) positionCalls++ })
for (const wobble of [[40, 10], [-30, 25], [90, 0]]) {
	await page.mouse.move(first.x + 60, first.y + 18)
	await page.mouse.down()
	await page.mouse.move(first.x + 60 + wobble[0], first.y + 18 + wobble[1], { steps: 12 })
	await page.waitForTimeout(150)
	const slotAt = await page.locator('.bc-board > .bc-column').evaluateAll((items) => items.findIndex((item) => item.classList.contains('is-dragging')))
	check(`a first list moved ${wobble[0]}px keeps its slot first`, slotAt === 0, String(slotAt))
	await page.mouse.up()
	await page.waitForTimeout(350)
}
{
	// Far away and back again without letting go: still first, still nothing sent.
	const third = await page.locator('.bc-board > .bc-column').nth(2).boundingBox()
	await page.mouse.move(first.x + 60, first.y + 18)
	await page.mouse.down()
	await page.mouse.move(third.x + third.width / 2 + 60, first.y + 30, { steps: 20 })
	await page.waitForTimeout(150)
	const away = await page.locator('.bc-board > .bc-column').evaluateAll((items) => items.findIndex((item) => item.classList.contains('is-dragging')))
	await page.mouse.move(first.x + 60, first.y + 18, { steps: 20 })
	await page.waitForTimeout(150)
	const back = await page.locator('.bc-board > .bc-column').evaluateAll((items) => items.findIndex((item) => item.classList.contains('is-dragging')))
	check('the slot follows the list out and back', away === 2 && back === 0, `${away} → ${back}`)
	await page.mouse.up()
	await page.waitForTimeout(400)
}
check('putting a list back sends nothing', positionCalls === 0, String(positionCalls))
check('putting a list back keeps the order', (await me.call('GET', `/board/boards/${alpha._id}/content`)).map((column) => column.title).join(',') === 'To do,Doing,Done')
const third = await page.locator('.bc-board > .bc-column').nth(2).locator('.bc-column__header').boundingBox()
await page.mouse.move(first.x + 60, first.y + 18)
await page.mouse.down()
await page.mouse.move(third.x + third.width - 20, third.y + 40, { steps: 25 })
await page.waitForTimeout(300)
check('a tilted ghost follows the pointer', (await page.locator('.bc-ghost.is-lifted').count()) === 1)
check('dragging a list selects no text on the board', await page.evaluate(() => window.getSelection().toString() === ''), await page.evaluate(() => window.getSelection().toString().slice(0, 40)))
const during = await page.locator('.bc-board > .bc-column').evaluateAll((items) => items.map((item) => (item.classList.contains('is-dragging') ? 'slot' : item.querySelector('.bc-column__title')?.innerText)))
check('the slot moves to where the list will land', during.indexOf('slot') === 2, during.join(','))
await page.mouse.up()
await page.waitForTimeout(500)
check('the ghost is gone after the drop', (await page.locator('.bc-ghost').count()) === 0)
const order = (await me.call('GET', `/board/boards/${alpha._id}/content`)).map((column) => column.title)
check('the new order is saved', order.join(',') === 'Doing,Done,To do', order.join(','))

// Grabbing the empty part of a header and starting slowly (as a hand does) selects
// nothing either; Safari used to highlight the neighbouring lists here.
{
	const header = await page.locator('.bc-board > .bc-column').nth(1).locator('.bc-column__header').boundingBox()
	const sx = header.x + header.width - 110, sy = header.y + 14
	await page.mouse.move(sx, sy)
	await page.mouse.down()
	for (let step = 1; step <= 7; step++) { await page.mouse.move(sx + step, sy + step * 2); await page.waitForTimeout(40) }
	await page.mouse.move(header.x + 2, header.y + 300, { steps: 30 })
	await page.mouse.move(header.x + 500, header.y + 400, { steps: 20 })
	const selected = await page.evaluate(() => window.getSelection().toString())
	check('a slow start from the header selects nothing', selected === '', selected.replace(/\s+/g, ' ').slice(0, 50))
	await page.mouse.move(sx, sy, { steps: 20 })
	await page.mouse.up()
	await page.waitForTimeout(400)
}

// A click on a list's title still opens it for renaming.
await page.locator('.bc-board > .bc-column').first().locator('.bc-column__title').click()
check('clicking a title still renames it', (await page.locator('.bc-board > .bc-column').first().locator('textarea, input').count()) > 0)
await page.keyboard.press('Escape')

// Phone: no dock; the switcher opens from the top bar.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })
const phonePage = await phone.newPage(); watch(phonePage, 'phone')
await phonePage.goto(`${APP}/workspaces/${alpha._id}`); await phonePage.waitForSelector('.bc-column')
check('phones have no floating dock', !(await phonePage.locator('.bd').isVisible()))
await phonePage.locator('.bh-title .bh-phone-only').click()
check('phones open the switcher from the top bar', (await phonePage.locator('.bs').count()) === 1)
check('the switcher does not scroll sideways', await phonePage.evaluate(() => [...document.querySelectorAll('.ui-modal__body')].every((body) => body.scrollWidth <= body.clientWidth)))
await phone.close()

await browser.close(); done()
