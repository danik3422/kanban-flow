import test from 'node:test'
import assert from 'node:assert/strict'

import { pageMetaFor, SEO_LANGUAGES, SITE_URL } from './seo.js'

const PUBLIC_ROUTES = ['/', '/about', '/self-hosting', '/login', '/signup']
const ALL_ROUTES = [...PUBLIC_ROUTES, '/public/abc123', '/invite/abc123', '/no-such-page', '/workspaces', '/workspaces/b1', '/my-tasks', '/calendar', '/team', '/profile', '/settings', '/setup-profile', '/login/resetpassword', '/verify-email']

test('titles fit in 60 characters and descriptions in 155, in every language', () => {
	for (const language of SEO_LANGUAGES) {
		for (const route of ALL_ROUTES) {
			const meta = pageMetaFor(route, language)
			assert.ok(meta.title.length <= 60, `${language} ${route} title is ${meta.title.length} chars`)
			assert.ok(meta.description.length <= 155, `${language} ${route} description is ${meta.description.length} chars`)
			assert.ok(meta.description.length >= 70, `${language} ${route} description is too short`)
		}
	}
})

test('public pages have distinct titles and descriptions', () => {
	for (const language of SEO_LANGUAGES) {
		const routes = [...PUBLIC_ROUTES, '/public/x', '/invite/x', '/missing']
		const metas = routes.map((route) => pageMetaFor(route, language))
		assert.equal(new Set(metas.map((meta) => meta.title)).size, routes.length)
		assert.equal(new Set(metas.map((meta) => meta.description)).size, routes.length)
	}
})

test('marketing and sign-in pages are indexable with a canonical on the production domain', () => {
	for (const route of PUBLIC_ROUTES) {
		const meta = pageMetaFor(route, 'en')
		assert.match(meta.robots, /^index,follow/)
		assert.equal(meta.canonical, `${SITE_URL}${route}`)
		assert.equal(meta.url, meta.canonical)
	}
})

test('trailing slashes, query strings and hashes do not change the canonical', () => {
	assert.equal(pageMetaFor('/about/', 'en').canonical, `${SITE_URL}/about`)
	assert.equal(pageMetaFor('/login?redirect=%2Fworkspaces', 'en').canonical, `${SITE_URL}/login`)
	assert.equal(pageMetaFor('/#top', 'en').canonical, `${SITE_URL}/`)
})

test('shared boards, invites and signed-in pages are noindex,nofollow without a canonical', () => {
	for (const route of ['/public/abc', '/invite/abc', '/invite', '/workspaces', '/workspaces/123', '/my-tasks', '/settings', '/profile/edit', '/login/resetpassword']) {
		const meta = pageMetaFor(route, 'en')
		assert.equal(meta.robots, 'noindex,nofollow', route)
		assert.equal(meta.canonical, null, route)
	}
})

test('unknown pages are noindex but keep links followable', () => {
	const meta = pageMetaFor('/nope', 'en')
	assert.equal(meta.robots, 'noindex,follow')
	assert.equal(meta.title, 'Page not found — KanbanHub')
	assert.equal(meta.canonical, null)
})

test('copy and og:locale follow the interface language, falling back to English', () => {
	assert.equal(pageMetaFor('/', 'uk').locale, 'uk_UA')
	assert.deepEqual(pageMetaFor('/', 'uk').alternateLocales, ['en_US', 'ru_RU'])
	assert.equal(pageMetaFor('/', 'ru').locale, 'ru_RU')
	assert.notEqual(pageMetaFor('/', 'uk').title, pageMetaFor('/', 'en').title)
	assert.deepEqual(pageMetaFor('/about', 'de'), pageMetaFor('/about', 'en'))
	assert.equal(pageMetaFor('/my-tasks', 'ru').title, 'Мои задачи — KanbanHub')
})
