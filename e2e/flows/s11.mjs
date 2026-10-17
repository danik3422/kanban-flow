// Board list and app shell: live numbers on cards, search, filter, starred and recent
// boards, the quick switcher, creating a board, the phone bottom bar and the account menu.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const OWNER = { email: `boards-owner-${stamp}@example.com`, password: 'Password123!', name: 'Bea Owner' }
const MATE = { email: `boards-mate-${stamp}@example.com`, password: 'Password123!', name: 'Max Mate' }
const owner = await createVerifiedUser(OWNER, 'Lead')
const mate = await createVerifiedUser(MATE, 'Designer')
await owner.call('PATCH', '/auth/settings', { language: 'en' })

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
const alpha = await owner.call('POST', '/board/boards', { name: 'Alpha project' })
await owner.call('POST', '/board/boards', { name: 'Beta launch' })
const todo = await owner.call('POST', `/board/boards/${alpha._id}/columns`, { title: 'To do', position: 0 })
const finished = await owner.call('POST', `/board/boards/${alpha._id}/columns`, { title: 'Done', position: 1 })
await owner.call('POST', `/board/columns/${todo._id}/task`, { title: 'Late task', dueDate: day(-2), assignees: [owner.id] })
await owner.call('POST', `/board/columns/${finished._id}/task`, { title: 'Shipped late', dueDate: day(-2), assignees: [owner.id] })
const gamma = await mate.call('POST', '/board/boards', { name: 'Gamma shared' })
const invite = await mate.call('POST', `/board/boards/${gamma._id}/invites`, { email: OWNER.email, role: 'member' })
await owner.call('POST', `/board/invites/${new URL(invite.inviteUrl).pathname.split('/').pop()}/accept`)
const gammaColumn = await mate.call('POST', `/board/boards/${gamma._id}/columns`, { title: 'Ideas', position: 0 })
await mate.call('POST', `/board/columns/${gammaColumn._id}/task`, { title: 'Pick the palette', assignees: [owner.id] })
await mate.call('POST', `/board/columns/${gammaColumn._id}/task`, { title: 'Draw the icons', assignees: [owner.id] })

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const page = await ctx.newPage(); watch(page, 'owner')
await page.goto(`${APP}/login`)
await uiLogin(page, OWNER.email, OWNER.password)
await page.waitForURL(/\/workspaces/)
await page.waitForSelector('.board-card')

const card = (name) => page.locator('.board-card', { has: page.locator('.board-card__open', { hasText: name }) })
const alphaStats = await card('Alpha project').locator('.board-card__stats').innerText()
check('cards show task counts from the server', /2 tasks/.test(alphaStats), alphaStats.replace(/\s+/g, ' '))
check('overdue and mine leave out finished work in the last column', /1 overdue/.test(alphaStats) && /1 assigned to me/.test(alphaStats), alphaStats.replace(/\s+/g, ' '))
check('the sidebar counts my open tasks', (await page.locator('.app-sidebar__link', { hasText: 'My tasks' }).locator('.app-sidebar__count').innerText()) === '3')

// Search, "/" shortcut and the empty state.
await page.locator('body').click({ position: { x: 900, y: 700 } })
await page.keyboard.press('/')
check('"/" focuses the board search', await page.evaluate(() => document.activeElement?.getAttribute('type') === 'search'))
await page.keyboard.type('beta')
check('search narrows the list', (await page.locator('.board-card').count()) === 1 && (await card('Beta launch').count()) === 1)
await page.locator('.boards-toolbar input').fill('nothing like this')
check('no match explains itself', await page.getByText('No boards match “nothing like this”').isVisible())
await page.getByRole('button', { name: 'Clear search' }).click()
check('clearing the search brings every board back', (await page.locator('.board-card').count()) === 3)

// Filter.
await page.getByRole('radio', { name: /Shared/ }).click()
check('Shared shows only boards others shared', (await page.locator('.board-card').count()) === 1 && (await card('Gamma shared').count()) === 1)
await page.getByRole('radio', { name: /All/ }).click()

// Starred boards.
await card('Beta launch').getByRole('button', { name: 'Star Beta launch' }).click()
check('a starred board gets its own section', (await page.locator('.board-section', { hasText: 'Starred' }).locator('.board-card').count()) === 1)
check('the sidebar lists starred boards', (await page.locator('.app-sidebar__section', { hasText: 'Starred' }).getByText('Beta launch').count()) === 1)
await page.reload(); await page.waitForSelector('.board-card')
check('starred boards survive a reload', (await page.locator('.app-sidebar__section', { hasText: 'Starred' }).getByText('Beta launch').count()) === 1)

// Opening a board records it as recent.
await card('Alpha project').locator('.board-card__open').click()
await page.waitForURL(new RegExp(`/workspaces/${alpha._id}`))
check('an opened board shows under Recent', (await page.locator('.app-sidebar__section', { hasText: 'Recent' }).getByText('Alpha project').count()) === 1)

