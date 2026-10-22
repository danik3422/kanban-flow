// Board automation: a rule made from an idea answers a card dragged into "Done" for
// everyone at once; a scheduled rule creates a card when run by hand; a switched-off
// rule stays quiet; the editor points at what is missing; it fits a phone.
import { APP, check, createVerifiedUser, done, launch, SHOTS, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `rules-${stamp}@example.com`, password: 'Password123!', name: 'Rita Rules' }
const MATE = { email: `rules-mate-${stamp}@example.com`, password: 'Password123!', name: 'Max Mate' }
const me = await createVerifiedUser(ME, 'Lead')
const mate = await createVerifiedUser(MATE, 'Engineer')
for (const user of [me, mate]) await user.call('PATCH', '/auth/settings', { language: 'ru' })
const board = await me.call('POST', '/board/boards', { name: 'Автоматика' })
const todo = await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'К выполнению', position: 0 })
await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'В работе', position: 1 })
const doneList = await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'Готово', position: 2 })
await me.call('POST', `/board/boards/${board._id}/labels`, { name: 'Сделано', color: 'green' })
for (const title of ['Первая', 'Вторая', 'Третья']) await me.call('POST', `/board/columns/${todo._id}/task`, { title })
const invite = await me.call('POST', `/board/boards/${board._id}/invites`, { email: MATE.email, role: 'member' })
await mate.call('POST', `/board/invites/${new URL(invite.inviteUrl).pathname.split('/').pop()}/accept`)
const content = async () => (await me.call('GET', `/board/boards/${board._id}/content`)).flatMap((column) => column.tasks.map((task) => ({ ...task, list: column.title })))
const cardOf = async (title) => (await content()).find((task) => task.title === title)

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/workspaces/${board._id}`); await page.waitForSelector('.task-card.ct'); await page.waitForTimeout(800)

const mateCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const matePage = await mateCtx.newPage(); watch(matePage, 'mate')
await matePage.goto(`${APP}/login`); await uiLogin(matePage, MATE.email, MATE.password); await matePage.waitForURL(/\/workspaces/)
await matePage.goto(`${APP}/workspaces/${board._id}`); await matePage.waitForSelector('.task-card.ct'); await matePage.waitForTimeout(800)

const openAutomation = async (target) => {
	await target.locator('.bh-actions .bh-menu').click(); await target.waitForSelector('.bh-menu-body')
	await target.locator('.bh-menu-item', { hasText: 'Автоматизация' }).click()
	await target.waitForSelector('.am-modal .am-list')
}
await openAutomation(page)
check('the board menu opens automation with an empty state and ideas', (await page.locator('.am-modal .ui-empty').count()) === 1 && (await page.locator('.am-idea').count()) === 6)
await page.screenshot({ path: `${SHOTS}s31-empty.png` })
await openAutomation(matePage)

// From an idea: in "Готово" means complete; add a label too.
await page.locator('.am-idea', { hasText: 'В «Готово» — значит выполнено' }).click()
await page.waitForSelector('.am-editor')
check('an idea opens filled in: trigger, list and action', (await page.locator('.am-editor select').first().inputValue()) === 'card_added' && (await page.locator('.am-action').count()) === 1)
await page.getByRole('button', { name: 'Добавить действие' }).click()
await page.locator('.am-action').nth(1).locator('.am-action__type').selectOption('add_label')
await page.screenshot({ path: `${SHOTS}s31-editor.png` })
await page.getByRole('button', { name: 'Сохранить правило' }).click()
await page.waitForSelector('.am-rule')
const sentence = await page.locator('.am-rule__text').first().innerText()
check('the saved rule reads as a sentence', sentence.replace(/\s+/g, ' ') === 'Когда карточку добавляют в «Готово» → отметить выполненной, добавить метку «Сделано»', sentence)
check('the used idea leaves the list of ideas', (await page.locator('.am-idea', { hasText: 'значит выполнено' }).count()) === 0)
await matePage.waitForSelector('.am-rule', { timeout: 5000 }).catch(() => {})
check('a teammate with the dialog open sees the new rule at once', (await matePage.locator('.am-rule').count()) === 1)
await matePage.keyboard.press('Escape')
await page.keyboard.press('Escape'); await page.waitForTimeout(300)

// Drag a card into Готово: the rule completes and labels it, for both people.
const dragTo = async (title, listIndex) => {
	const from = await page.locator('.bc-board .task-card.ct', { hasText: title }).first().boundingBox()
	const to = await page.locator('.bc-board > .bc-column').nth(listIndex).boundingBox()
	await page.mouse.move(from.x + 40, from.y + 20); await page.mouse.down(); await page.mouse.move(from.x + 60, from.y + 30, { steps: 4 })
	await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 }); await page.waitForTimeout(200); await page.mouse.up()
}
await dragTo('Первая', 2)
await page.waitForFunction(() => [...document.querySelectorAll('.bc-board > .bc-column')][2]?.innerText.includes('Сделано'), null, { timeout: 8000 }).catch(() => {})
const first = await cardOf('Первая')
check('the rule completed and labelled the dragged card', first.list === 'Готово' && first.completed === true && first.labels.includes('Сделано'), JSON.stringify({ list: first.list, completed: first.completed, labels: first.labels }))
const myCard = page.locator('.bc-board > .bc-column').nth(2).locator('.task-card.ct', { hasText: 'Первая' })
check('the board shows it without a reload', (await myCard.innerText()).includes('Сделано'))
await matePage.waitForFunction(() => [...document.querySelectorAll('.bc-board > .bc-column')][2]?.innerText.includes('Сделано'), null, { timeout: 8000 }).catch(() => {})
check('the teammate sees the rule’s changes live', (await matePage.locator('.bc-board > .bc-column').nth(2).locator('.task-card.ct', { hasText: 'Первая' }).innerText()).includes('Сделано'))

await myCard.click(); await page.getByRole('button', { name: 'Показать активность' }).click()
await page.waitForSelector('.cc__event'); await page.waitForTimeout(300)
const history = await page.locator('.cc__list').innerText().catch(() => '')
check('the card’s history says which rule changed it', history.includes('автоматизация «В «Готово» — значит выполнено»: отметка «выполнено», метка'), history.slice(0, 300))
await page.screenshot({ path: `${SHOTS}s31-history.png` })
await page.keyboard.press('Escape'); await page.waitForTimeout(300)

// A scheduled rule, made from scratch and run by hand.
await openAutomation(page)
await page.locator('.am-modal').getByRole('button', { name: 'По расписанию' }).click()
await page.waitForSelector('.am-editor')
await page.getByRole('button', { name: 'Сохранить правило' }).click()
check('the editor points at what is missing instead of saving', (await page.locator('.am-error').count()) >= 1 && (await page.locator('.am-editor').count()) === 1)
await page.locator('.am-action').first().getByPlaceholder('Планёрка {date}').fill('Планёрка {date}')
await page.locator('.am-editor input[maxlength="80"]').fill('Утро')
await page.getByRole('button', { name: 'Сохранить правило' }).click()
await page.waitForSelector('.am-rule[data-rule] >> text=Утро')
const scheduleRow = page.locator('.am-rule', { hasText: 'Утро' })
check('the scheduled rule shows its next run', /Следующий запуск/.test(await scheduleRow.innerText()), await scheduleRow.innerText())
await scheduleRow.getByRole('button', { name: 'Действия с правилом' }).click()
await page.getByRole('menuitem', { name: 'Запустить сейчас' }).click()
await page.waitForFunction(() => document.querySelector('.bc-board')?.innerText.includes('Планёрка'), null, { timeout: 8000 }).catch(() => {})
check('“Run now” creates the card on the board, live', (await page.locator('.bc-board .task-card.ct', { hasText: 'Планёрка' }).count()) === 1)
check('…with today in its title', /Планёрка \d+ \S+/.test(await page.locator('.bc-board .task-card.ct', { hasText: 'Планёрка' }).innerText()))
check('the run is counted', /Сработало 1 раз/.test(await scheduleRow.innerText()))
await page.screenshot({ path: `${SHOTS}s31-list.png` })

// Switch the card rule off: a card dragged into Готово is left alone.
const cardRow = page.locator('.am-rule', { hasText: 'значит выполнено' })
await cardRow.getByRole('switch').click(); await page.waitForTimeout(500)
check('a rule can be switched off', (await cardRow.getAttribute('class')).includes('is-off'))
await page.keyboard.press('Escape'); await page.waitForTimeout(300)
await dragTo('Вторая', 2); await page.waitForTimeout(2000)
const second = await cardOf('Вторая')
check('a switched-off rule does nothing', second.list === 'Готово' && !second.completed && !second.labels.includes('Сделано'))

// The teammate cannot change a rule they did not make.
await openAutomation(matePage)
await matePage.waitForFunction(() => document.querySelectorAll('.am-rule').length === 2, null, { timeout: 5000 }).catch(() => {})
const mateRules = await matePage.locator('.am-rule').count()
const mateMenus = await matePage.getByRole('button', { name: 'Действия с правилом' }).count()
check('a member sees others’ rules without the menu to change them', mateRules === 2 && mateMenus === 0, `rules ${mateRules}, menus ${mateMenus}`)
await matePage.keyboard.press('Escape')

// Phone.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: await ctx.storageState() })
const mobile = await phone.newPage(); watch(mobile, 'phone')
await mobile.goto(`${APP}/workspaces/${board._id}`); await mobile.waitForTimeout(1500)
await mobile.locator('.bh-menu').first().click(); await mobile.waitForSelector('.bh-menu-body')
await mobile.screenshot({ path: `${SHOTS}s31-phone-menu.png` })
await mobile.locator('.bh-menu-item', { hasText: 'Автоматизация' }).click(); await mobile.waitForSelector('.am-rule')
// Sideways scrolling: the page itself, or the dialog's scrolling body.
const overflow = async () => mobile.evaluate(() => {
	const body = document.querySelector('.am-modal .ui-modal__body')
	const modal = document.querySelector('.am-modal')
	return Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, body.scrollWidth - body.clientWidth, modal.getBoundingClientRect().right - window.innerWidth, ...[...document.querySelectorAll('.am-modal .am-rule, .am-modal .am-block, .am-modal .am-action, .am-modal .ui-modal__footer .ui-btn')].map((node) => node.getBoundingClientRect().right - body.getBoundingClientRect().right))
})
const listOverflow = await overflow()
check('on a phone the rules list does not scroll sideways', listOverflow <= 0, `${listOverflow}px`)
await mobile.screenshot({ path: `${SHOTS}s31-phone-list.png` })
await mobile.locator('.am-modal').getByRole('button', { name: 'Новое правило' }).click(); await mobile.waitForSelector('.am-editor')
await mobile.locator('.am-editor select').first().selectOption('schedule'); await mobile.waitForTimeout(200)
await mobile.locator('.am-editor select').nth(1).selectOption('weekly'); await mobile.waitForTimeout(200)
const editorOverflow = await overflow()
check('on a phone the editor does not scroll sideways', editorOverflow <= 0, `${editorOverflow}px`)
await mobile.screenshot({ path: `${SHOTS}s31-phone-editor.png`, fullPage: false })

// Delete.
await page.goto(`${APP}/workspaces/${board._id}`); await page.waitForSelector('.task-card.ct')
await openAutomation(page)
await page.locator('.am-rule', { hasText: 'Утро' }).getByRole('button', { name: 'Действия с правилом' }).click()
await page.getByRole('menuitem', { name: 'Удалить' }).click()
await page.getByRole('dialog', { name: 'Удалить правило?' }).getByRole('button', { name: 'Удалить' }).click()
await page.waitForTimeout(500)
check('a rule can be deleted', (await page.locator('.am-rule').count()) === 1)

await browser.close()
done()
