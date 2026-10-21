import { chromium, webkit } from 'playwright-core'
import fs from 'node:fs'
export const APP = 'http://localhost:5199'
export const API = 'http://localhost:5001/api'
// Everything a run produces (logs, sessions, screenshots) lives in e2e/.tmp.
export const TMP = new URL('./.tmp/', import.meta.url).pathname
fs.mkdirSync(`${TMP}shots`, { recursive: true })
export const MAIL = `${TMP}mail.log`
export const SHOTS = `${TMP}shots/`
// Signed-in session of the main test user, written by flow s1.
export const ALICE_STATE = `${TMP}alice.json`
// Alice's email and password, so a flow that logs her out can sign her back in.
export const ALICE_LOGIN = `${TMP}alice-login.json`
export const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// BROWSER=webkit runs a flow in Safari's engine (after `npx playwright-core install webkit`).
// API calls made through Playwright (page.request, context.request) say they come
// from the app, as the browser's own requests do, so the API's CSRF check lets them in.
let requestsTagged = false
const tagApiRequests = async (browser) => {
	if (requestsTagged) return browser
	const context = await browser.newContext()
	const proto = Object.getPrototypeOf(context.request)
	const fetchRequest = proto.fetch
	proto.fetch = function (urlOrRequest, options = {}) {
		return fetchRequest.call(this, urlOrRequest, { ...options, headers: { origin: APP, ...options.headers } })
	}
	requestsTagged = true
	await context.close()
	return browser
}
export const launch = async () => tagApiRequests(await (process.env.BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ executablePath: CHROME_PATH, headless: true })))
export const lastMailTo = (email) => {
	const lines = fs.readFileSync(MAIL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.to === email)
	return lines.at(-1)
}
export const linkFrom = (mail) => mail?.text?.match(/https?:\/\/\S+/)?.[0]
export const problems = []
export const watch = (page, label) => {
	page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label}] console: ${m.text().slice(0, 200)}`) })
	page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`))
	page.on('response', (r) => { if (r.status() >= 500 || r.status() === 429) problems.push(`[${label}] ${r.status()} ${r.request().method()} ${r.url()}`) })
}
let failures = 0
export const check = (name, ok, detail = '') => {
	if (!ok) failures++
	console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}
export const done = () => {
	if (problems.length) console.log('PROBLEMS:\n' + [...new Set(problems)].join('\n'))
	console.log(failures ? `${failures} FAILED` : 'ALL PASSED')
	if (failures) process.exitCode = 1
}
export const apiSignup = async (email, password) => {
	const r = await fetch(`${API}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json', origin: APP }, body: JSON.stringify({ email, password }) })
	if (r.status !== 201) throw new Error(`signup ${r.status} ${await r.text()}`)
}
export const uiLogin = async (page, email, password) => {
	await page.fill('#email', email)
	if (!(await page.isVisible('#password'))) await page.click('button[type=submit]')
	await page.waitForSelector('#password')
	await page.fill('#password', password)
	await page.click('button[type=submit]')
}

// Plain API session that keeps the auth cookie between calls.
export const apiSession = () => {
	let cookie = ''
	return async (method, path, body) => {
		const response = await fetch(`${API}${path}`, {
			method,
			headers: { 'content-type': 'application/json', origin: APP, ...(cookie && { cookie }) },
			body: body && JSON.stringify(body),
		})
		const setCookie = response.headers.getSetCookie?.() || []
		if (setCookie.length) cookie = setCookie.map((value) => value.split(';')[0]).join('; ')
		const data = await response.json().catch(() => ({}))
		if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${JSON.stringify(data)}`)
		return data
	}
}

// A signed-in API session for a new, verified account with a finished profile.
export const createVerifiedUser = async ({ email, password, name }, jobTitle) => {
	const call = apiSession()
	await call('POST', '/auth/signup', { email, password, language: 'ru' })
	await call('POST', '/auth/login', { email, password })
	const token = new URL(linkFrom(lastMailTo(email))).searchParams.get('token')
	await call('POST', '/auth/verify-email', { token })
	await call('PATCH', '/auth/setup-profile', { name, jobTitle, timezone: 'Europe/Kyiv' })
	const { _id } = await call('GET', '/auth/get-user')
	return { call, id: _id }
}
