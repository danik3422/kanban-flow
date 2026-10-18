import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { env } from '../config/env.js'
import { normalizeBackground, searchBackgroundPhotos } from '../lib/boardBackgrounds.js'

const originalFetch = globalThis.fetch
const originalKey = env.unsplashAccessKey

const unsplashPhoto = (id) => ({
	id,
	color: '#336699',
	urls: { raw: `https://images.unsplash.com/photo-${id}?ixid=x` },
	user: { name: 'Ana Lens', links: { html: 'https://unsplash.com/@ana' } },
	links: { download_location: `https://api.unsplash.com/photos/${id}/download` },
})

describe('board background photos', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch
		env.unsplashAccessKey = originalKey
	})

	it('without a key: the curated photos first, then endless Picsum photos to browse', async () => {
		env.unsplashAccessKey = ''
		const calls = []
		globalThis.fetch = async (url) => {
			calls.push(String(url))
			const list = Array.from({ length: 20 }, (_, index) => ({ id: String(100 + index), author: `Author ${index}`, width: index % 5 === 0 ? 1000 : 3000, height: 2000, url: `https://unsplash.com/photos/x${index}` }))
			return { ok: true, json: async () => list }
		}
		const first = await searchBackgroundPhotos({ page: 1 })
		assert.equal(first.source, 'curated')
		assert.equal(first.photos.length, 20)
		assert.equal(first.hasMore, true)
		assert.equal(calls.length, 0, 'the curated photos need no network')
		const second = await searchBackgroundPhotos({ page: 2 })
		assert.equal(second.source, 'curated')
		const third = await searchBackgroundPhotos({ page: 3 })
		assert.equal(third.source, 'picsum')
		assert.match(calls[0], /picsum\.photos\/v2\/list\?page=1&limit=20/)
		assert.equal(third.photos.length, 16, 'portrait photos are left out')
		assert.equal(third.photos[0].id, 'picsum-101')
		assert.equal(third.photos[0].author, 'Author 1')
		assert.equal(third.hasMore, true)
	})

	it('without a key: any search word reaches Wikimedia Commons, Ukrainian and Russian topics in English', async () => {
		env.unsplashAccessKey = ''
		const calls = []
		globalThis.fetch = async (url) => {
			calls.push(decodeURIComponent(String(url).replaceAll('+', ' ')))
			return {
				ok: true,
				json: async () => ({
					continue: { gsroffset: 30 },
					query: { pages: {
						1: { pageid: 1, index: 1, imageinfo: [{ width: 4000, height: 2600, thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cat.jpg/1920px-Cat.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Cat.jpg', extmetadata: { Artist: { value: '<a href="x">Ana Lens</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] },
						2: { pageid: 2, index: 2, imageinfo: [{ width: 2000, height: 3000, thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Tall.jpg/1920px-Tall.jpg' }] },
					} },
				}),
			}
		}
		const result = await searchBackgroundPhotos({ query: 'kittens' })
		assert.equal(result.source, 'commons', 'no curated match, so straight to Commons')
		assert.equal(result.photos.length, 1, 'only wide photos')
		assert.deepEqual(
			{ ...result.photos[0] },
			{ id: 'commons-1', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cat.jpg/1920px-Cat.jpg', thumb: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cat.jpg/500px-Cat.jpg', color: '#5b6470', author: 'Ana Lens', authorUrl: 'https://commons.wikimedia.org/wiki/File:Cat.jpg', license: 'CC BY-SA 4.0', source: 'Wikimedia Commons' },
		)
		assert.equal(result.hasMore, true)
		assert.match(calls[0], /gsrsearch=kittens filetype:bitmap/)
		await searchBackgroundPhotos({ query: 'горы-zz', page: 1 })
		await searchBackgroundPhotos({ query: 'ліс', page: 3 })
		assert.match(calls.at(-1), /gsrsearch=forest /, 'Ukrainian “ліс” searches “forest”')
		const curatedFirst = await searchBackgroundPhotos({ query: 'mountains' })
		assert.equal(curatedFirst.source, 'curated', 'matching curated photos come first')
	})

	it('saves a Picsum or Commons photo only from those hosts', () => {
		assert.equal(normalizeBackground({ type: 'photo', id: 'picsum-42', author: 'Jo', authorUrl: 'https://unsplash.com/photos/abc' }).url, 'https://picsum.photos/id/42/2400/1350')
		const commons = normalizeBackground({ type: 'photo', id: 'commons-7', url: 'https://upload.wikimedia.org/a.jpg', thumb: 'https://upload.wikimedia.org/b.jpg', author: 'Ana', license: 'CC BY-SA 4.0', authorUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg' })
		assert.equal(commons.source, 'Wikimedia Commons')
		assert.throws(() => normalizeBackground({ type: 'photo', id: 'commons-7', url: 'https://evil.example.com/a.jpg', thumb: 'https://upload.wikimedia.org/b.jpg' }))
		assert.throws(() => normalizeBackground({ type: 'photo', id: 'picsum-../../x' }))
	})

	it('with a key searches all of Unsplash, any word, page by page', async () => {
		env.unsplashAccessKey = 'test-key'
		const calls = []
		globalThis.fetch = async (url, options) => {
			calls.push({ url: String(url), auth: options.headers.Authorization })
			return { ok: true, json: async () => ({ total_pages: 40, results: [unsplashPhoto('kitten-1'), unsplashPhoto('kitten-2')] }) }
		}
		const first = await searchBackgroundPhotos({ query: 'kittens', page: 1 })
		assert.equal(first.source, 'unsplash')
		assert.equal(first.photos.length, 2)
		assert.equal(first.hasMore, true)
		assert.equal(first.photos[0].author, 'Ana Lens')
		assert.match(calls[0].url, /search\/photos\?query=kittens&page=1/)
		assert.equal(calls[0].auth, 'Client-ID test-key')
		await searchBackgroundPhotos({ query: 'kittens', page: 2 })
		assert.match(calls[1].url, /page=2/)
	})

	it('falls back to the curated set when Unsplash fails', async () => {
		env.unsplashAccessKey = 'test-key'
		globalThis.fetch = async () => ({ ok: false, status: 403 })
		const result = await searchBackgroundPhotos({ query: 'forest' })
		assert.equal(result.source, 'curated', 'Unsplash failing falls back to the curated photos')
	})
})
