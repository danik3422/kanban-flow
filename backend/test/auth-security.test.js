import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { assertCurrentPassword, assertProviderEmailVerified, assertProviderIdentityAvailable } from '../controllers/auth.controller.js'
import User from '../models/user.model.js'

let mongoServer

before(async () => {
	mongoServer = await MongoMemoryServer.create()
	await mongoose.connect(mongoServer.getUri())
	await User.init()
})

after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

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

	it('enforces unique provider identities', async () => {
		await User.create({ email: 'provider-one@example.com', provider: 'google', providerUid: 'google-uid' })
		await assert.rejects(
			User.create({ email: 'provider-two@example.com', provider: 'google', providerUid: 'google-uid' }),
			(error) => error.code === 11000,
		)
	})

	it('rejects a provider identity owned by another user', async () => {
		const owner = await User.create({ email: 'linked@example.com', provider: 'google', providerUid: 'owned-uid' })
		await assert.rejects(
			assertProviderIdentityAvailable({ provider: 'google', providerUid: 'owned-uid', userId: new mongoose.Types.ObjectId() }),
			(error) => error.statusCode === 409 && error.message === 'This provider is already linked to another account.',
		)
		assert.ok(owner._id)
	})

	it('requires the current password for provider linking', async () => {
		const user = { password: await bcrypt.hash('CorrectPassword123!', 10) }
		await assert.rejects(
			assertCurrentPassword(user, 'WrongPassword123!'),
			(error) => error.statusCode === 401 && error.message === 'Re-authentication required.',
		)
		await assertCurrentPassword(user, 'CorrectPassword123!')
	})
})