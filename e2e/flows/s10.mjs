// Home, 404 and routing: theme and language switches, the demo board, sign-in
// redirects that come back to the requested address, and the missing-board message.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const DEMO = { email: `home${Date.now()}@example.com`, password: 'Password123!', name: 'Home Tester' }
await createVerifiedUser(DEMO, 'Tester')
const browser = await launch()

const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const page = await ctx.newPage(); watch(page, 'guest')
await page.goto(APP + '/')
await page.waitForSelector('.home-hero__title')
check('home shows the new header and no legacy navbar', await page.isVisible('.site-header') && !(await page.isVisible('header.navbar')))

// Language: switching updates the page text and <html lang>.
await page.getByRole('button', { name: /^Language/ }).click()
await page.getByRole('menuitemradio', { name: 'Українська' }).click()
await page.waitForTimeout(300)
check('language switch translates the home page', (await page.textContent('.home-hero__title')).includes('Зробіть'), await page.textContent('.home-hero__title'))
check('html lang follows the language', (await page.getAttribute('html', 'lang')) === 'uk')

// Theme: dark applies to <html> and survives a reload without a light first paint.
await page.locator('.site-header__actions button[aria-haspopup]').nth(1).click()
await page.getByRole('menuitemradio', { name: 'Темна' }).click()
check('theme switch applies dark', (await page.getAttribute('html', 'data-theme')) === 'dark')
const firstPaint = await (await fetch(APP + '/')).text()
check('index.html applies the saved theme before the app loads', firstPaint.includes("localStorage.getItem('theme')"))
await page.reload(); await page.waitForSelector('.home-hero__title')
check('dark theme and language persist after reload', (await page.getAttribute('html', 'data-theme')) === 'dark' && (await page.textContent('.home-hero__title')).includes('Зробіть'))

// Demo board: a click does nothing, a mouse drag moves the card with a placeholder on the way.
const column = (index) => page.locator('.demo-board__column').nth(index)
const countIn = (index) => column(index).locator('[data-demo-card]').count()
const todoBefore = await countIn(0)
await column(0).locator('[data-demo-card]').first().click()
check('a click on a card does not move it', (await countIn(0)) === todoBefore)
const card = await column(0).locator('[data-demo-card]').first().boundingBox()
const doneBox = await column(2).boundingBox()
await page.mouse.move(card.x + 30, card.y + 20)
await page.mouse.down()
await page.mouse.move(card.x + 60, card.y + 30, { steps: 4 })
await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height - 20, { steps: 12 })
check('the dragged card follows the pointer', await page.isVisible('.demo-card.is-floating'))
check('a placeholder shows where it lands', (await column(2).locator('.demo-card-placeholder').count()) === 1)
check('the target column is highlighted', await column(2).evaluate((node) => node.classList.contains('is-drop-target')))
await page.mouse.up()
await page.waitForTimeout(300)
check('mouse drag moves the card to Done', (await countIn(0)) === todoBefore - 1 && (await countIn(2)) === 3, `${await countIn(0)} / ${await countIn(2)}`)
check('the drag layer is gone after drop', !(await page.isVisible('.demo-card.is-floating')))

// Keyboard: Space picks up, arrows move, Space drops; Escape restores.
const doingFirst = column(1).locator('[data-demo-card]').first()
const doingTitle = await doingFirst.locator('.demo-card__title').textContent()
await doingFirst.focus()
await page.keyboard.press('Space')
await page.keyboard.press('ArrowLeft')
await page.keyboard.press('Space')
check('keyboard moves a card between columns', (await column(0).locator('.demo-card__title', { hasText: doingTitle }).count()) === 1)
const before = await page.locator('.demo-board__columns').innerText()
await column(0).locator('[data-demo-card]').first().focus()
await page.keyboard.press('Space')
await page.keyboard.press('ArrowRight')
await page.keyboard.press('Escape')
check('Escape puts a keyboard-moved card back', (await page.locator('.demo-board__columns').innerText()) === before)

