import { APP, API, apiSignup, check, done, lastMailTo, launch, linkFrom, uiLogin, watch, ALICE_STATE } from '../lib.mjs'
const browser = await launch()
const alice = await (await browser.newContext({ storageState: ALICE_STATE })).newPage(); watch(alice, 'alice')
const carolEmail = `carol${Date.now()}@example.com`
await apiSignup(carolEmail, 'Password123!')
const carol = await (await browser.newContext()).newPage()
await carol.goto(`${APP}/login`); await uiLogin(carol, carolEmail, 'Password123!'); await carol.waitForTimeout(1200)
await carol.goto(linkFrom(lastMailTo(carolEmail))); await carol.waitForURL(/setup-profile/)
await carol.fill('#setup-name', 'Carol Team'); await carol.click('button.setup-submit'); await carol.waitForTimeout(1200)
const board = await (await carol.request.post(`${API}/board/boards`, { data: { name: `Carol room ${Date.now()}` } })).json()
const { inviteUrl } = await (await carol.request.post(`${API}/board/boards/${board._id}/invites`, { data: {} })).json()
await alice.request.post(`${API}/board/invites/${inviteUrl.split('/invite/')[1]}/accept`)

const requests = []
alice.on('request', (r) => { if (r.url().includes('/api/board/')) requests.push(new URL(r.url()).pathname) })
await alice.goto(`${APP}/team`); await alice.waitForTimeout(2500)
// Dev StrictMode runs effects twice, so assert the shape: only the team endpoint, never one call per board.
const teamRequests = requests.filter((p) => p !== '/api/notifications')
check('team loads without a request per board', teamRequests.length > 0 && teamRequests.every((p) => p === '/api/board/team'), teamRequests.join(','))
check('team lists the colleague', (await alice.getByText('Carol Team').count()) > 0)
const shared = await alice.locator('.workspace-room-group', { hasText: /shared with me/i }).innerText()
check('sidebar still groups shared rooms', shared.includes(board.name), shared.replace(/\s+/g, ' ').slice(0, 120))
await browser.close(); done()
