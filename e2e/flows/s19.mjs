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
// Scrolling keeps loading: past the 40 curated photos into endless ones.
const photoCount = () => page.locator('.bg-photos .bg-swatch').count()
const scrollPhotos = async (times) => {
	for (let step = 0; step < times; step++) {
		await page.locator('.ui-modal__body').evaluate((body) => body.scrollTo(0, body.scrollHeight))
		await page.waitForTimeout(900)
	}
}
await scrollPhotos(5)
const browsed = await photoCount()
check('scrolling loads more photos than the curated set', browsed > 45, String(browsed))
check('the extra photos credit their authors', (await page.locator('.bg-photos .bg-photo__credit').count()) > 20)

// Searching: curated matches first, then any word from Wikimedia Commons.
const searchPhotos = async (text) => {
	const answered = page.waitForResponse((response) => response.url().includes('/backgrounds/photos') && new URL(response.url()).searchParams.get('query') === text, { timeout: 20000 })
	await page.getByLabel('Search photos').fill(text)
	const body = await (await answered).json()
	await page.waitForTimeout(300)
	return body
}
const mountains = await searchPhotos('mountains')
check('photo search starts with the matching curated photos', mountains.source === 'curated' && (await photoCount()) === mountains.photos.length, `${mountains.source} ${await photoCount()}`)
const lighthouse = await searchPhotos('lighthouse')
const lighthouses = await photoCount()
check('a word outside the curated topics still finds photos', lighthouse.source === 'commons' && lighthouses > 10, `${lighthouse.source} ${lighthouses}`)
check('they credit author and licence', (await page.locator('.bg-photos .bg-photo__credit').first().getAttribute('title')).includes('CC BY'))
await scrollPhotos(2)
check('search results keep loading as you scroll', (await photoCount()) > lighthouses, `${lighthouses} → ${await photoCount()}`)
check('Wikimedia Commons is credited', (await page.locator('.bg-photos__source').innerText()).includes('Wikimedia Commons'))
const lighthouseFirst = await page.locator('.bg-photos .bg-photo__credit').first().innerText()
const mayak = await searchPhotos('маяк')
check('a Russian word finds photos too', mayak.photos.length > 0 && (await photoCount()) === mayak.photos.length, `${mayak.photos.length} ${await photoCount()} after ${lighthouseFirst}`)
await searchPhotos('zzzzqq')
check('a search with no results says so', (await page.getByText('No photos found').count()) === 1)
// A Commons photo becomes the new board's background.
await searchPhotos('lighthouse')
await page.locator('.bg-photos .bg-swatch').first().click()
check('a Commons photo can be picked', (await page.locator('.bg-photos .bg-swatch.is-selected').count()) === 1)
await page.getByRole('button', { name: 'Done' }).click()
check('Done returns to the form with the photo chosen', (await page.locator('#board-name').count()) === 1 && (await preview()).includes('wikimedia.org'))
const created = page.waitForResponse((response) => response.url().endsWith('/api/board/boards') && response.request().method() === 'POST')
await page.click('button[form="create-board-form"]')
const board = await (await created).json()
check('the board is created with that photo, its author and licence', board.background?.type === 'photo' && board.background.source === 'Wikimedia Commons' && board.background.license?.startsWith('CC') && /wikimedia\.org\//.test(board.background.url), JSON.stringify(board.background))
await page.waitForURL(new RegExp(`/workspaces/${board._id}$`))

// The open board, its sidebar tile and its card show the background.
await page.waitForTimeout(600)
check('the open board stands on its background', await page.locator('.workspace-main.has-board-background').count() === 1)
check('the sidebar tile shows the background', (await page.locator('.app-sidebar .board-tile--background').count()) >= 1)
// Every page's sidebar shows it, not only the board's (Team loads boards on its own).
for (const path of ['/team', '/calendar', '/my-tasks', '/settings', '/profile', '/workspaces']) {
	await page.goto(`${APP}${path}`); await page.waitForSelector('.app-sidebar .board-tile'); await page.waitForTimeout(500)
	check(`the sidebar keeps the background on ${path}`, (await page.locator('.app-sidebar .board-tile--background').count()) >= 1)
}
await page.goto(`${APP}/workspaces/${board._id}`); await page.waitForSelector('.bc-column, .bc-add-list')

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