// Touch: a quick swipe scrolls, a hold then drag moves the card.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const mobile = await phone.newPage(); watch(mobile, 'phone')
await mobile.goto(APP + '/'); await mobile.waitForSelector('.demo-board')
await mobile.locator('.demo-board').scrollIntoViewIfNeeded()
const cdp = await phone.newCDPSession(mobile)
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
const mCount = (index) => mobile.locator('.demo-board__column').nth(index).locator('[data-demo-card]').count()
const first = await mobile.locator('.demo-board__column').nth(0).locator('[data-demo-card]').first().boundingBox()
const scrollBefore = await mobile.evaluate(() => window.scrollY)
await touch('touchStart', first.x + 40, first.y + 30)
for (let i = 1; i <= 6; i++) { await touch('touchMove', first.x + 40, first.y + 30 - i * 25); await mobile.waitForTimeout(16) }
await touch('touchEnd')
await mobile.waitForTimeout(300)
check('a quick swipe on a card scrolls instead of dragging', (await mCount(0)) === 2 && !(await mobile.isVisible('.demo-card.is-floating')), `scroll ${scrollBefore} → ${await mobile.evaluate(() => window.scrollY)}`)
const start = await mobile.locator('.demo-board__column').nth(0).locator('[data-demo-card]').first().boundingBox()
const strip = await mobile.locator('.demo-board__columns').boundingBox()
await touch('touchStart', start.x + 40, start.y + 30)
await mobile.waitForTimeout(400)
check('holding a card lifts it', await mobile.isVisible('.demo-card.is-floating'))
// Drag to the right edge so the strip scrolls to the next column, then drop.
for (let i = 1; i <= 10; i++) { await touch('touchMove', start.x + 40 + i * ((strip.x + strip.width - 20 - start.x - 40) / 10), start.y + 40); await mobile.waitForTimeout(30) }
await mobile.waitForTimeout(700)
await touch('touchEnd')
await mobile.waitForTimeout(300)
const total = (await mCount(0)) + (await mCount(1)) + (await mCount(2))
check('touch drag drops the card in another column', (await mCount(0)) === 1 && total === 6 && !(await mobile.isVisible('.demo-card.is-floating')), `todo ${await mCount(0)}, total ${total}`)
check('holding a card at the edge scrolls the columns', (await mobile.evaluate(() => document.querySelector('.demo-board__columns').scrollLeft)) > 0)
await phone.close()

// 404 in the chosen language and theme, with a way home.
await page.goto(APP + '/definitely/not/here')
await page.waitForSelector('.missing-page__title')
check('404 is translated', (await page.textContent('.missing-page__title')).includes('сторінка'))
check('404 shows the requested address', (await page.textContent('.missing-page__path code')) === '/definitely/not/here')
await page.getByRole('link', { name: 'На головну' }).click()
await page.waitForURL(APP + '/')
check('404 leads back home', new URL(page.url()).pathname === '/')

// A board link opened while signed out asks to sign in and then opens that address.
const target = '/workspaces/aaaaaaaaaaaaaaaaaaaaaaaa'
await page.goto(APP + target)
await page.waitForURL(/\/login\?redirect=/)
check('protected link redirects to sign-in with the address kept', decodeURIComponent(page.url()).includes(target))
await uiLogin(page, DEMO.email, DEMO.password)
await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10000 })
await page.waitForTimeout(1500)
const toast = await page.locator('[data-sonner-toast]').first().textContent().catch(() => '')
check('a missing board explains itself in the chosen language', toast.includes('дошки'), toast)
check('a missing board lands on the board list', new URL(page.url()).pathname === '/workspaces', page.url())

// Signed in: the home page offers the workspace, 404 offers the boards.
await page.goto(APP + '/'); await page.waitForSelector('.home-hero__title')
// The account's saved language (ru) takes over after sign-in.
check('home offers the workspace when signed in', await page.isVisible('.site-header a[href="/workspaces"]') && !(await page.isVisible('.site-header a[href="/login"]')))
await page.goto(APP + '/nope'); await page.waitForSelector('.missing-page__title')
check('404 offers the boards when signed in', await page.isVisible('.missing-page__actions a[href="/workspaces"]'))
await browser.close(); done()