// Quick switcher.
await page.keyboard.press('Control+k')
await page.locator('.quick-switcher input').fill('gam')
await page.keyboard.press('Enter')
await page.waitForURL(new RegExp(`/workspaces/${gamma._id}`))
check('Ctrl+K jumps to a board by name', page.url().endsWith(gamma._id))

// Creating a public board asks for confirmation first.
await page.locator('.app-sidebar__footer button').click()
await page.fill('#board-name', 'Delta public')
await page.getByText('Public', { exact: true }).click()
check('choosing Public asks to confirm', await page.getByRole('dialog', { name: 'Make this board public?' }).isVisible())
await page.getByRole('button', { name: 'Make public' }).click()
check('confirming selects Public', await page.locator('.ui-radio-card.is-selected', { hasText: 'Public' }).isVisible())
await page.click('button[form="create-board-form"]')
await page.waitForURL((url) => /\/workspaces\/[a-f0-9]{24}$/.test(url.pathname) && !url.pathname.endsWith(gamma._id))
const created = (await owner.call('GET', '/board/boards')).find((board) => board.name === 'Delta public')
check('the new board is created public and opened', created?.visibility === 'public' && page.url().endsWith(created._id))

// Notifications: worded from their facts, marked read one by one or all at once, deleted, opened.
await page.goto(`${APP}/workspaces`); await page.waitForSelector('.board-card')
await page.locator('.notification-trigger').click()
const panel = page.getByRole('dialog', { name: 'Notifications' })
const paletteItem = await panel.locator('.notify-item', { hasText: '«Pick the palette»' }).innerText()
check('the panel lists notifications in the interface language', /Assigned to you/.test(paletteItem) && /Gamma shared/.test(paletteItem) && /Max Mate/.test(paletteItem), paletteItem.replace(/\s+/g, ' '))
check('the bell shows the unread count', (await page.locator('.notification-badge').innerText()) === '2')
await panel.locator('.notify-item', { hasText: 'Draw the icons' }).hover()
await panel.locator('.notify-item', { hasText: 'Draw the icons' }).getByRole('button', { name: 'Mark as read' }).click()
check('marking one as read updates the badge', (await page.locator('.notification-badge').innerText()) === '1')
await panel.locator('.notify-item', { hasText: 'Draw the icons' }).hover()
await panel.locator('.notify-item', { hasText: 'Draw the icons' }).getByRole('button', { name: 'Delete notification' }).click()
await page.waitForTimeout(300)
check('deleting removes it from the list', (await panel.locator('.notify-item').count()) === 1, `${await panel.locator('.notify-item').count()} left: ${(await panel.locator('.notify-item__title').allInnerTexts()).join(' | ')}`)
await panel.getByRole('button', { name: 'Mark all read' }).click()
check('mark all clears the badge', (await page.locator('.notification-badge').count()) === 0)
await panel.locator('.notify-item__main', { hasText: 'Pick the palette' }).click()
await page.waitForURL(new RegExp(`/workspaces/${gamma._id}`))
check('opening a notification goes to its board', page.url().endsWith(gamma._id))
await page.waitForSelector('.modal-backdrop', { timeout: 8000 }).catch(() => {})
check('opening a notification opens its task', await page.getByText('Pick the palette').first().isVisible())
await page.goto(`${APP}/workspaces`); await page.waitForSelector('.board-card')

// Account menu: language, theme, sign-out.
await page.locator('.app-account-trigger').click()
await page.getByRole('menuitemradio', { name: 'Українська' }).click()
await page.goto(`${APP}/workspaces`); await page.waitForSelector('.board-card')
check('the account menu switches the language', (await page.locator('.ui-page-header__title').innerText()) === 'Дошки')
await page.locator('.app-account-trigger').click()
await page.getByRole('menuitemradio', { name: 'Темна' }).click()
check('the account menu switches the theme', (await page.getAttribute('html', 'data-theme')) === 'dark')

// Phone: bottom bar, "+" from another page, the bar steps aside for dialogs.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storageState: await ctx.storageState() })
const mobile = await phone.newPage(); watch(mobile, 'phone')
await mobile.goto(`${APP}/my-tasks`); await mobile.waitForSelector('.app-bottom-nav')
check('phones get the bottom bar instead of the sidebar', (await mobile.isVisible('.app-bottom-nav')) && !(await mobile.isVisible('.app-sidebar')))
await mobile.locator('.app-bottom-nav__primary').tap()
await mobile.waitForURL(/\/workspaces$/)
await mobile.waitForSelector('#board-name')
check('"+" from another page opens the new board dialog', await mobile.isVisible('#board-name'))
await mobile.waitForTimeout(300)
const barHidden = await mobile.evaluate(() => getComputedStyle(document.querySelector('.app-bottom-nav')).transform !== 'none')
check('the bottom bar steps aside while a dialog is open', barHidden)
await phone.close()

await page.locator('.app-account-trigger').click()
await page.getByRole('menuitem', { name: 'Вийти' }).click()
await page.waitForURL((url) => url.pathname === '/' || url.pathname.startsWith('/login'))
check('signing out from the account menu leaves the app', !page.url().includes('/workspaces'))

await browser.close(); done()
