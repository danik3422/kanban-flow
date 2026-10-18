import fs from 'node:fs'
import { APP, check, done, launch, watch, SHOTS, ALICE_STATE, ALICE_LOGIN } from '../lib.mjs'
const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, storageState: ALICE_STATE })
const page = await ctx.newPage(); watch(page, 'alice')
const requests = []
page.on('request', (r) => { if (r.url().includes('/api/')) requests.push(`${r.method()} ${new URL(r.url()).pathname}`) })
const boardName = `E2E ${Date.now()}`
const secondName = `Second ${Date.now()}`
await page.request.post('http://localhost:5001/api/board/boards', { data: { name: boardName } })
await page.goto(APP + '/workspaces')
await page.waitForTimeout(1500)
requests.length = 0
await page.locator('.board-card__open', { hasText: boardName }).click()
await page.waitForURL(/\/workspaces\/[a-f0-9]{24}/)
await page.waitForTimeout(1500)
const boardLoads = requests.filter((r) => r.startsWith('GET') && (r.includes('/content') || r.includes('/columns')))
check('opening a board from the overview loads it once', boardLoads.length === 1 && boardLoads[0].endsWith('/content'), boardLoads.join(', '))

// The list composer stays open after Enter, so both lists go in one go.
await page.locator('.bc-add-list').click()
for (const name of ['Todo', 'Doing']) {
	await page.fill('.bc-list-composer input', name)
	await page.locator('.bc-list-composer input').press('Enter')
	await page.waitForTimeout(700)
}
await page.keyboard.press('Escape')
check('two columns created', (await page.locator('.bc-column').count()) === 2)

const todo = page.locator('.bc-column').filter({ hasText: 'Todo' })
const addCard = async (title) => {
	if (!(await todo.locator('.bc-composer__input').count())) await todo.locator('.bc-add-card').click()
	await todo.locator('.bc-composer__input').fill(title)
	await todo.locator('.bc-composer__input').press('Enter')
}
await addCard('Ship the audit fixes')
await page.waitForTimeout(900)
check('task created', (await todo.locator('.task-card').count()) === 1)

// open the card, pick today in the dates panel → only the dates are sent
await todo.locator('.task-card').first().click()
await page.waitForSelector('.cm-modal')
await page.getByRole('button', { name: 'Dates', exact: true }).click()
await page.locator('.cp').getByRole('button', { name: 'Today', exact: true }).click()
const patch = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes('/board/tasks/'))
await page.locator('.cp').getByRole('button', { name: 'Save', exact: true }).click()
const body = JSON.parse((await patch).postData())
check('task save sends only the dates', Object.keys(body).every((key) => ['dueDate', 'startDate'].includes(key)) && Boolean(body.dueDate), JSON.stringify(body))
await page.waitForTimeout(900)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
check('card marks a task due today as "today"', (await todo.locator('.ct-due--today').count()) === 1)

// realtime: second tab sees a task created in the first one
const other = await ctx.newPage(); watch(other, 'alice-tab2')
await other.goto(page.url()); await other.waitForTimeout(2000)
await addCard('Realtime check')
await other.waitForTimeout(1500)
check('second tab receives the new task live', (await other.locator('.task-card', { hasText: 'Realtime check' }).count()) === 1)
await other.close()
await page.screenshot({ path: SHOTS + 'e2e-board.png' })

// assign the task to Alice so it shows up in her calendar
const me = await (await page.request.get('http://localhost:5001/api/auth/get-user')).json()
const taskId = await todo.locator('.task-card', { hasText: 'Ship the audit' }).getAttribute('data-task-id')
const assign = await page.request.patch(`http://localhost:5001/api/board/tasks/${taskId}`, { data: { assignees: [me._id] } })
check('assign task via API', assign.status() === 200)

// switching boards loads each board once and never shows the previous board's columns
const boardUrl = page.url()
await page.request.post('http://localhost:5001/api/board/boards', { data: { name: secondName } })
await page.goto(boardUrl); await page.waitForTimeout(1500)
requests.length = 0
// Switch through the quick switcher, which changes the URL directly. Every frame is sampled:
// the new board's title must never appear next to the previous board's columns.
await page.evaluate(() => {
	window.__frames = []
	const start = performance.now()
	const tick = () => {
		window.__frames.push({ title: document.querySelector('.app-topbar__context')?.innerText || '', columns: document.querySelectorAll('.bc-column').length })
		if (performance.now() - start < 2500) requestAnimationFrame(tick)
	}
	requestAnimationFrame(tick)
})
await page.keyboard.press('Control+k')
await page.locator('.quick-switcher input').fill(secondName)
await page.keyboard.press('Enter')
await page.waitForURL((url) => url.toString() !== boardUrl)
await page.waitForTimeout(1500)
const contentLoads = requests.filter((r) => r.endsWith('/content'))
check('switching boards loads the new board once', contentLoads.length === 1, contentLoads.join(', '))
const frames = await page.evaluate(() => window.__frames)
const leakedFrames = frames.filter((frame) => frame.title.includes(secondName) && frame.columns > 0)
check('previous board columns are never shown under the new board', leakedFrames.length === 0 && frames.some((frame) => frame.title.includes(secondName)), `${leakedFrames.length} leaked of ${frames.length} frames`)
requests.length = 0
await page.goBack(); await page.waitForTimeout(1500)
check('back button returns to the first board with its columns', page.url() === boardUrl && (await page.locator('.bc-column').count()) === 2)

// calendar shows the task on today's cell
await page.goto(APP + '/calendar'); await page.waitForTimeout(2000)
const todayKey = new Date().toLocaleDateString('sv-SE')
const dayOfTask = await page.locator('.cal-cell', { has: page.locator('.cal-chip', { hasText: 'Ship the audit fixes' }) }).first().locator('.cal-cell__day').getAttribute('data-day').catch(() => '')
check('calendar places the task on today', dayOfTask === todayKey, `day ${dayOfTask}`)
await page.goto(APP + '/my-tasks'); await page.waitForTimeout(1500)
check('my tasks loads without error', !(await page.getByText(/could not be loaded/i).count()))

// change password keeps this session alive
await page.goto(APP + '/settings#security'); await page.waitForSelector('[data-action=password]')
await page.click('[data-action=password]')
await page.fill('#st-password-current', process.env.PW_OLD || 'Password123!')
await page.fill('#st-password-next', process.env.PW_NEW || 'Password456!')
await page.fill('#st-password-repeat', process.env.PW_NEW || 'Password456!')
const changed = page.waitForResponse((r) => r.url().includes('/auth/change-password'))
await page.click('button[form=st-password-form]')
check('change password succeeds', (await changed).status() === 200)
await page.goto(APP + '/my-tasks'); await page.waitForTimeout(1500)
check('session survives the password change', page.url().endsWith('/my-tasks'), page.url())
await ctx.storageState({ path: ALICE_STATE })
fs.writeFileSync(ALICE_LOGIN, JSON.stringify({ ...JSON.parse(fs.readFileSync(ALICE_LOGIN, 'utf8')), password: process.env.PW_NEW || 'Password456!' }))
await browser.close(); done()
