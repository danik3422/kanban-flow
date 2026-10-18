// Screenshots every page on phone and desktop, in light and dark theme and in each
// language, and reports layout, touch-target, contrast and translation problems.
// Needs a running stack (node e2e/stack.mjs start).
//   node e2e/ui-audit.mjs [--pages=/login,/board] [--langs=en,uk,ru] [--themes=light,dark] [--viewports=mobile,desktop]
import fs from 'node:fs'
import path from 'node:path'
import { API, APP, TMP, lastMailTo, launch, linkFrom } from './lib.mjs'

const arg = (name, fallback) =>
	(process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1] || fallback).split(',').filter(Boolean)

const PUBLIC_PAGES = ['/', '/login', '/signup', '/login/resetpassword', '/no-such-page']
// Pages that only exist for an account in a particular onboarding state.
const ONBOARDING_PAGES = { '/verify-email': 'unverified', '/setup-profile': 'unsetup' }
const APP_PAGES = ['/workspaces', '/board', '/my-tasks', '/calendar', '/team', '/settings', '/profile']
const pages = arg('pages', [...PUBLIC_PAGES, ...Object.keys(ONBOARDING_PAGES), ...APP_PAGES].join(','))
const langs = arg('langs', 'en,uk,ru')
const themes = arg('themes', 'light,dark')
const viewports = {
	mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
	desktop: { viewport: { width: 1440, height: 900 } },
}
const selectedViewports = arg('viewports', 'mobile,desktop')

const outDir = path.join(TMP, 'ui-audit')
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

// Words that are correct in every language: product and provider names.
const TRANSLATION_ALLOWLIST = /^(KanbanHub|Kanban|Hub|Google|Microsoft|Apple|Passkey|Face|Touch|PIN|OK|ID|URL|UTC|Email|E2E|K|JPG|JPEG|PNG|WebP|GIF|MB|KB)$/i

const createSeededAccount = async (browser) => {
	const context = await browser.newContext()
	const request = context.request
	const email = `audit${Date.now()}@example.com`
	const password = 'Password123!'
	const signup = await request.post(`${API}/auth/signup`, { data: { email, password } })
	if (signup.status() !== 201) throw new Error(`Signup failed: ${signup.status()} ${await signup.text()}`)
	await request.post(`${API}/auth/login`, { data: { email, password } })
	const token = new URL(linkFrom(lastMailTo(email))).searchParams.get('token')
	await request.post(`${API}/auth/verify-email`, { data: { token } })
	await request.patch(`${API}/auth/setup-profile`, { data: { name: 'Olena Audit', jobTitle: 'Product designer', timezone: 'Europe/Kyiv' } })

	// A realistic board so layouts are judged with content, not empty states.
	const today = new Date()
	const day = (offset) => new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + offset)).toISOString().slice(0, 10)
	const me = await (await request.get(`${API}/auth/get-user`)).json()
	const board = await (await request.post(`${API}/board/boards`, { data: { name: 'Product launch' } })).json()
	await request.post(`${API}/board/boards`, { data: { name: 'Marketing site' } })
	const columns = []
	for (const title of ['Backlog', 'In progress', 'Review', 'Done']) {
		columns.push(await (await request.post(`${API}/board/boards/${board._id}/columns`, { data: { title } })).json())
	}
	const tasks = [
		[0, { title: 'Interview five customers about onboarding', priority: 'high', dueDate: day(2), labels: ['research'], assignees: [me._id] }],
		[0, { title: 'Draft pricing page copy', priority: 'medium', labels: ['content'] }],
		[1, { title: 'Polish the mobile navigation', priority: 'urgent', dueDate: day(0), assignees: [me._id], checklist: [{ text: 'Bottom bar', completed: true }, { text: 'Gestures', completed: false }] }],
		[1, { title: 'Set up product analytics events', dueDate: day(-1), assignees: [me._id] }],
		[2, { title: 'Review accessibility of the board', priority: 'low', labels: ['a11y'] }],
		[3, { title: 'Ship the audit fixes', labels: ['release'] }],
	]
	for (const [columnIndex, data] of tasks) {
		await request.post(`${API}/board/columns/${columns[columnIndex]._id}/task`, { data })
	}
	const state = await context.storageState()
	await context.close()
	return { state, boardId: board._id }
}

const createOnboardingAccount = async (browser, stage) => {
	const context = await browser.newContext()
	const email = `${stage}${Date.now()}@example.com`
	const password = 'Password123!'
	await context.request.post(`${API}/auth/signup`, { data: { email, password } })
	await context.request.post(`${API}/auth/login`, { data: { email, password } })
	if (stage === 'unsetup') {
		const token = new URL(linkFrom(lastMailTo(email))).searchParams.get('token')
		await context.request.post(`${API}/auth/verify-email`, { data: { token } })
	}
	const state = await context.storageState()
	await context.close()
	return state
}

