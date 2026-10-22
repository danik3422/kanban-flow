// Calendar link: turned on in settings, read by a calendar app without signing in,
// narrowed to one board from the board menu, opened from the calendar page, then reset
// and turned off — each time the old address stops working.
import { APP, check, createVerifiedUser, done, launch, SHOTS, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `calendar-${stamp}@example.com`, password: 'Password123!', name: 'Cal Endar' }
const me = await createVerifiedUser(ME, 'Planner')
await me.call('PATCH', '/auth/settings', { language: 'ru' })
const myId = me.id
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
const board = await me.call('POST', '/board/boards', { name: 'Релиз' })
const todo = await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'К выполнению', position: 0 })
await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'Готово', position: 1 })
const mine = await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Созвон, план; итоги', dueDate: day(2), assignees: [myId] })
await me.call('PATCH', `/board/tasks/${mine._id}`, { repeat: { frequency: 'weekly' } })
await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Чужая задача', dueDate: day(3) })
await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Без срока', assignees: [myId] })
const other = await me.call('POST', '/board/boards', { name: 'Другая доска' })
const otherList = await me.call('POST', `/board/boards/${other._id}/columns`, { title: 'Список', position: 0 })
await me.call('POST', `/board/columns/${otherList._id}/task`, { title: 'С другой доски', dueDate: day(4), assignees: [myId] })

// A calendar app: no cookies, no app headers.
const fetchFeed = async (url) => {
	const response = await fetch(url)
	return { status: response.status, type: response.headers.get('content-type') || '', text: (await response.text()).replace(/\r\n /g, '') }
}
const events = (text) => (text.match(/BEGIN:VEVENT/g) || []).length

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP })
const page = await ctx.newPage(); watch(page, 'desktop')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)

await page.goto(`${APP}/settings#calendar`); await page.waitForSelector('#calendar .clk'); await page.waitForTimeout(500)
check('settings has a calendar section, off at first', (await page.locator('#calendar .clk--off').count()) === 1)
await page.locator('#calendar').getByRole('button', { name: 'Включить ссылку' }).click()
await page.waitForSelector('#calendar .clk__url input')
const mineUrl = await page.locator('#calendar .clk__url input').inputValue()
check('the link points at the API calendar file', /^http:\/\/localhost:5001\/api\/calendar\/[\w-]{40,}\.ics$/.test(mineUrl), mineUrl)
await page.screenshot({ path: `${SHOTS}s30-settings.png` })

const mineFeed = await fetchFeed(mineUrl)
check('a calendar app gets the file without signing in', mineFeed.status === 200 && /^text\/calendar/.test(mineFeed.type), `${mineFeed.status} ${mineFeed.type}`)
check('my cards: both of mine with dates, nobody else’s, none without a date', events(mineFeed.text) === 2 && mineFeed.text.includes('SUMMARY:Созвон\\, план\\; итоги') && mineFeed.text.includes('С другой доски') && !mineFeed.text.includes('Чужая') && !mineFeed.text.includes('Без срока'))
check('the repeating card repeats in the calendar', /RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=\w\w;WKST=MO/.test(mineFeed.text))
check('the calendar has the person’s language', mineFeed.text.includes('X-WR-CALNAME:KanbanHub · Мои карточки') && mineFeed.text.includes('Доска: Релиз'))

