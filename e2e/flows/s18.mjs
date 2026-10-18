// Profile: inside the app shell, editing details with a save bar, timezone help,
// activity numbers, the live preview, and the photo editor (zoom + drag decide
// exactly which part of the photo becomes the avatar).
import fs from 'node:fs'
import path from 'node:path'
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `profile-${stamp}@example.com`, password: 'Password123!', name: 'Pat Profile' }
const me = await createVerifiedUser(ME, '')
await me.call('PATCH', '/auth/settings', { language: 'en' })
await me.call('PATCH', '/auth/setup-profile', { name: ME.name, jobTitle: '', timezone: 'UTC' })
const board = await me.call('POST', '/board/boards', { name: 'Ops' })
const todo = await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'To do', position: 0 })
await me.call('POST', `/board/boards/${board._id}/columns`, { title: 'Done', position: 1 })
const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE')
await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Late thing', dueDate: yesterday, assignees: [me.id] })
await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Open thing', assignees: [me.id] })

const browser = await launch()

// A test photo: blue everywhere, a green disc near the right edge.
const photoPath = path.resolve('e2e/.tmp/profile-test-photo.png')
fs.mkdirSync(path.dirname(photoPath), { recursive: true })
{
	const scratch = await browser.newPage()
	const dataUrl = await scratch.evaluate(() => {
		const canvas = document.createElement('canvas')
		canvas.width = 1200
		canvas.height = 800
		const context = canvas.getContext('2d')
		context.fillStyle = '#1d4ed8'
		context.fillRect(0, 0, 1200, 800)
		context.fillStyle = '#16a34a'
		context.beginPath()
		context.arc(950, 400, 150, 0, Math.PI * 2)
		context.fill()
		return canvas.toDataURL('image/png')
	})
	fs.writeFileSync(photoPath, Buffer.from(dataUrl.split(',')[1], 'base64'))
	await scratch.close()
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Kyiv' })
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/profile/edit`); await page.waitForURL(/\/profile$/); await page.waitForSelector('.pf-hero')
check('the old edit address opens the new profile', page.url().endsWith('/profile'))
check('the profile lives inside the app shell', (await page.locator('.app-sidebar').count()) === 1 && (await page.locator('.app-topbar__title').innerText()) === 'Profile')
check('no old navbar anywhere', (await page.locator('.navbar, .account-page').count()) === 0)

// Activity and completeness.
await page.waitForSelector('.pf-stat')
const statText = (await page.locator('.pf-stats').innerText()).replace(/\s+/g, ' ')
check('activity counts boards, open and overdue work', /1 Boards/.test(statText) && /2 Open tasks/.test(statText) && /1 Overdue/.test(statText), statText)
check('the checklist asks for a photo and a role', (await page.locator('.pf-checklist li:not(.is-done)').count()) === 2)

// Details: save bar, live preview, discard and save.
check('no save bar until something changes', !(await page.locator('.pf-savebar').isVisible()))
await page.fill('#profile-job', 'Operations lead')
check('the save bar appears with changes', await page.locator('.pf-savebar').isVisible())
check('the preview follows typing', (await page.locator('.pf-preview__who').innerText()).includes('Operations lead'))
await page.getByRole('button', { name: 'Discard' }).click()
check('discard puts the saved values back', (await page.inputValue('#profile-job')) === '')
await page.fill('#profile-name', '')
await page.fill('#profile-job', 'Operations lead')
await page.getByRole('button', { name: 'Save', exact: true }).click()
check('an empty name is refused', (await page.locator('.ui-field__error').count()) === 1)
await page.fill('#profile-name', 'Pat Profile')
check('this device’s timezone is offered', (await page.getByRole('button', { name: /Use this device’s timezone \(Europe\/Kyiv\)/ }).count()) === 1)
await page.getByRole('button', { name: /Use this device’s timezone/ }).click()
const saved = page.waitForResponse((response) => response.url().endsWith('/auth/setup-profile'))
await page.getByRole('button', { name: 'Save', exact: true }).click()
check('saving the details succeeds', (await saved).status() === 200)
const user = await me.call('GET', '/auth/get-user')
check('role and timezone are stored', user.jobTitle === 'Operations lead' && user.timezone === 'Europe/Kyiv', `${user.jobTitle} ${user.timezone}`)
await page.waitForTimeout(300)
check('the save bar hides after saving', !(await page.locator('.pf-savebar').isVisible()))

// Photo: zoom and drag pick the green disc; the saved avatar is centred on it.
let uploaded = ''
await page.route('**/api/auth/setup-profile', async (route) => {
	const body = route.request().postDataJSON()
	if (body.avatar) {
		uploaded = body.avatar
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) })
	} else await route.continue()
})
await page.locator('.pf-avatar').click()
await page.getByRole('menuitem', { name: 'Add photo' }).click()
check('the editor starts with a drop zone', await page.locator('.av-drop').isVisible())
await page.locator('.av-editor-modal input[type=file]').setInputFiles(photoPath)
await page.waitForSelector('.av-editor__frame')
await page.locator('.av-editor__zoom').fill('2')
const frame = await page.locator('.av-editor__frame').boundingBox()
await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2)
await page.mouse.down()
await page.mouse.move(frame.x + frame.width / 2 - 245, frame.y + frame.height / 2, { steps: 12 })
check('holding the mouse on the photo selects nothing around it', await page.evaluate(() => window.getSelection().toString() === ''), await page.evaluate(() => window.getSelection().toString().slice(0, 40)))
await page.mouse.up()
await page.locator('.av-editor__frame').focus()
await page.keyboard.press('ArrowRight')
await page.keyboard.press('ArrowLeft')
await page.getByRole('button', { name: 'Save photo' }).click()
await page.waitForTimeout(800)
check('the photo is sent compressed', uploaded.startsWith('data:image/') && uploaded.length < 100000, `${uploaded.slice(0, 22)} ${uploaded.length}`)
const centre = await page.evaluate(async (src) => {
	const image = new Image()
	image.src = src
	await image.decode()
	const canvas = document.createElement('canvas')
	canvas.width = image.width
	canvas.height = image.height
	const context = canvas.getContext('2d')
	context.drawImage(image, 0, 0)
	const [r, g, b] = context.getImageData(image.width / 2, image.height / 2, 1, 1).data
	// Without zooming in, the disc would end well before a quarter of the width.
	const [qr, qg, qb] = context.getImageData(image.width / 4, image.height / 2, 1, 1).data
	return { size: `${image.width}x${image.height}`, centre: [r, g, b], quarter: [qr, qg, qb] }
}, uploaded)
check('the avatar is square', centre.size === '512x512', centre.size)
check('the chosen part (the green disc) is in the middle', centre.centre[1] > 120 && centre.centre[2] < 90, JSON.stringify(centre.centre))
check('zooming in enlarged the chosen part', centre.quarter[1] > 120 && centre.quarter[2] < 90, JSON.stringify(centre.quarter))
check('the editor closes after saving', !(await page.locator('.av-editor__frame').count()))
await page.unroute('**/api/auth/setup-profile')

// Phone: the editor fits and nothing scrolls sideways.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })
const phonePage = await phone.newPage(); watch(phonePage, 'phone')
await phonePage.goto(`${APP}/profile`); await phonePage.waitForSelector('.pf-hero')
check('nothing scrolls sideways on a phone', await phonePage.evaluate(() => document.querySelector('.workspace-main').scrollWidth <= window.innerWidth))
await phonePage.locator('.pf-avatar').click()
await phonePage.getByRole('menuitem', { name: 'Add photo' }).click()
await phonePage.locator('.av-editor-modal input[type=file]').setInputFiles(photoPath)
await phonePage.waitForSelector('.av-editor__frame')
const phoneFrame = await phonePage.locator('.av-editor__frame').boundingBox()
check('the crop frame fits the phone screen', phoneFrame.x >= 0 && phoneFrame.x + phoneFrame.width <= 390, JSON.stringify(phoneFrame))
await phone.close()

await browser.close(); done()
