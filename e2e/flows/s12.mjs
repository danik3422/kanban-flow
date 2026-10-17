// My tasks: sections by due date, status chips, ticking a task done (and undo),
// boards without a Done column, opening a task, quick due/priority edits, filters.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `mytasks-${stamp}@example.com`, password: 'Password123!', name: 'Tia Tasks' }
const me = await createVerifiedUser(ME, 'Lead')
await me.call('PATCH', '/auth/settings', { language: 'en' })
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)

const launchBoard = await me.call('POST', '/board/boards', { name: 'Launch' })
const todo = await me.call('POST', `/board/boards/${launchBoard._id}/columns`, { title: 'To do', position: 0 })
const finished = await me.call('POST', `/board/boards/${launchBoard._id}/columns`, { title: 'Done', position: 1 })
const late = await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Late report', dueDate: day(-3), assignees: [me.id], priority: 'high' })
await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Call the printer', dueDate: day(0), assignees: [me.id] })
await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Someday idea', assignees: [me.id] })
await me.call('POST', `/board/columns/${finished._id}/task`, { title: 'Shipped thing', dueDate: day(-5), assignees: [me.id] })
const notes = await me.call('POST', '/board/boards', { name: 'Notes' })
const only = await me.call('POST', `/board/boards/${notes._id}/columns`, { title: 'Inbox', position: 0 })
await me.call('POST', `/board/columns/${only._id}/task`, { title: 'Loose note', assignees: [me.id] })

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/my-tasks`); await page.waitForSelector('.mt-row:not(.is-loading)')

const row = (title) => page.locator('.mt-row', { hasText: title })
const sectionOf = async (title) => (await row(title).locator('xpath=ancestor::section[1]').locator('.mt-section__title').innerText().catch(() => '')).split('\n')[0]
check('overdue tasks lead the list', (await page.locator('.mt-section').first().innerText()).startsWith('Overdue'))
check('tasks sit under their due sections', (await sectionOf('Late report')).startsWith('Overdue') && (await sectionOf('Call the printer')).startsWith('Today') && (await sectionOf('Someday idea')).startsWith('No date'))
check('finished work is tucked away', !(await row('Shipped thing').isVisible()) && (await page.locator('.mt-done-toggle').innerText()).includes('1'))
const chipText = await page.locator('.mt-chips').innerText()
check('chips count open, overdue and done', /Open\s*4/.test(chipText) && /Overdue\s*1/.test(chipText) && /Done\s*1/.test(chipText), chipText.replace(/\s+/g, ' '))
check('a board without a Done column cannot be ticked from here', await row('Loose note').locator('.mt-row__check').isDisabled())

// Tick done, then undo from the toast.
await row('Late report').locator('.mt-row__check').click()
await page.waitForTimeout(800)
const afterDone = (await me.call('GET', '/board/my-tasks')).find((task) => task._id === late._id)
check('ticking moves the task to the board\'s Done column', afterDone.isDone === true && afterDone.column._id === finished._id)
check('the sidebar count drops right away', (await page.locator('.app-sidebar__link[href="/my-tasks"] .app-sidebar__count').innerText()) === '3')
await page.getByRole('button', { name: 'Undo' }).click()
await page.waitForTimeout(800)
const afterUndo = (await me.call('GET', '/board/my-tasks')).find((task) => task._id === late._id)
check('undo puts it back where it was', afterUndo.isDone === false && afterUndo.column._id === todo._id)

// Quick edits with the mouse.
await row('Someday idea').hover()
await row('Someday idea').getByRole('button', { name: 'Due date' }).click()
await page.getByRole('menuitem', { name: 'Tomorrow' }).click()
await page.waitForTimeout(700)
check('due date set from the list', (await sectionOf('Someday idea')).startsWith('Tomorrow'))
await row('Someday idea').hover()
await row('Someday idea').getByRole('button', { name: 'Priority' }).click()
await page.getByRole('menuitemradio', { name: 'Urgent' }).click()
await page.waitForTimeout(700)
check('priority set from the list', (await row('Someday idea').innerText()).includes('Urgent'))

// Chips and search.
await page.locator('.mt-chips').getByRole('button', { name: /Overdue/ }).click()
check('the Overdue chip shows only overdue work', (await page.locator('.mt-row').count()) === 1 && (await row('Late report').isVisible()))
await page.locator('.mt-chips').getByRole('button', { name: /Done/ }).click()
check('the Done chip lists finished work', await row('Shipped thing').isVisible())
await page.locator('.mt-chips').getByRole('button', { name: /Open/ }).click()
await page.keyboard.press('/')
await page.keyboard.type('printer')
await page.waitForTimeout(800)
check('search narrows the list', (await page.locator('.mt-row').count()) === 1 && (await row('Call the printer').isVisible()))
await page.locator('.mt-toolbar input').fill('')
await page.waitForTimeout(800)

// Opening a task goes straight to it on its board.
await row('Call the printer').locator('.mt-row__main').click()
await page.waitForURL(new RegExp(`/workspaces/${launchBoard._id}`))
await page.waitForTimeout(1500)
check('opening a task shows it on its board', await page.getByText('Call the printer').first().isVisible() && (await page.locator('.modal-backdrop, [role=dialog]').count()) > 0)

// Phone: filters live in a sheet.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storageState: await ctx.storageState() })
const mobile = await phone.newPage(); watch(mobile, 'phone')
await mobile.goto(`${APP}/my-tasks`); await mobile.waitForSelector('.mt-row:not(.is-loading)')
check('phones hide the filter selects behind a button', !(await mobile.isVisible('.mt-toolbar__selects')) && (await mobile.isVisible('.mt-toolbar__sheet-trigger button')))
await mobile.locator('.mt-toolbar__sheet-trigger button').tap()
await mobile.locator('#mt-sheet-board').selectOption({ label: 'Notes' })
await mobile.getByRole('button', { name: 'Show tasks' }).tap()
await mobile.waitForTimeout(900)
check('the board filter applies from the sheet', (await mobile.locator('.mt-row').count()) === 1 && (await mobile.locator('.mt-toolbar__dot').count()) === 1)
await phone.close()

await browser.close(); done()
