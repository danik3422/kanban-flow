import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import bcrypt from 'bcrypt'
import { getAuth } from 'firebase-admin/auth'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

import admin from '../lib/firebaseAdmin.js'
import { app } from '../index.js'
import { assertCurrentPassword, assertProviderEmailVerified, assertProviderIdentityAvailable, connectSocialAccount, getDuplicateAuthErrorMessage, verifySocialProviderToken } from '../controllers/auth.controller.js'
import User from '../models/user.model.js'

let mongoServer

const withFirebaseVerifier = async (verifyIdToken, callback) => {
	if (!admin.getApps().length) admin.initializeApp({ projectId: 'security-test' })
	const firebaseAuth = getAuth()
	const originalVerifyIdToken = firebaseAuth.verifyIdToken
	firebaseAuth.verifyIdToken = verifyIdToken
	try {
		return await callback()
	} finally {
		firebaseAuth.verifyIdToken = originalVerifyIdToken
	}
}

before(async () => {
	mongoServer = await MongoMemoryServer.create()
	// A database of its own, so another test run or a local stack can never share or wipe this data.
	await mongoose.connect(mongoServer.getUri(), { dbName: `auth-security-${process.pid}` })
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

	it('enforces unique linked provider identities', async () => {
		await User.create({
			email: 'linked-one@example.com',
			password: await bcrypt.hash('Password123!', 10),
			linkedProviders: [{ provider: 'google', providerUid: 'linked-google-uid' }],
		})
		await assert.rejects(
			User.create({
				email: 'linked-two@example.com',
				password: await bcrypt.hash('Password123!', 10),
				linkedProviders: [{ provider: 'google', providerUid: 'linked-google-uid' }],
			}),
			(error) => error.code === 11000,
		)
	})

	it('requires the current password for provider linking', async () => {
		const user = { password: await bcrypt.hash('CorrectPassword123!', 10) }
		await assert.rejects(
			assertCurrentPassword(user, 'WrongPassword123!'),
			(error) => error.statusCode === 401 && error.message === 'Re-authentication required.',
		)
		await assertCurrentPassword(user, 'CorrectPassword123!')
	})

	it('maps Mongo duplicate keys to an auth conflict', () => {
		assert.equal(getDuplicateAuthErrorMessage({ code: 11000 }), 'Email or provider identity is already registered.')
		assert.equal(getDuplicateAuthErrorMessage({ code: 500 }), null)
	})

	it('rejects a token from provider A claimed as provider B', async () => {
		await withFirebaseVerifier(async () => ({
			email: 'user@example.com',
			email_verified: true,
			firebase: { sign_in_provider: 'google.com' },
		}), async () => {
			await assert.rejects(
				verifySocialProviderToken('token', 'microsoft'),
				(error) => error.statusCode === 401,
			)
		})
	})

	it('rejects an expired provider token', async () => {
		await withFirebaseVerifier(async () => {
			const error = new Error('expired')
			error.code = 'auth/id-token-expired'
			throw error
		}, async () => {
			await assert.rejects(
				verifySocialProviderToken('expired-token', 'google'),
				(error) => error.statusCode === 401 && error.message === 'Invalid or expired provider token.',
			)
		})
	})

	it('checks revocation when verifying provider tokens', async () => {
		let checkRevoked
		await withFirebaseVerifier(async (_idToken, receivedCheckRevoked) => {
			checkRevoked = receivedCheckRevoked
			return {
				email: 'user@example.com',
				email_verified: true,
				firebase: { sign_in_provider: 'google.com' },
			}
		}, async () => {
			await verifySocialProviderToken('token', 'google')
		})
		assert.equal(checkRevoked, true)
	})

	it('rejects an unverified provider token before local-account matching', async () => {
		await User.create({ email: 'local-match@example.com', password: await bcrypt.hash('Password123!', 10) })
		await withFirebaseVerifier(async () => ({
			email: 'local-match@example.com',
			email_verified: false,
			firebase: { sign_in_provider: 'google.com' },
		}), async () => {
			await assert.rejects(
				verifySocialProviderToken('token', 'google'),
				(error) => error.statusCode === 403,
			)
		})
	})

	it('allows only one concurrent signup for the same email', async () => {
		const results = await Promise.allSettled([
			User.create({ email: 'race@example.com', provider: 'google', providerUid: 'race-1' }),
			User.create({ email: 'race@example.com', provider: 'google', providerUid: 'race-2' }),
		])
		assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
		assert.equal(results.filter((result) => result.status === 'rejected' && result.reason?.code === 11000).length, 1)
	})

	it('never signs in a different provider account that claims the same email', async () => {
		await User.create({ email: 'uid-victim@example.com', provider: 'microsoft', providerUid: 'victim-uid', emailVerified: true })
		await withFirebaseVerifier(async () => ({
			uid: 'attacker-uid',
			email: 'uid-victim@example.com',
			email_verified: true,
			firebase: { sign_in_provider: 'microsoft.com' },
		}), async () => {
			const response = await request(app).post('/api/auth/social/login').send({ idToken: 'token', provider: 'microsoft' })
			assert.equal(response.status, 409)
			assert.equal(response.headers['set-cookie'], undefined)
		})
	})

	it('signs in the matching provider identity and binds legacy accounts on first sign-in', async () => {
		const legacy = await User.create({ email: 'uid-legacy@example.com', provider: 'google', providerUid: null, emailVerified: true })
		await withFirebaseVerifier(async () => ({
			uid: 'legacy-google-uid',
			email: 'uid-legacy@example.com',
			email_verified: true,
			firebase: { sign_in_provider: 'google.com' },
		}), async () => {
			const first = await request(app).post('/api/auth/social/login').send({ idToken: 'token', provider: 'google' })
			assert.equal(first.status, 200)
			assert.equal((await User.findById(legacy._id)).providerUid, 'legacy-google-uid')
			const again = await request(app).post('/api/auth/social/login').send({ idToken: 'token', provider: 'google' })
			assert.equal(again.status, 200)
		})
	})

	it('rejects provider linking without a session', async () => {
		const response = await request(app)
			.post('/api/auth/social/connect')
			.send({ idToken: 'token', provider: 'google', currentPassword: 'Password123!' })
		assert.equal(response.status, 401)
	})

	it('rejects linking when the provider email belongs to another session user', async () => {
		const providerOwner = await User.create({ email: 'provider-owner@example.com', password: await bcrypt.hash('Password123!', 10) })
		const sessionUser = await User.create({ email: 'session-user@example.com', password: await bcrypt.hash('Password123!', 10) })
		const response = {}
		const res = {
			status(code) {
				response.status = code
				return { json(body) { response.body = body } }
			},
		}

		await withFirebaseVerifier(async () => ({
			uid: 'foreign-uid',
			email: providerOwner.email,
			email_verified: true,
			firebase: { sign_in_provider: 'google.com' },
		}), async () => {
			await connectSocialAccount({
				body: { idToken: 'token', provider: 'google', currentPassword: 'Password123!' },
				user: { _id: sessionUser._id, email: sessionUser.email },
			}, res)
		})
		assert.equal(response.status, 409)
	})

	it('requires re-authentication before checking provider ownership', async () => {
		const providerOwner = await User.create({
			email: 'provider-owner-order@example.com',
			provider: 'google',
			providerUid: 'occupied-order-uid',
		})
		const sessionUser = await User.create({
			email: 'session-user-order@example.com',
			password: await bcrypt.hash('CorrectPassword123!', 10),
		})
		const response = {}
		const res = {
			status(code) {
				response.status = code
				return { json(body) { response.body = body } }
			},
		}

		await withFirebaseVerifier(async () => ({
			uid: providerOwner.providerUid,
			email: sessionUser.email,
			email_verified: true,
			firebase: { sign_in_provider: 'google.com' },
		}), async () => {
			await connectSocialAccount({
				body: {
					idToken: 'token',
					provider: 'google',
					currentPassword: 'WrongPassword123!',
				},
				user: { _id: sessionUser._id },
			}, res)
		})

		assert.equal(response.status, 401)
		assert.equal(response.body.message, 'Re-authentication required.')
	})
})
describe('signing out other sessions', () => {
	const cookieFor = (user, sessionVersion = 0) => [`jwt=${jwt.sign({ userId: user._id.toString(), sessionVersion }, env.jwtSecret)}`]

	it('ends every other session and keeps this device signed in', async () => {
		const user = await User.create({ email: 'sessions@example.com', name: 'Sessions', emailVerified: true, profileSetup: true })
		const thisDevice = cookieFor(user)
		const otherDevice = cookieFor(user)

		const response = await request(app).post('/api/auth/sessions/sign-out-others').set('Cookie', thisDevice)
		assert.equal(response.status, 204)
		const freshCookie = response.headers['set-cookie']?.find((cookie) => cookie.startsWith('jwt='))
		assert.ok(freshCookie, 'this device gets a new session cookie')

		const stale = await request(app).get('/api/auth/get-user').set('Cookie', otherDevice)
		assert.equal(stale.status, 401)
		const fresh = await request(app).get('/api/auth/get-user').set('Cookie', [freshCookie.split(';')[0]])
		assert.equal(fresh.status, 200)
		assert.equal(fresh.body.email, 'sessions@example.com')
		assert.equal((await User.findById(user._id).select('sessionVersion')).sessionVersion, 1)
	})

	it('requires a signed-in session', async () => {
		const response = await request(app).post('/api/auth/sessions/sign-out-others')
		assert.equal(response.status, 401)
	})
})
