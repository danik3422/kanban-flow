// The user guide: open to everyone, in every language; search, progress that survives a
// reload, and the live examples (rules, repeats, keys in another layout) work in the page;
// the app links to it from the account menu and the tips, and "Try it" opens the right place.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const browser = await launch()
const guest = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await guest.addInitScript(() => localStorage.setItem('kanban-language', 'ru'))
const page = await guest.newPage(); watch(page, 'guest')
await page.goto(`${APP}/`); await page.waitForSelector('.site-header')
await page.locator('.site-header').getByRole('link', { name: 'Гайд' }).click()
await page.waitForURL(/\/guide$/); await page.waitForSelector('.gd-section')
check('the guide opens from the site header without an account', (await page.locator('h1').innerText()) === 'Как пользоваться KanbanHub')
check('it has every section and the questions', (await page.locator('.gd-section').count()) === 12 && (await page.locator('.gd-faq__item').count()) === 7)
check('the page title is the guide’s', (await page.title()).startsWith('Как пользоваться KanbanHub'))

await page.getByRole('searchbox').fill('архив')
check('search narrows the sections', (await page.locator('.gd-section').count()) < 12 && /Найдено/.test(await page.locator('.gd-search__count').innerText()))
await page.getByRole('searchbox').fill('жираф')
check('search says when nothing is found', (await page.locator('.gd-section').count()) === 0 && (await page.locator('.gd-search__count').innerText()).startsWith('Ничего'))
await page.getByRole('button', { name: 'Очистить поиск' }).click()

const progress = page.locator('.gd-progress__text')
await page.locator('#start').getByRole('button', { name: 'Понятно, дальше' }).click()
await page.locator('#cards').getByRole('button', { name: 'Понятно, дальше' }).click()
await progress.filter({ hasText: 'Прочитано 2 из 12' }).waitFor()
check('marking sections read moves the progress', (await progress.innerText()) === 'Прочитано 2 из 12')
await page.reload(); await page.waitForSelector('.gd-section')
check('progress survives a reload', (await page.locator('.gd-progress__text').innerText()) === 'Прочитано 2 из 12' && (await page.locator('.doc-toc a.is-read').count()) === 2)

const report = page.locator('.gd-rules__card', { hasText: 'Подготовить отчёт' })
await report.getByRole('button', { name: /вправо/ }).click()
await report.getByRole('button', { name: /вправо/ }).click()
const doneList = await page.locator('.gd-rules__column').nth(2).innerText()
check('the automation example runs its rules', doneList.includes('Подготовить отчёт') && doneList.includes('Сделано') && (await page.locator('.gd-rules__line.is-rule').count()) === 1)
await page.locator('.gd-rules__card', { hasText: 'Обновить сайт' }).getByRole('button', { name: /выполненной/ }).click()
check('a completed card is filed into Готово by the second rule', (await page.locator('.gd-rules__column').nth(2).innerText()).includes('Обновить сайт'))

await page.locator('#repeat .ui-segmented').getByRole('radio', { name: 'По будням' }).click()
const dates = (await page.locator('.gd-repeat__dates').innerText()).split('\n')
check('the repeat example lists weekdays only', dates.length === 6 && dates.every((date) => !/^(Сб|Вс)/.test(date)), dates.join(' | '))

await page.locator('.gd-keys__pad').click()
await page.locator('.gd-keys__pad').dispatchEvent('keydown', { key: 'ф', code: 'KeyF', bubbles: true })
const pad = await page.locator('.gd-keys__pad').innerText()
check('a key typed in a Cyrillic layout still counts', pad.includes('Фильтр карточек') && pad.includes('«ф»'), pad.replace(/\n/g, ' | '))

await page.locator('#calendarSync').getByRole('tab', { name: 'Outlook' }).click()
check('the calendar steps switch per app', (await page.locator('#calendarSync .gd-apps__steps').innerText()).includes('Из Интернета'))
check('a guest is offered an account instead of “Try it”', (await page.locator('#settings .gd-try__guest').count()) === 1)

await page.locator('.gd-faq__item').first().locator('summary').click()
check('questions open', await page.locator('.gd-faq__item').first().evaluate((node) => node.open))

// English and Ukrainian.
for (const [lang, title] of [['en', 'How to use KanbanHub'], ['uk', 'Як користуватися KanbanHub']]) {
	const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
	await context.addInitScript((value) => localStorage.setItem('kanban-language', value), lang)
	const other = await context.newPage(); watch(other, lang)
	await other.goto(`${APP}/guide`); await other.waitForSelector('.gd-section')
	check(`the guide is in ${lang}`, (await other.locator('h1').innerText()) === title && (await other.locator('.gd-section').count()) === 12)
	await context.close()
}

// Phone.
const phone = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const mobile = await phone.newPage(); watch(mobile, 'phone')
await mobile.goto(`${APP}/guide`); await mobile.waitForSelector('.gd-section'); await mobile.waitForLoadState('networkidle')
check('on a small phone nothing scrolls sideways', (await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0)
check('on a phone the keys box gives way to a note', !(await mobile.locator('.gd-keys__pad').isVisible()) && (await mobile.locator('.gd-keys__touch').isVisible()))

// Signed in: the account menu and the tips point to the guide, and “Try it” opens the app.
const ME = { email: `guide-${Date.now()}@example.com`, password: 'Password123!', name: 'Gina Guide' }
const me = await createVerifiedUser(ME, 'Reader')
await me.call('PATCH', '/auth/settings', { language: 'ru' })
const app = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const signed = await app.newPage(); watch(signed, 'signed')
await signed.goto(`${APP}/login`); await uiLogin(signed, ME.email, ME.password); await signed.waitForURL(/\/workspaces/)
await signed.getByRole('button', { name: 'Меню аккаунта' }).click()
await signed.getByRole('menuitem', { name: 'Гайд' }).click(); await signed.waitForURL(/\/guide$/); await signed.waitForSelector('.gd-section')
check('the account menu opens the guide', (await signed.locator('h1').innerText()) === 'Как пользоваться KanbanHub')
await signed.locator('#calendarSync').getByRole('link', { name: 'Включить ссылку на календарь' }).click()
await signed.waitForURL(/\/settings#calendar$/); await signed.waitForSelector('#calendar .clk')
check('“Try it” takes a signed-in reader to the right place', await signed.locator('#calendar').isVisible())

await signed.goto(`${APP}/guide`); await signed.waitForSelector('.gd-section')
await signed.locator('#start').getByRole('link', { name: 'Создать доску' }).click()
await signed.waitForURL(/\/workspaces/); await signed.waitForSelector('.create-board-modal')
check('“Create a board” in the guide opens the new board dialog', await signed.locator('.create-board-modal').isVisible())
await signed.keyboard.press('Escape'); await signed.locator('.create-board-modal').waitFor({ state: 'detached' })

await signed.getByRole('button', { name: /^Советы/ }).click()
await signed.getByRole('link', { name: 'Гайд по KanbanHub' }).click(); await signed.waitForURL(/\/guide$/); await signed.waitForSelector('.gd-section')
check('the tips link to the guide', (await signed.locator('h1').innerText()) === 'Как пользоваться KanbanHub')

await browser.close()
done()
