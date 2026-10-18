// Board lists, Trello-style: rename in place, add cards in a row, fold a list,
// list actions (copy, move, move all cards, sort, watch, pin, colour, delete),
// what members may do, dragging lists and cards, and the phone layout.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const OWNER = { email: `cols-owner-${stamp}@example.com`, password: 'Password123!', name: 'Cora Owner' }
const MEMBER = { email: `cols-member-${stamp}@example.com`, password: 'Password123!', name: 'Milo Member' }
const owner = await createVerifiedUser(OWNER, 'PM')
const member = await createVerifiedUser(MEMBER, 'Dev')
for (const user of [owner, member]) await user.call('PATCH', '/auth/settings', { language: 'en' })
const board = await owner.call('POST', '/board/boards', { name: 'Lists lab' })
const ids = {}
for (const [position, title] of ['Backlog', 'Doing', 'Done'].entries()) ids[title] = (await owner.call('POST', `/board/boards/${board._id}/columns`, { title, position }))._id
await owner.call('POST', `/board/columns/${ids.Backlog}/task`, { title: 'Low thing', priority: 'low' })
await owner.call('POST', `/board/columns/${ids.Backlog}/task`, { title: 'Urgent thing', priority: 'urgent' })
const invite = await owner.call('POST', `/board/boards/${board._id}/invites`, { email: MEMBER.email, role: 'member' })
await member.call('POST', `/board/invites/${new URL(invite.inviteUrl).pathname.split('/').pop()}/accept`)
const content = async () => owner.call('GET', `/board/boards/${board._id}/content`)

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); watch(page, 'owner')
await page.goto(`${APP}/login`); await uiLogin(page, OWNER.email, OWNER.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/workspaces/${board._id}`); await page.waitForSelector('.bc-column')
const column = (title) => page.locator('.bc-column', { has: page.locator('.bc-column__title', { hasText: title }) })
const openMenu = async (title) => {
	await column(title).getByRole('button', { name: `Actions for ${title}` }).click()
	await page.waitForSelector('.bc-panel')
}
const menuItem = (name) => page.locator('.bc-panel').getByRole('button', { name, exact: true })

check('the old refresh button is gone', (await page.getByRole('button', { name: /refresh/i }).count()) === 0)

// Rename in place: Escape cancels, Enter saves.
await column('Doing').locator('.bc-column__title-button').click()
await page.keyboard.type('Nope')
await page.keyboard.press('Escape')
check('Escape cancels a rename', (await column('Doing').count()) === 1)
await column('Doing').locator('.bc-column__title-button').click()
await page.keyboard.type('In progress')
await page.keyboard.press('Enter')
await page.waitForTimeout(600)
check('Enter saves a rename', (await content()).some((item) => item.title === 'In progress'))

// Cards in a row: the composer stays open after each Enter.
await column('In progress').locator('.bc-add-card').click()
for (const title of ['First', 'Second', 'Third']) {
	await column('In progress').locator('.bc-composer__input').fill(title)
	await column('In progress').locator('.bc-composer__input').press('Enter')
	await page.waitForTimeout(400)
}
check('three cards added in a row', (await column('In progress').locator('.task-card').count()) === 3)
await page.keyboard.press('Escape')
check('Escape closes the card composer', (await column('In progress').locator('.bc-composer').count()) === 0)

// Fold a list; it stays folded after a reload.
await column('Done').getByRole('button', { name: 'Collapse list' }).click()
check('a folded list becomes a slim strip', (await page.locator('.bc-column--collapsed').count()) === 1)
await page.reload(); await page.waitForSelector('.bc-column')
check('folding is remembered', (await page.locator('.bc-column--collapsed').count()) === 1)
await page.locator('.bc-collapsed').click()
check('clicking the strip unfolds it', (await page.locator('.bc-column--collapsed').count()) === 0)

// Sort by priority.
await openMenu('Backlog')
await menuItem('Sort by').click()
await menuItem('Priority').click()
await page.waitForTimeout(500)
check('sorting by priority puts urgent first', (await column('Backlog').locator('.task-card h3').first().innerText()) === 'Urgent thing')

// Colour and remove colour.
await openMenu('Backlog')
await page.locator('.bc-panel').getByRole('button', { name: 'Purple' }).click()
await page.waitForTimeout(500)
check('a list can be coloured', (await column('Backlog').getAttribute('data-color')) === 'purple' && (await content()).find((item) => item.title === 'Backlog').color === 'purple')
await openMenu('Backlog')
await page.locator('.bc-panel').getByRole('button', { name: 'Remove color' }).click()
await page.waitForTimeout(500)
check('the colour can be removed', !(await column('Backlog').getAttribute('data-color')))

// Copy, with Escape stepping back from the sub-view first.
await openMenu('Backlog')
await menuItem('Copy list').click()
await page.keyboard.press('Escape')
check('Escape steps back to the main menu', (await menuItem('Copy list').count()) === 1)
await menuItem('Copy list').click()
await page.locator('.bc-panel input').fill('Backlog copy')
await page.locator('.bc-panel').getByRole('button', { name: 'Create list' }).click()
await page.waitForTimeout(900)
const afterCopy = await content()
check('copying a list copies its cards and puts it next to it', afterCopy[1]?.title === 'Backlog copy' && afterCopy[1].tasks.length === 2, afterCopy.map((item) => item.title).join(','))

// Move all cards, then move a list.
await openMenu('Backlog copy')
await menuItem('Move all cards in this list').click()
await page.locator('.bc-panel').getByRole('button', { name: 'Done' }).click()
await page.waitForTimeout(900)
const afterMove = await content()
check('moving all cards empties the list into another', afterMove.find((item) => item.title === 'Backlog copy').tasks.length === 0 && afterMove.find((item) => item.title === 'Done').tasks.length === 2)
await openMenu('Backlog copy')
await menuItem('Move list').click()
await page.locator('.bc-panel select').selectOption({ label: '4' })
await page.locator('.bc-panel').getByRole('button', { name: 'Move', exact: true }).click()
await page.waitForTimeout(800)
check('moving a list puts it at the chosen position', (await content()).at(-1).title === 'Backlog copy')

// Delete with a confirmation that names what goes.
await openMenu('Backlog copy')
await menuItem('Delete list…').click()
check('deleting asks first', (await page.getByRole('dialog', { name: 'Delete “Backlog copy”?' }).count()) === 1)
await page.getByRole('button', { name: 'Delete list' }).click()
await page.waitForTimeout(700)
check('the list is deleted', !(await content()).some((item) => item.title === 'Backlog copy'))

// Add a list from the end of the board.
await page.locator('.bc-add-list').click()
await page.locator('.bc-list-composer input').fill('Ideas')
await page.locator('.bc-list-composer input').press('Enter')
await page.waitForTimeout(700)
check('a new list is added at the end', (await content()).at(-1).title === 'Ideas')
await page.keyboard.press('Escape')

// Drag a list by its header with the mouse.
const ideasHeader = await column('Ideas').locator('.bc-column__header').boundingBox()
const backlogHeader = await column('Backlog').locator('.bc-column__header').boundingBox()
await page.mouse.move(ideasHeader.x + 40, ideasHeader.y + ideasHeader.height / 2)
await page.mouse.down()
await page.mouse.move(backlogHeader.x + 20, backlogHeader.y + 20, { steps: 20 })
await page.mouse.up()
await page.waitForTimeout(900)
check('dragging a list header reorders lists', (await content())[0].title === 'Ideas', (await content()).map((item) => item.title).join(','))

// Drag a card into another list.
// Let the reordered lists settle (server answer and live update) before measuring cards.
await page.waitForFunction(() => document.querySelector('.bc-column .bc-column__title')?.innerText === 'Ideas')
await page.waitForTimeout(800)
// Both lists on screen: a drag that has to scroll the board mid-way is not what people do.
await page.locator('.bc-scroll').evaluate((element) => { element.scrollLeft = 0 })
await column('In progress').locator('.task-card', { hasText: 'First' }).dragTo(column('Ideas'))
{
	let after = await content()
	for (let attempt = 0; attempt < 20 && !after.find((item) => item.title === 'Ideas').tasks.length; attempt++) {
		await page.waitForTimeout(200)
		after = await content()
	}
	check('dragging a card moves it to the other list', after.find((item) => item.title === 'Ideas').tasks.some((task) => task.title === 'First'), after.map((item) => `${item.title}:${item.tasks.map((task) => task.title).join('/')}`).join(' | '))
}

// Member: no list management, but may watch — and hears about new cards.
const memberCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const memberPage = await memberCtx.newPage(); watch(memberPage, 'member')
await memberPage.goto(`${APP}/login`); await uiLogin(memberPage, MEMBER.email, MEMBER.password); await memberPage.waitForURL(/\/workspaces/)
await memberPage.goto(`${APP}/workspaces/${board._id}`); await memberPage.waitForSelector('.bc-column')
const memberColumn = memberPage.locator('.bc-column', { has: memberPage.locator('.bc-column__title', { hasText: 'Ideas' }) })
check('members cannot rename lists', (await memberColumn.locator('.bc-column__title-button').count()) === 0)
check('members cannot add lists', (await memberPage.locator('.bc-add-list').count()) === 0)
await memberColumn.getByRole('button', { name: 'Actions for Ideas' }).click()
await memberPage.waitForSelector('.bc-panel')
check('members see only their actions', (await memberPage.locator('.bc-panel').getByRole('button', { name: 'Copy list' }).count()) === 0 && (await memberPage.locator('.bc-panel').getByRole('button', { name: 'Purple' }).count()) === 0)
await memberPage.locator('.bc-panel').getByRole('button', { name: 'Watch' }).click()
await memberPage.waitForTimeout(600)
check('watching shows an eye on the list', (await memberColumn.locator('.bc-column__watch').count()) === 1)
await owner.call('POST', `/board/columns/${ids.Backlog}/task`, { title: 'Not in Ideas' })
const ideasId = (await content()).find((item) => item.title === 'Ideas')._id
await owner.call('POST', `/board/columns/${ideasId}/task`, { title: 'Watch me' })
const notes = await member.call('GET', '/notifications')
const list = Array.isArray(notes) ? notes : notes.notifications || []
check('the watcher is notified about a new card in that list only', list.filter((note) => note.type === 'list_card_added').length === 1, JSON.stringify(list.map((note) => note.type)))
await memberCtx.close()

// Phone: one list per screen, the menu is a sheet, no folding.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })
const phonePage = await phone.newPage(); watch(phonePage, 'phone')
await phonePage.goto(`${APP}/workspaces/${board._id}`); await phonePage.waitForSelector('.bc-column')
const width = await phonePage.locator('.bc-column').first().evaluate((element) => element.getBoundingClientRect().width)
check('a list nearly fills a phone screen', width > 320 && width < 360, String(width))
check('folding is not offered on phones', !(await phonePage.locator('.bc-column__collapse').first().isVisible()))
await phonePage.locator('.bc-column').first().getByRole('button', { name: /^Actions for/ }).click()
check('list actions open as a sheet', (await phonePage.locator('.bc-sheet').count()) === 1)
check('the page itself does not scroll sideways', await phonePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
await phone.close()

await browser.close(); done()
