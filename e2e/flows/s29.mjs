// Working without a connection: cards created, completed, moved, commented and archived
// offline are kept on the device, shown as not sent yet, and reach the server once —
// in order, with the new card's temporary id replaced — as soon as the connection is back.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `offline-${stamp}@example.com`, password: 'Password123!', name: 'Otto Offline' }
const me = await createVerifiedUser(ME, 'Field engineer')
await me.call('PATCH', '/auth/settings', { language: 'en' })
const board = await me.call('POST', '/board/boards', { name: 'Subway' })
const todo = await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'To do', position: 0 })
await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'Doing', position: 1 })
await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'Done', position: 2 })
for (const title of ['Alpha', 'Bravo', 'Charlie']) await me.call('POST', `/board/columns/${todo._id}/task`, { title })
const content = async () => (await me.call('GET', `/board/boards/${board._id}/content`)).flatMap((column) => column.tasks.map((task) => ({ ...task, list: column.title })))

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/workspaces/${board._id}`); await page.waitForSelector('.task-card.ct'); await page.waitForTimeout(1200)
const card = (title) => page.locator('.bc-board .task-card.ct', { hasText: title }).first()

await ctx.setOffline(true); await page.waitForTimeout(300)
check('without a connection a strip says so', (await page.locator('.offline-banner--inline').count()) === 1)

await page.locator('.bc-column', { hasText: 'To do' }).getByRole('button', { name: /Add a card/ }).first().click()
await page.keyboard.type('Made offline'); await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.keyboard.press('Escape')
check('a card can be added offline and shows as not sent yet', (await card('Made offline').count()) === 1 && (await card('Made offline').locator('.ct-pending').count()) === 1)
await card('Made offline').hover(); await page.keyboard.press('c'); await page.waitForTimeout(300)
await card('Alpha').hover(); await page.keyboard.press('c'); await page.waitForTimeout(300)
const from = await card('Bravo').boundingBox(); const doing = await page.locator('.bc-board > .bc-column').nth(1).boundingBox()
await page.mouse.move(from.x + 40, from.y + 20); await page.mouse.down(); await page.mouse.move(from.x + 60, from.y + 30, { steps: 4 })
await page.mouse.move(doing.x + doing.width / 2, doing.y + 100, { steps: 15 }); await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(400)
await card('Charlie').click(); await page.waitForTimeout(600)
await page.locator('.cc__composer textarea').fill('Typed underground'); await page.locator('.cc__composer textarea').press('Control+Enter'); await page.waitForTimeout(400)
check('a comment written offline shows as not sent yet', (await page.locator('.cc__pending').count()) === 1)
await page.keyboard.press('Escape'); await page.waitForTimeout(300)
const banner = await page.locator('.offline-banner--inline').innerText()
check('the strip counts what waits to be sent', /5 changes/.test(banner), banner)
check('nothing reached the server yet', !(await content()).some((task) => task.title === 'Made offline'))

await ctx.setOffline(false); await page.waitForTimeout(5000)
const tasks = await content()
check('the offline card reached the server once, completed', tasks.filter((task) => task.title === 'Made offline').length === 1 && tasks.find((task) => task.title === 'Made offline').completed)
check('the completion and the move were saved', tasks.find((task) => task.title === 'Alpha').completed && tasks.find((task) => task.title === 'Bravo').list === 'Doing')
const charlie = tasks.find((task) => task.title === 'Charlie')
const comments = (await me.call('GET', `/board/tasks/${charlie._id}/activities`)).filter((item) => item.type === 'comment' && item.message === 'Typed underground')
check('the comment was saved once', comments.length === 1)
check('the strip and the "not sent" marks are gone', (await page.locator('.offline-banner--inline').count()) === 0 && (await page.locator('.ct-pending').count()) === 0)
check('a toast says everything was saved', (await page.locator('[data-sonner-toast]').allInnerTexts()).some((text) => /All 5 changes saved/.test(text)))

await browser.close(); done()