const setLanguage = async (browser, state, language) => {
	const context = await browser.newContext({ storageState: state })
	await context.request.patch(`${API}/auth/settings`, { data: { language } })
	await context.close()
}

// Runs in the page: collects layout, touch-target, contrast and text findings.
const inspectPage = ({ isMobile, checkTranslation, allowlist }) => {
	const allow = new RegExp(allowlist, 'i')
	const isVisible = (element) => {
		const rect = element.getBoundingClientRect()
		const style = getComputedStyle(element)
		return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05
	}
	// Off-canvas drawers and hidden panels are not what the user sees.
	const isOnScreen = (element) => {
		if (!isVisible(element) || element.closest('[aria-hidden=true], [inert]')) return false
		const rect = element.getBoundingClientRect()
		return rect.right > 0 && rect.left < window.innerWidth
	}
	const describe = (element) => {
		const label = element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 40) || element.getAttribute('placeholder') || ''
		const className = typeof element.className === 'string' ? element.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''
		return `${element.tagName.toLowerCase()}${className ? `.${className}` : ''} "${label}"`
	}
	const findings = { overflow: [], touch: [], contrast: [], untranslated: [] }

	const pageWidth = document.documentElement.clientWidth
	if (document.documentElement.scrollWidth > pageWidth + 1) {
		const offenders = [...document.querySelectorAll('body *')]
			.filter((element) => isVisible(element) && element.getBoundingClientRect().right > pageWidth + 1)
			.filter((element) => !element.closest('[class*=scroll], [class*=kanban-grid], [class*=board-scroll]'))
			.slice(0, 5)
			.map(describe)
		findings.overflow.push(`page is ${document.documentElement.scrollWidth}px wide on a ${pageWidth}px screen: ${offenders.join('; ')}`)
	}

	if (isMobile) {
		const interactive = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button]')]
			.filter(isOnScreen)
			.filter((element) => {
				// A control inside its label is hit through the whole label (a switch row).
				const rect = (element.matches('input') && element.closest('label')) ? element.closest('label').getBoundingClientRect() : element.getBoundingClientRect()
				return rect.width < 44 || rect.height < 44
			})
		findings.touch = interactive.slice(0, 12).map((element) => {
			const rect = element.getBoundingClientRect()
			return `${describe(element)} is ${Math.round(rect.width)}x${Math.round(rect.height)}`
		})
		if (interactive.length > 12) findings.touch.push(`...and ${interactive.length - 12} more`)
	}

	const parse = (value) => {
		const match = value.match(/rgba?\(([^)]+)\)/)
		if (!match) return null
		const [r, g, b, a = 1] = match[1].split(/[ ,/]+/).filter(Boolean).map(Number)
		return { r, g, b, a }
	}
	const luminance = ({ r, g, b }) => {
		const channel = (value) => {
			const normalized = value / 255
			return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
		}
		return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
	}
	const backgroundOf = (element) => {
		const layers = []
		for (let node = element; node; node = node.parentElement) {
			const style = getComputedStyle(node)
			if (style.backgroundImage !== 'none') return null
			const color = parse(style.backgroundColor)
			if (color && color.a > 0) {
				layers.push(color)
				if (color.a >= 1) break
			}
		}
		let result = { r: 255, g: 255, b: 255 }
		for (const layer of layers.reverse()) {
			result = {
				r: layer.r * layer.a + result.r * (1 - layer.a),
				g: layer.g * layer.a + result.g * (1 - layer.a),
				b: layer.b * layer.a + result.b * (1 - layer.a),
			}
		}
		return result
	}
	const textElements = [...document.querySelectorAll('body *')].filter(
		(element) => isOnScreen(element) && [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim().length > 1),
	)
	const seen = new Set()
	for (const element of textElements) {
		const style = getComputedStyle(element)
		const color = parse(style.color)
		const background = backgroundOf(element)
		if (!color || !background) continue
		const lighter = Math.max(luminance(color), luminance(background))
		const darker = Math.min(luminance(color), luminance(background))
		const ratio = (lighter + 0.05) / (darker + 0.05)
		const size = parseFloat(style.fontSize)
		const isLarge = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
		if (ratio < (isLarge ? 3 : 4.5) && !element.closest('[disabled], [aria-disabled=true]')) {
			const key = `${describe(element)} ${ratio.toFixed(2)}`
			if (!seen.has(key)) {
				seen.add(key)
				findings.contrast.push(`${describe(element)} contrast ${ratio.toFixed(2)}:1 (needs ${isLarge ? 3 : 4.5})`)
			}
		}
	}
	findings.contrast = findings.contrast.slice(0, 12)

	if (checkTranslation) {
		const texts = new Set()
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
		while (walker.nextNode()) {
			const node = walker.currentNode
			const text = node.textContent.trim()
			if (!text || !node.parentElement || !isOnScreen(node.parentElement)) continue
			if (node.parentElement.closest('script, style, [data-i18n-ignore], .task-card, .task-title, [class*=board-name], [class*=room-name], [class*=column-title], [class*=column-header] h2, [class*=column-header] h3')) continue
			const words = text.match(/[A-Za-z]{2,}/g) || []
			if (words.length && !/@|https?:\/\//.test(text) && !words.every((word) => allow.test(word))) texts.add(text.slice(0, 60))
		}
		for (const element of document.querySelectorAll('[placeholder], [aria-label], [title]')) {
			if (!isOnScreen(element) || element.closest('[data-i18n-ignore]')) continue
			for (const attribute of ['placeholder', 'aria-label', 'title']) {
				// Names in quotes are user content (a board or person), not interface text.
				const value = element.getAttribute(attribute)?.replace(/[«“"][^»”"]*[»”"]/g, '').trim()
				const words = value?.match(/[A-Za-z]{2,}/g) || []
				if (words.length && !/@|https?:\/\//.test(value) && !words.every((word) => allow.test(word))) texts.add(`[${attribute}] ${value.slice(0, 60)}`)
			}
		}
		findings.untranslated = [...texts].slice(0, 25)
		if (texts.size > 25) findings.untranslated.push(`...and ${texts.size - 25} more`)
	}
	return findings
}

const browser = await launch()
const needsAccount = pages.some((page) => APP_PAGES.includes(page))
const account = needsAccount ? await createSeededAccount(browser) : null
const onboardingStates = {}
for (const [page, stage] of Object.entries(ONBOARDING_PAGES)) {
	if (pages.includes(page)) onboardingStates[page] = await createOnboardingAccount(browser, stage)
}
const report = []
let issueCount = 0

for (const lang of langs) {
	if (account) await setLanguage(browser, account.state, lang)
	for (const state of Object.values(onboardingStates)) await setLanguage(browser, state, lang)
	for (const viewportName of selectedViewports) {
		for (const theme of themes) {
			for (const pagePath of pages) {
				const isAppPage = APP_PAGES.includes(pagePath)
				const sessionState = isAppPage ? account.state : onboardingStates[pagePath]
				const context = await browser.newContext({ ...viewports[viewportName], ...(sessionState ? { storageState: sessionState } : {}) })
				await context.addInitScript(([selectedTheme, selectedLang]) => {
					localStorage.setItem('theme', selectedTheme)
					localStorage.setItem('kanban-language', selectedLang)
				}, [theme, lang])
				const page = await context.newPage()
				const consoleErrors = []
				page.on('console', (message) => {
					if (message.type() === 'error' && !/401|404/.test(message.text())) consoleErrors.push(message.text().slice(0, 160))
				})
				page.on('pageerror', (error) => consoleErrors.push(error.message))
				const url = pagePath === '/board' ? `/workspaces/${account.boardId}` : pagePath
				await page.goto(`${APP}${url}`, { waitUntil: 'networkidle' }).catch(() => {})
				await page.waitForTimeout(600)
				const name = `${pagePath === '/' ? 'home' : pagePath.slice(1).replaceAll('/', '-')}__${viewportName}__${theme}__${lang}`
				await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: viewportName === 'mobile' })
				const findings = await page.evaluate(inspectPage, {
					isMobile: viewportName === 'mobile',
					checkTranslation: lang !== 'en',
					allowlist: TRANSLATION_ALLOWLIST.source,
				})
				findings.console = consoleErrors.slice(0, 5)
				const lines = Object.entries(findings).flatMap(([kind, items]) => items.map((item) => `  - ${kind}: ${item}`))
				issueCount += lines.length
				if (lines.length) report.push(`### ${name}\n${lines.join('\n')}`)
				await context.close()
			}
		}
	}
}
await browser.close()

const summary = `# UI audit\n\nScreens: ${pages.length * langs.length * themes.length * selectedViewports.length}, findings: ${issueCount}\nScreenshots: ${outDir}\n\n${report.join('\n\n') || 'No findings.'}\n`
fs.writeFileSync(path.join(outDir, 'report.md'), summary)
console.log(summary.length > 12000 ? `${summary.slice(0, 12000)}\n...(full report in ${path.join(outDir, 'report.md')})` : summary)
