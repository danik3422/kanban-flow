import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assertProviderEmailVerified } from '../controllers/auth.controller.js'

describe('social auth security helpers', () => {
	it('rejects an unverified provider email', () => {
		assert.throws(
			() => assertProviderEmailVerified({ email_verified: false }),
			(error) => error.statusCode === 403 && error.message === 'Provider email must be verified before continuing.',
		)
	})

	it('accepts a verified provider email', () => {
		assert.doesNotThrow(() => assertProviderEmailVerified({ email_verified: true }))
	})
})