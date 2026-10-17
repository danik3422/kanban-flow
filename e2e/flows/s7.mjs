import { APP, API, apiSignup, check, done, lastMailTo, launch, linkFrom, uiLogin } from '../lib.mjs'
const browser = await launch()
const email = `revoke${Date.now()}@example.com`, pw = 'Password123!'
await apiSignup(email, pw)
const deviceA = await (await browser.newContext()).newPage()
const frames = []
deviceA.on('websocket', (ws) => {
	const t0 = Date.now()
	ws.on('framesent', (f) => frames.push(`+${Date.now() - t0} SENT ${String(f.payload).slice(0, 80)}`))
	ws.on('framereceived', (f) => frames.push(`+${Date.now() - t0} RECV ${String(f.payload).slice(0, 80)}`))
	ws.on('close', () => frames.push(`+${Date.now() - t0} CLOSE`))
})
await deviceA.goto(`${APP}/login`); await uiLogin(deviceA, email, pw); await deviceA.waitForTimeout(1200)
await deviceA.goto(linkFrom(lastMailTo(email))); await deviceA.waitForURL(/setup-profile/)
await deviceA.fill('#setup-name', 'Revoke'); await deviceA.click('button.setup-submit'); await deviceA.waitForTimeout(1200)
const board = await (await deviceA.request.post(`${API}/board/boards`, { data: { name: 'Revocation' } })).json()
await deviceA.goto(`${APP}/workspaces/${board._id}`); await deviceA.waitForTimeout(2000)
check('board is live before the session is revoked', (await deviceA.locator('.realtime-status-connected').count()) === 1)

const deviceB = await (await browser.newContext()).newPage()
await deviceB.goto(`${APP}/login`); await uiLogin(deviceB, email, pw); await deviceB.waitForTimeout(1500)
const change = await deviceB.request.patch(`${API}/auth/change-password`, { data: { currentPassword: pw, newPassword: 'Password456!' } })
check('password changed on another device', change.status() === 200, String(change.status()))
await deviceA.waitForTimeout(24000)
const status = await deviceA.locator('.realtime-status').getAttribute('class').catch(() => 'none')
check('revoked session shows Offline instead of reconnecting forever', status?.includes('realtime-status-offline'), status)
if (process.env.FRAMES) console.log(frames.filter((f) => !/"board:presence"|^\S+ (SENT|RECV) [23]$/.test(f)).join('\n'))
await browser.close(); done()
