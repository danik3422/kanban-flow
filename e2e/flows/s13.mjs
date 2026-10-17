// Calendar: tasks on their days, Mine/All, drag to reschedule (with undo), keyboard
// moves between days, adding a task on a date, ticking done, months and phones.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `cal-${stamp}@example.com`, password: 'Password123!', name: 'Cal Owner' }
const MATE = { email: `cal-mate-${stamp}@example.com`, password: 'Password123!', name: 'Cal Mate' }
const me = await createVerifiedUser(ME, 'Lead')
const mate = await createVerifiedUser(MATE, 'Dev')
await me.call('PATCH', '/auth/settings', { language: 'en' })

const now = new Date()
const key = (day) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const board = await me.call('POST', '/board/boards', { name: 'Planner' })
const invite = await me.call('POST', `/board/boards/${board._id}/invites`, { email: MATE.email, role: 'member' })
await mate.call('POST', `/board/invites/${new URL(invite.inviteUrl).pathname.split('/').pop()}/accept`)
const todo = await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'To do', position: 0 })
const finished = await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'Done', position: 1 })
const mine = await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Write the plan', dueDate: key(10), assignees: [me.id], priority: 'urgent' })
await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Theirs only', dueDate: key(12), assignees: [mate.id] })

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/calendar`); await page.waitForSelector('.cal-grid'); await page.waitForTimeout(1200)

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(now)
check('the month title is in the interface language', (await page.locator('.cal-title').innerText()) === `${monthName} ${now.getFullYear()}`)
// The app's English is British English (en-GB), where weeks start on Monday.
check('weeks start on the locale\'s first day', (await page.locator('.cal-grid__weekday').first().innerText()) === 'Mon')
const cell = (day) => page.locator(`.cal-cell:has([data-day="${key(day)}"])`)
check('my task sits on its day', (await cell(10).locator('.cal-chip', { hasText: 'Write the plan' }).count()) === 1)
check('Mine hides tasks assigned to others', (await cell(12).locator('.cal-chip').count()) === 0)
await page.getByRole('radio', { name: 'All' }).click(); await page.waitForTimeout(1000)
check('All shows the whole board', (await cell(12).locator('.cal-chip', { hasText: 'Theirs only' }).count()) === 1)
await page.getByRole('radio', { name: 'Mine' }).click(); await page.waitForTimeout(1000)

// Selecting a day lists its tasks beside the grid; arrows move between days.
await cell(10).locator('.cal-cell__day').click()
check('the day panel lists the chosen day', (await page.locator('.cal-day').innerText()).includes('Write the plan'))
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(200)
check('arrow keys move to the next day', await page.evaluate((target) => document.activeElement?.dataset.day === target, key(11)))
await page.keyboard.press('ArrowLeft')

// Drag to reschedule, then undo.
await cell(10).locator('.cal-chip', { hasText: 'Write the plan' }).dragTo(cell(14))
await page.waitForTimeout(900)
const moved = (await me.call('GET', '/board/my-tasks')).find((task) => task._id === mine._id)
check('dragging a task to another day reschedules it', moved.dueDate.startsWith(key(14)), moved.dueDate)
await page.getByRole('button', { name: 'Undo' }).click()
await page.waitForTimeout(900)
const restored = (await me.call('GET', '/board/my-tasks')).find((task) => task._id === mine._id)
check('undo puts the date back', restored.dueDate.startsWith(key(10)), restored.dueDate)

// Add a task on the chosen day.
await cell(20).locator('.cal-cell__day').click()
await page.locator('.cal-day__head button').click()
await page.fill('#cal-task-title', 'Book the venue')
check('the new task starts on the chosen date', (await page.inputValue('#cal-task-due')) === key(20))
await page.click('button[form="quick-create-task"]')
await page.waitForTimeout(1200)
const created = (await me.call('GET', '/board/my-tasks')).find((task) => task.title === 'Book the venue')
check('the task is created on that date and assigned to me', Boolean(created) && created.dueDate.startsWith(key(20)))
check('it appears on the calendar right away', (await cell(20).locator('.cal-chip', { hasText: 'Book the venue' }).count()) === 1)

// Tick done from the day panel.
await page.locator('.cal-day .mt-row', { hasText: 'Book the venue' }).locator('.mt-row__check').click()
await page.waitForTimeout(900)
const ticked = (await me.call('GET', '/board/my-tasks')).find((task) => task.title === 'Book the venue')
check('ticking done moves it to Done', ticked.isDone && ticked.column._id === finished._id)

// Months.
await page.getByRole('button', { name: 'Next month' }).click(); await page.waitForTimeout(900)
check('the next month has no tasks of this one', (await page.locator('.cal-chip', { hasText: 'Write the plan' }).count()) === 0)
await page.getByRole('button', { name: 'Today', exact: true }).click(); await page.waitForTimeout(900)
check('Today returns to the current month', (await page.locator('.cal-title').innerText()).startsWith(monthName))

// Phone: dots in the grid, "+" adds a task on the selected day.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storageState: await ctx.storageState() })
const mobile = await phone.newPage(); watch(mobile, 'phone')
await mobile.goto(`${APP}/calendar`); await mobile.waitForSelector('.cal-grid'); await mobile.waitForTimeout(1200)
check('phones show dots instead of task chips', (await mobile.locator(`.cal-cell:has([data-day="${key(10)}"]) .cal-cell__dots i`).count()) >= 1 && !(await mobile.isVisible('.cal-chip')))
await mobile.locator(`[data-day="${key(10)}"]`).tap()
check('the chosen day lists its tasks below the grid', (await mobile.locator('.cal-day').innerText()).includes('Write the plan'))
await mobile.locator('.app-bottom-nav__primary').tap()
await mobile.waitForSelector('#cal-task-title')
check('"+" on the phone adds a task on the selected day', (await mobile.inputValue('#cal-task-due')) === key(10))
await phone.close()

await browser.close(); done()
