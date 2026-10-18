import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { env } from '../config/env.js'
import { searchBackgroundPhotos } from '../lib/boardBackgrounds.js'

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

	it('without a key searches the curated set only', async () => {
		env.unsplashAccessKey = ''
		globalThis.fetch = () => assert.fail('no network without a key')
		const result = await searchBackgroundPhotos({ query: 'mountains' })
		assert.equal(result.source, 'curated')
		assert.ok(result.photos.length > 0)
		assert.equal((await searchBackgroundPhotos({ query: 'kittens' })).photos.length, 0)
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
		const result = await searchBackgroundPhotos({ query: 'forest-fallback' })
		assert.equal(result.source, 'curated')
	})
})
