import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cacheKey, peekCache, writeCache } from './apiCache.js'

describe('saved API answers', () => {
	it('gives the same request the same key, whatever the order or empty values', () => {
		assert.equal(cacheKey('/board/calendar', { to: '2026-10-31', from: '2026-10-01', board: '' }), '/board/calendar?from=2026-10-01&to=2026-10-31')
		assert.equal(cacheKey('/board/calendar', { from: '2026-10-01', to: '2026-10-31' }), cacheKey('/board/calendar', { to: '2026-10-31', from: '2026-10-01' }))
		assert.equal(cacheKey('/board/boards'), '/board/boards')
	})

	it('keeps nothing until an account owns the cache', () => {
		writeCache('/board/boards', [{ _id: 'b1' }])
		assert.equal(peekCache('/board/boards'), undefined)
	})
})
