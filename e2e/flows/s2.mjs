import { APP, check, done, launch, watch, SHOTS, ALICE_STATE } from '../lib.mjs'
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
await page.locator('.workspace-room', { hasText: boardName }).click()
await page.waitForURL(/\/workspaces\/[a-f0-9]{24}/)
await page.waitForTimeout(1500)
const boardLoads = requests.filter((r) => r.startsWith('GET') && (r.includes('/content') || r.includes('/columns')))
check('opening a board from the overview loads it once', boardLoads.length === 1 && boardLoads[0].endsWith('/content'), boardLoads.join(', '))

for (const name of ['Todo', 'Doing']) {
	await page.getByRole('button', { name: /add column/i }).last().click()
	await page.fill('input[placeholder="Column name"]', name)
	await page.locator('input[placeholder="Column name"]').press('Enter')
	await page.waitForTimeout(700)
}
check('two columns created', (await page.locator('.kanban-column').count()) === 2)

const todo = page.locator('.kanban-column').filter({ hasText: 'Todo' })
await todo.getByRole('button', { name: /add task/i }).click()
await page.fill('input[placeholder="What needs doing?"], textarea[placeholder="What needs doing?"]', 'Ship the audit fixes')
await page.locator('[placeholder="What needs doing?"]').press('Enter')
await page.waitForTimeout(900)
check('task created', (await todo.locator('.task-card').count()) === 1)

// open details, set today's due date, save → only dueDate must be sent
await todo.locator('.task-card').first().click()
await page.waitForSelector('#task-due-date')
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
await page.fill('#task-due-date', today)
const patch = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes('/board/tasks/'))
await page.getByRole('button', { name: 'Save changes' }).click()
const body = JSON.parse((await patch).postData())
check('task save sends only edited fields', JSON.stringify(Object.keys(body)) === '["dueDate"]', JSON.stringify(body))
await page.waitForTimeout(900)
const dueClass = await todo.locator('.task-due-icon').first().getAttribute('class').catch(() => '')
check('card marks a task due today as "today"', dueClass?.includes('today'), dueClass)

// realtime: second tab sees a task created in the first one
const other = await ctx.newPage(); watch(other, 'alice-tab2')
await other.goto(page.url()); await other.waitForTimeout(2000)
await todo.getByRole('button', { name: /add task/i }).click()
await page.fill('[placeholder="What needs doing?"]', 'Realtime check')
await page.locator('[placeholder="What needs doing?"]').press('Enter')
await other.waitForTimeout(1500)
check('second tab receives the new task live', (await other.locator('.task-card', { hasText: 'Realtime check' }).count()) === 1)
await other.close()
await page.screenshot({ path: SHOTS + 'e2e-board.png' })

// assign the task to Alice so it shows up in her calendar
const me = await (await page.request.get('http://localhost:5001/api/auth/get-user')).json()
const taskId = await todo.locator('.task-card', { hasText: 'Ship the audit' }).getAttribute('data-task-id')
const assign = await page.request.patch(`http://localhost:5001/api/board/tasks/${taskId}`, { data: { assignees: [me._id] } })
check('assign task via API', assign.status() === 200)

// switching boards via the sidebar loads each board once and never shows the previous board's columns
const boardUrl = page.url()
await page.request.post('http://localhost:5001/api/board/boards', { data: { name: secondName } })
await page.goto(boardUrl); await page.waitForTimeout(1500)
requests.length = 0
await page.locator('.workspace-room', { hasText: secondName }).click()
await page.waitForURL((url) => url.toString() !== boardUrl)
const leakedColumns = await page.locator('.kanban-column').count()
await page.waitForTimeout(1500)
const contentLoads = requests.filter((r) => r.endsWith('/content'))
check('switching boards loads the new board once', contentLoads.length === 1, contentLoads.join(', '))
check('previous board columns are not shown on the new board', leakedColumns === 0 && (await page.locator('.kanban-column').count()) === 0)
requests.length = 0
await page.goBack(); await page.waitForTimeout(1500)
check('back button returns to the first board with its columns', page.url() === boardUrl && (await page.locator('.kanban-column').count()) === 2)

// calendar shows the task on today's cell
await page.goto(APP + '/calendar'); await page.waitForTimeout(2000)
const dayOfTask = (await page.locator('.calendar-day-cell', { hasText: 'Ship the audit fixes' }).first().locator('span').first().innerText().catch(() => '')).trim()
check('calendar places the task on today', dayOfTask === String(new Date().getDate()), `day ${dayOfTask}`)
await page.goto(APP + '/my-tasks'); await page.waitForTimeout(1500)
check('my tasks loads without error', !(await page.getByText(/could not be loaded/i).count()))

// change password keeps this session alive
await page.goto(APP + '/settings#security'); await page.waitForTimeout(1200)
await page.getByRole('button', { name: /security/i }).first().click().catch(() => {})
await page.getByRole('button', { name: /change password/i }).click()
await page.fill('#security-current', process.env.PW_OLD || 'Password123!')
await page.fill('#security-next', process.env.PW_NEW || 'Password456!')
await page.fill('#security-confirm', process.env.PW_NEW || 'Password456!')
const changed = page.waitForResponse((r) => r.url().includes('/auth/change-password'))
await page.locator('form.security-password-form button[type=submit]').click()
check('change password succeeds', (await changed).status() === 200)
await page.goto(APP + '/my-tasks'); await page.waitForTimeout(1500)
check('session survives the password change', page.url().endsWith('/my-tasks'), page.url())
await ctx.storageState({ path: ALICE_STATE })
await browser.close(); done()
