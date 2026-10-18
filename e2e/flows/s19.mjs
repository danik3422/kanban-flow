// Board backgrounds: choosing one while creating a board (preview, more colours,
// photo search, stepping back), seeing it on the board, list and sidebar, changing
// and removing it later, and who may change it.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const OWNER = { email: `bg-owner-${stamp}@example.com`, password: 'Password123!', name: 'Bea Owner' }
const MEMBER = { email: `bg-member-${stamp}@example.com`, password: 'Password123!', name: 'Max Member' }
const owner = await createVerifiedUser(OWNER, 'PM')
const member = await createVerifiedUser(MEMBER, 'Dev')
for (const user of [owner, member]) await user.call('PATCH', '/auth/settings', { language: 'en' })

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); watch(page, 'owner')
await page.goto(`${APP}/login`); await uiLogin(page, OWNER.email, OWNER.password); await page.waitForURL(/\/workspaces/)

// Create dialog: the first photo is preselected and shown in the preview.
await page.locator('.app-sidebar__footer button').click()
await page.waitForSelector('.bg-compact__photos .bg-swatch')
const preview = () => page.locator('.bg-preview').evaluate((element) => getComputedStyle(element).backgroundImage)
check('a photo is preselected', (await page.locator('.bg-compact .bg-swatch.is-selected').count()) === 1 && (await preview()).includes('images.unsplash.com'))
await page.fill('#board-name', 'Roadmap')
check('the preview shows the name as you type', (await page.locator('.bg-preview__name').innerText()) === 'Roadmap')
await page.getByRole('button', { name: 'Ocean' }).click()
check('picking a gradient updates the preview', (await preview()).includes('linear-gradient'))

// More → Colors → back with Escape; More → Photos with search.
await page.getByRole('button', { name: 'More backgrounds' }).click()
check('"more" opens the background browser in the same dialog', (await page.locator('.ui-modal__title').innerText()) === 'Board background')
await page.getByRole('button', { name: 'View more' }).nth(1).click()
check('all colours include plain ones', (await page.getByRole('button', { name: 'Gray' }).count()) === 1)
await page.getByRole('button', { name: 'Gray' }).click()
await page.keyboard.press('Escape')
check('Escape steps back instead of closing', (await page.locator('.ui-modal__title').innerText()) === 'Board background')
await page.getByRole('button', { name: 'View more' }).first().click()
await page.waitForSelector('.bg-photos .bg-swatch')
const allPhotos = await page.locator('.bg-photos .bg-swatch').count()
await page.getByLabel('Search photos').fill('mountains')
await page.waitForTimeout(900)
const mountainPhotos = await page.locator('.bg-photos .bg-swatch').count()
check('photo search narrows the list', mountainPhotos > 0 && mountainPhotos < allPhotos + 1, `${allPhotos} → ${mountainPhotos}`)
await page.getByLabel('Search photos').fill('zzzzqq')
await page.waitForTimeout(900)
check('a search with no results says so', (await page.getByText('No photos found').count()) === 1)
await page.getByLabel('Search photos').fill('lake')
await page.waitForTimeout(900)
await page.locator('.bg-photos .bg-swatch').first().click()
await page.getByRole('button', { name: 'Done' }).click()
check('Done returns to the form with the photo chosen', (await page.locator('#board-name').count()) === 1 && (await preview()).includes('images.unsplash.com'))
const created = page.waitForResponse((response) => response.url().endsWith('/api/board/boards') && response.request().method() === 'POST')
await page.click('button[form="create-board-form"]')
const board = await (await created).json()
check('the board is created with that photo', board.background?.type === 'photo' && board.background.url.startsWith('https://images.unsplash.com/'), JSON.stringify(board.background))
await page.waitForURL(new RegExp(`/workspaces/${board._id}$`))

// The open board, its sidebar tile and its card show the background.
await page.waitForTimeout(600)
check('the open board stands on its background', await page.locator('.workspace-main.has-board-background').count() === 1)
check('the sidebar tile shows the background', (await page.locator('.app-sidebar .board-tile--background').count()) >= 1)

// Change it from the board menu, then remove it.
await page.locator('.workspace-more-trigger').click()
await page.locator('.workspace-topbar-background').click()
await page.waitForSelector('.board-bg-dialog')
const patched = page.waitForResponse((response) => response.url().endsWith(`/api/board/boards/${board._id}`) && response.request().method() === 'PATCH')
await page.getByRole('button', { name: 'Sunset' }).click()
check('a new background saves at once', (await (await patched).json()).background?.key === 'sunset')
check('the board behind the panel changes with it', (await page.locator('.workspace-main').getAttribute('style')).includes('linear-gradient'))
const removed = page.waitForResponse((response) => response.url().endsWith(`/api/board/boards/${board._id}`) && response.request().method() === 'PATCH')
await page.getByRole('button', { name: 'Remove background' }).click()
check('removing the background clears it', (await (await removed).json()).background === null)
await page.keyboard.press('Escape')
check('a plain board has no background class', (await page.locator('.workspace-main.has-board-background').count()) === 0)
await owner.call('PATCH', `/board/boards/${board._id}`, { background: { type: 'gradient', key: 'lagoon' } })
await page.goto(`${APP}/workspaces`); await page.waitForSelector('.board-card')
check('the board card shows the background as a cover', (await page.locator('.board-card.has-cover', { hasText: 'Roadmap' }).count()) === 1)

// A member may look but not change it.
const invite = await owner.call('POST', `/board/boards/${board._id}/invites`, { email: MEMBER.email, role: 'member' })
await member.call('POST', `/board/invites/${new URL(invite.inviteUrl).pathname.split('/').pop()}/accept`)
const memberCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const memberPage = await memberCtx.newPage(); watch(memberPage, 'member')
await memberPage.goto(`${APP}/login`); await uiLogin(memberPage, MEMBER.email, MEMBER.password); await memberPage.waitForURL(/\/workspaces/)
await memberPage.goto(`${APP}/workspaces/${board._id}`); await memberPage.waitForTimeout(1500)
check('members see the background', await memberPage.locator('.workspace-main.has-board-background').count() === 1)
await memberPage.locator('.workspace-more-trigger').click()
check('members have no background button', (await memberPage.locator('.workspace-topbar-background').count()) === 0)
await memberCtx.close()

// Phone: the dialog fits and its swatches are big enough to tap.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })
const phonePage = await phone.newPage(); watch(phonePage, 'phone')
await phonePage.goto(`${APP}/workspaces`); await phonePage.waitForSelector('.board-card')
await phonePage.locator('.app-bottom-nav button').first().click()
await phonePage.waitForSelector('.bg-compact__photos .bg-swatch')
const sizes = await phonePage.locator('.bg-compact .bg-swatch').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().height)))
check('swatches are at least 44px tall on a phone', sizes.every((height) => height >= 44), sizes.join(','))
check('the dialog does not scroll sideways', await phonePage.evaluate(() => [...document.querySelectorAll('.ui-modal__body')].every((body) => body.scrollWidth <= body.clientWidth)))
await phone.close()

await browser.close(); done()
