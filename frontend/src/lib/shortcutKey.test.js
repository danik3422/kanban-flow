import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shortcutKey } from './shortcutKey.js'

describe('shortcutKey', () => {
	it('reads Latin letters as typed and other layouts by key position', () => {
		assert.equal(shortcutKey({ key: 'N', code: 'KeyN' }), 'n')
		assert.equal(shortcutKey({ key: 'т', code: 'KeyN' }), 'n')
		assert.equal(shortcutKey({ key: 'л', code: 'KeyK' }), 'k')
		assert.equal(shortcutKey({ key: 'a', code: 'KeyQ' }), 'a')
		assert.equal(shortcutKey({ key: ',', code: 'Slash', shiftKey: true }), '?')
		assert.equal(shortcutKey({ key: '.', code: 'Slash' }), '/')
		assert.equal(shortcutKey({ key: 'ArrowUp', code: 'ArrowUp' }), 'arrowup')
	})
})
