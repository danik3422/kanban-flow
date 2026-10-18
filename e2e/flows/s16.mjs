// Invite page: a board preview for guests, the right answer for owners, members and
// people holding someone else's invite, pasting a link at /invite, and joining.
import { APP, check, createVerifiedUser, done, launch, uiLogin, watch } from '../lib.mjs'

const stamp = Date.now()
const OWNER = { email: `inv-owner-${stamp}@example.com`, password: 'Password123!', name: 'Olga Owner' }
const GUEST = { email: `inv-guest-${stamp}@example.com`, password: 'Password123!', name: 'Gary Guest' }
const owner = await createVerifiedUser(OWNER, 'PM')
const guest = await createVerifiedUser(GUEST, 'Dev')
for (const user of [owner, guest]) await user.call('PATCH', '/auth/settings', { language: 'en' })
const board = await owner.call('POST', '/board/boards', { name: 'Marketing launch' })
const column = await owner.call('POST', `/board/boards/${board._id}/columns`, { title: 'To do', position: 0 })
await owner.call('POST', `/board/columns/${column._id}/task`, { title: 'Brief' })
const tokenOf = (invite) => new URL(invite.inviteUrl).pathname.split('/').pop()
const link = tokenOf(await owner.call('POST', `/board/boards/${board._id}/invites`, { email: '', role: 'member' }))
const addressed = tokenOf(await owner.call('POST', `/board/boards/${board._id}/invites`, { email: `someone-${stamp}@example.com`, role: 'member' }))

const browser = await launch()
const signedIn = async (user, viewport = { width: 1440, height: 900 }) => {
	const ctx = await browser.newContext({ viewport })
	const page = await ctx.newPage(); watch(page, user.email.split('-')[1])
	await page.goto(`${APP}/login`); await uiLogin(page, user.email, user.password); await page.waitForURL(/\/workspaces/)
	return { ctx, page }
}

// Guest on a phone: preview, the addressed-email hint, sign-in keeps the way back.
const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })
const visitor = await guestCtx.newPage(); watch(visitor, 'visitor')
await visitor.goto(`${APP}/invite/${link}`); await visitor.waitForSelector('.inv')
check('guests see which board they are invited to', (await visitor.locator('.inv-summary').innerText()).includes('Marketing launch'))
check('the preview counts members and tasks', /1 member · 1 task/.test(await visitor.locator('.inv-summary').innerText()), await visitor.locator('.inv-summary').innerText())
check('the inviter is named', (await visitor.locator('.auth-heading').innerText()).includes('Olga Owner'))
check('no old navbar on the invite page', (await visitor.locator('.navbar, .account-page-card').count()) === 0)
const signInHref = await visitor.getByRole('link', { name: 'Sign in to join' }).getAttribute('href')
check('sign in returns to the invite', signInHref.includes(encodeURIComponent(`/invite/${link}`)), signInHref)
await visitor.goto(`${APP}/invite/${addressed}`); await visitor.waitForSelector('.inv')
const hint = await visitor.locator('.ui-alert').innerText()
check('an addressed invite says who it is for, masked', /s•••@example\.com/.test(hint) && !hint.includes(`someone-${stamp}`), hint)
check('nothing scrolls sideways on a phone', await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
await guestCtx.close()

// Owner opening their own link: no fake "join", a way to the board and to copy the link.
const own = await signedIn(OWNER)
await own.page.goto(`${APP}/invite/${link}`); await own.page.waitForSelector('.auth-status')
check('owners are told it is their board', (await own.page.locator('.auth-status h1').innerText()) === 'This is your board')
check('owners get Open board instead of Join', (await own.page.getByRole('link', { name: 'Open board' }).count()) === 1 && (await own.page.getByRole('button', { name: 'Join board' }).count()) === 0)
await own.ctx.close()

// Someone else's invite: an honest answer before any click.
const g = await signedIn(GUEST)
await g.page.goto(`${APP}/invite/${addressed}`); await g.page.waitForSelector('.auth-status')
check('an invite for another email is explained up front', (await g.page.locator('.auth-status h1').innerText()) === 'This invitation is for another email')
check('it does not claim the invite expired', !(await g.page.getByText(/expired/i).count()))

// Bad links and pasting a link at /invite.
await g.page.goto(`${APP}/invite/not-a-real-token-123456`); await g.page.waitForSelector('.auth-status')
check('a dead link says so and offers a way back', (await g.page.locator('.auth-status h1').innerText()) === 'This link no longer works' && (await g.page.getByRole('link', { name: 'Go to my boards' }).count()) === 1)
await g.page.goto(`${APP}/invite`); await g.page.waitForSelector('.inv-paste')
await g.page.getByLabel('Invitation link').fill('hello there')
await g.page.getByRole('button', { name: 'Open invitation' }).click()
check('pasting something else is refused', (await g.page.locator('.ui-field__error').count()) === 1)
await g.page.getByLabel('Invitation link').fill(`${APP}/invite/${link}`)
await g.page.getByRole('button', { name: 'Open invitation' }).click()
await g.page.waitForSelector('.inv')
check('pasting a full link opens that invite', g.page.url().endsWith(`/invite/${link}`), g.page.url())

// Joining lands on the board with a confirmation; the link then says "already in".
check('the role is spelled out before joining', (await g.page.locator('.inv__lead').innerText()) === 'You will join as a member.')
await g.page.getByRole('button', { name: 'Join board' }).click()
await g.page.waitForURL(new RegExp(`/workspaces/${board._id}`))
check('joining shows a confirmation', (await g.page.getByText('You joined “Marketing launch”').count()) === 1)
const again = tokenOf(await owner.call('POST', `/board/boards/${board._id}/invites`, { email: '', role: 'member' }))
await g.page.goto(`${APP}/invite/${again}`); await g.page.waitForSelector('.auth-status')
check('members are told they are already in', (await g.page.locator('.auth-status h1').innerText()) === 'You are already on this board')
await g.ctx.close()

await browser.close(); done()
