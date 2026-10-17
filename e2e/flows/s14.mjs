// Team: me pinned first, workload per person, filters, the person panel with role
// changes, inviting to another board, removing from a board, and phones.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const ME = { email: `team-${stamp}@example.com`, password: 'Password123!', name: 'Tess Lead' }
const BOB = { email: `tm-bob-${stamp}@example.com`, password: 'Password123!', name: 'Bob Builder' }
const CARA = { email: `tm-cara-${stamp}@example.com`, password: 'Password123!', name: 'Cara Owner' }
const me = await createVerifiedUser(ME, 'Lead')
const bob = await createVerifiedUser(BOB, 'Dev')
const cara = await createVerifiedUser(CARA, 'PM')
await me.call('PATCH', '/auth/settings', { language: 'en' })
const join = async (owner, guest, boardId, email) => {
	const invite = await owner.call('POST', `/board/boards/${boardId}/invites`, { email, role: 'member' })
	await guest.call('POST', `/board/invites/${new URL(invite.inviteUrl).pathname.split('/').pop()}/accept`)
}
const product = await me.call('POST', '/board/boards', { name: 'Product' })
const spare = await me.call('POST', '/board/boards', { name: 'Spare board' })
await join(me, bob, product._id, BOB.email)
const todo = await me.call('POST', `/board/boards/${product._id}/columns`, { title: 'To do', position: 0 })
await me.call('POST', `/board/boards/${product._id}/columns`, { title: 'Done', position: 1 })
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Late fix', dueDate: yesterday, assignees: [bob.id] })
await me.call('POST', `/board/columns/${todo._id}/task`, { title: 'Open fix', assignees: [bob.id] })
const caraBoard = await cara.call('POST', '/board/boards', { name: 'Cara plans' })
await join(cara, me, caraBoard._id, ME.email)

const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); watch(page, 'me')
await page.goto(`${APP}/login`); await uiLogin(page, ME.email, ME.password); await page.waitForURL(/\/workspaces/)
await page.goto(`${APP}/team`); await page.waitForSelector('.tm-row:not(.is-loading)')

const row = (name) => page.locator('.tm-row', { hasText: name })
check('I am pinned first and marked as me', (await page.locator('.tm-section').first().innerText()).includes('Tess Lead') && (await row('Tess Lead').innerText()).includes('You'))
check('the people count leaves me out', (await page.locator('.tm-stat').first().innerText()).startsWith('2'))
const bobRow = await row('Bob Builder').innerText()
check('workload shows open and overdue tasks', /2 open/.test(bobRow) && /1 overdue/.test(bobRow), bobRow.replace(/\s+/g, ' '))
await page.getByRole('radio', { name: 'Overdue' }).click()
check('Overdue keeps only people with overdue work', (await page.locator('.tm-section').last().locator('.tm-row').count()) === 1 && (await row('Bob Builder').count()) === 1)
await page.getByRole('radio', { name: 'I manage' }).click()
check('I manage hides people only on boards others run', (await row('Bob Builder').count()) === 1 && (await row('Cara Owner').count()) === 0)
await page.getByRole('radio', { name: 'All' }).click()

// The person panel is linkable and closes with Back.
await row('Bob Builder').locator('.tm-row__main').click()
await page.waitForSelector('.tm-panel')
check('opening a person puts them in the address', new URL(page.url()).searchParams.has('person'))
const panel = page.locator('.tm-panel')
check('the panel shows per-board workload', (await panel.locator('.tm-board', { hasText: 'Product' }).innerText()).includes('1 overdue'))

// Role change on a board I own.
await panel.getByRole('combobox', { name: 'Role on Product' }).selectOption('admin')
await page.waitForTimeout(800)
const members = await me.call('GET', `/board/boards/${product._id}/members`)
const bobMember = (Array.isArray(members) ? members : members.members || []).find((member) => (member.user?.email || member.email) === BOB.email)
check('changing the role saves it', bobMember?.role === 'admin', JSON.stringify(bobMember?.role))

// Invite to another of my boards.
await panel.getByRole('button', { name: 'Send invite' }).click()
await page.waitForTimeout(800)
const invites = await me.call('GET', `/board/boards/${spare._id}/invites`)
check('inviting sends an invitation to my other board', JSON.stringify(invites).includes(BOB.email))

await page.goBack()
await page.waitForTimeout(500)
check('Back closes the panel', !(await page.isVisible('.tm-panel')) && !new URL(page.url()).searchParams.has('person'))

// Remove from a board, with confirmation.
await row('Bob Builder').locator('.tm-row__main').click()
await page.waitForSelector('.tm-panel')
await page.locator('.tm-panel').getByRole('button', { name: 'Remove from Product' }).click()
await page.getByRole('button', { name: 'Remove', exact: true }).click()
await page.waitForTimeout(1200)
const after = await me.call('GET', '/board/team')
check('removing takes them off the board', !JSON.stringify(after.find((entry) => entry.board._id === product._id).members).includes(BOB.email))

// Phone: compact rows, the panel opens as a sheet.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storageState: await ctx.storageState() })
const mobile = await phone.newPage(); watch(mobile, 'phone')
await mobile.goto(`${APP}/team`); await mobile.waitForSelector('.tm-row:not(.is-loading)')
check('phone rows show a short summary instead of columns', (await mobile.isVisible('.tm-row__summary')) && !(await mobile.isVisible('.tm-row__boards')))
await mobile.locator('.tm-row__main', { hasText: 'Cara Owner' }).tap()
await mobile.waitForSelector('.tm-panel')
const sheet = await mobile.locator('.tm-panel').boundingBox()
check('the person opens as a bottom sheet on phones', sheet.width >= 380 && sheet.y > 100, JSON.stringify(sheet))
await phone.close()

await browser.close(); done()