await page.locator('#calendar .ui-segmented').getByRole('radio', { name: 'Все мои доски' }).click()
const allUrl = await page.locator('#calendar .clk__url input').inputValue()
check('“all my boards” adds scope=all', allUrl === `${mineUrl}?scope=all`, allUrl)
check('…and lists every dated card', events((await fetchFeed(allUrl)).text) === 3)
await page.locator('#calendar').getByText('Показывать выполненные').click()
check('hiding finished cards adds done=0', (await page.locator('#calendar .clk__url input').inputValue()) === `${mineUrl}?scope=all&done=0`)
await page.locator('#calendar').getByRole('button', { name: 'Копировать' }).click(); await page.waitForTimeout(200)
check('copy puts the address on the clipboard', (await page.evaluate(() => navigator.clipboard.readText())) === `${mineUrl}?scope=all&done=0`)
const google = await page.locator('#calendar .clk__apps a', { hasText: 'Google' }).getAttribute('href')
const apple = await page.locator('#calendar .clk__apps a', { hasText: 'Apple' }).getAttribute('href')
check('Google and Apple buttons subscribe by webcal', google.startsWith('https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Flocalhost') && apple.startsWith('webcal://localhost:5001/api/calendar/'), `${google} | ${apple}`)
check('on localhost it explains why Google cannot reach it', (await page.locator('#calendar .clk__local').count()) === 1)

// Board menu: the board's own calendar.
await page.goto(`${APP}/workspaces/${board._id}`); await page.waitForSelector('.task-card.ct')
await page.getByRole('button', { name: 'Меню доски' }).first().click(); await page.waitForTimeout(300)
await page.locator('.bh-menu-item', { hasText: 'Календарь доски' }).click(); await page.waitForSelector('.clk__url input')
const boardUrl = await page.locator('.clk__url input').inputValue()
check('the board calendar is the same link narrowed to the board', boardUrl === `${mineUrl}?board=${board._id}`, boardUrl)
const boardFeed = await fetchFeed(boardUrl)
check('…with every dated card of that board only', events(boardFeed.text) === 2 && boardFeed.text.includes('Чужая задача') && !boardFeed.text.includes('С другой доски') && boardFeed.text.includes('X-WR-CALNAME:Релиз · KanbanHub'))
check('the board calendar has no “my/all” switch', (await page.locator('.ui-modal .clk .ui-segmented').count()) === 0)
await page.screenshot({ path: `${SHOTS}s30-board.png` })
await page.keyboard.press('Escape')

// Calendar page button, then reset.
await page.goto(`${APP}/calendar`); await page.waitForSelector('.cal-subscribe')
await page.locator('.cal-subscribe').click(); await page.waitForSelector('.clk__url input')
check('the calendar page opens the same link', (await page.locator('.clk__url input').inputValue()) === mineUrl)
await page.getByRole('button', { name: 'Новая ссылка' }).click()
await page.getByRole('dialog', { name: 'Создать новую ссылку?' }).getByRole('button', { name: 'Новая ссылка' }).click()
await page.waitForFunction((old) => document.querySelector('.clk__url input')?.value !== old, mineUrl)
const newUrl = await page.locator('.clk__url input').inputValue()
check('a new link stops the old one', (await fetchFeed(mineUrl)).status === 404 && (await fetchFeed(newUrl)).status === 200 && (await fetchFeed(boardUrl)).status === 404)

await page.getByRole('button', { name: 'Выключить' }).click()
await page.getByRole('dialog', { name: 'Выключить ссылку на календарь?' }).getByRole('button', { name: 'Выключить' }).click()
await page.waitForSelector('.clk--off')
check('turning it off stops every address', (await fetchFeed(newUrl)).status === 404)
await page.keyboard.press('Escape')

// Phone, dark theme.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', storageState: await ctx.storageState() })
const mobile = await phone.newPage(); watch(mobile, 'phone')
await mobile.goto(`${APP}/settings#calendar`); await mobile.waitForSelector('#calendar .clk'); await mobile.waitForTimeout(400)
await mobile.locator('#calendar').getByRole('button', { name: 'Включить ссылку' }).click(); await mobile.waitForSelector('#calendar .clk__url input'); await mobile.waitForTimeout(300)
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('on a phone nothing scrolls sideways', overflow <= 0, `overflow ${overflow}px`)
const box = await mobile.locator('#calendar .clk__url .ui-btn').boundingBox()
check('on a phone the copy button is full width under the address', box && box.width > 300, JSON.stringify(box))
await mobile.locator('#calendar').scrollIntoViewIfNeeded()
await mobile.screenshot({ path: `${SHOTS}s30-phone.png` })

await browser.close()
done()
