import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import { after, before, beforeEach, describe, it } from 'node:test'

import { app } from '../index.js'
import { env } from '../config/env.js'
import Board from '../models/board.model.js'
import BoardInvite from '../models/boardInvite.model.js'
import BoardMember from '../models/boardMember.model.js'
import Session from '../models/session.model.js'
import User from '../models/user.model.js'
import { sessionCookie } from './helpers.js'

// One test per issue from the security audit, so none of them can come back unnoticed.

let mongoServer

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri(), { dbName: `security-${process.pid}` })
})
beforeEach(async () => {
	await Promise.all([Board, BoardInvite, BoardMember, Session, User].map((model) => model.deleteMany({})))
})
after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

const createUser = (email, fields = {}) => User.create({ email, name: email.split('@')[0], emailVerified: true, profileSetup: true, ...fields })

const boardWithAdmins = async () => {
	const owner = await createUser('owner@example.com')
	const admin = await createUser('admin@example.com')
	const otherAdmin = await createUser('other-admin@example.com')
	const board = await Board.create({ name: 'Launch', createdBy: owner._id })
	await BoardMember.create({ board: board._id, user: owner._id, role: 'admin' })
	await BoardMember.create({ board: board._id, user: admin._id, role: 'admin' })
	const otherMembership = await BoardMember.create({ board: board._id, user: otherAdmin._id, role: 'admin' })
	return { owner, admin, otherAdmin, otherMembership, board }
}

describe('cross-site requests', () => {
	it('blocks a state change that carries neither Origin, Referer nor our client header', async () => {
		const user = await createUser('csrf@example.com')
		const blocked = await request(app).post('/api/board/boards').set('X-Requested-With', '').set('Cookie', sessionCookie(user._id)).send({ name: 'Board' })
		assert.equal(blocked.status, 403)
		const foreign = await request(app).post('/api/board/boards').set('Origin', 'https://evil.example').set('Cookie', sessionCookie(user._id)).send({ name: 'Board' })
		assert.equal(foreign.status, 403)
		const ours = await request(app).post('/api/board/boards').set('Cookie', sessionCookie(user._id)).send({ name: 'Board' })
		assert.equal(ours.status, 201)
	})

	it('does not read large bodies before the caller is signed in', async () => {
		const large = { data: 'x'.repeat(1024 * 1024) }
		const image = await request(app).post(`/api/board/tasks/${new mongoose.Types.ObjectId()}/attachments/image`).send(large)
		assert.equal(image.status, 401, 'the image route turns strangers away before parsing')
		const elsewhere = await request(app).post('/api/auth/login/attachments/image').send(large)
		assert.equal(elsewhere.status, 413, 'other paths keep the small limit')
	})
})

describe('accounts are not revealed', () => {
	it('answers sign-up for a taken address exactly like a new one', async () => {
		await createUser('taken@example.com', { password: await bcrypt.hash('Password123!', 4) })
		const taken = await request(app).post('/api/auth/signup').send({ email: 'taken@example.com', password: 'Password123!' })
		assert.equal(taken.status, 201)
		assert.equal(taken.body.requiresVerification, true)
		assert.equal(await User.countDocuments({ email: 'taken@example.com' }), 1)
	})

	it('gives social-only accounts the same sign-in error as a wrong password', async () => {
		await createUser('social@example.com', { provider: 'google', providerUid: 'google-uid' })
		const response = await request(app).post('/api/auth/login').send({ email: 'social@example.com', password: 'Password123!' })
		assert.equal(response.status, 400)
		assert.equal(response.body.message, 'Credentials are not valid')
	})
})

describe('sessions', () => {
	it('rejects cookies that do not name a session', async () => {
		const user = await createUser('legacy@example.com')
		const legacy = [`jwt=${jwt.sign({ userId: user._id.toString(), sessionVersion: 0 }, env.jwtSecret)}`]
		assert.equal((await request(app).get('/api/auth/get-user').set('Cookie', legacy)).status, 401)
		assert.equal(await Session.countDocuments({ user: user._id }), 0, 'no session is created for it')
	})

	it('asks accounts without a password to sign in again before adding a passkey', async () => {
		const user = await createUser('passwordless@example.com', { provider: 'google', providerUid: 'google-uid' })
		const response = await request(app).post('/api/auth/passkeys/options').set('Cookie', sessionCookie(user._id))
		assert.equal(response.status, 401)
		assert.equal(response.body.code, 'reauth_required')
	})
})

describe('admin hierarchy', () => {
	it('lets only the owner change another admin', async () => {
		const { owner, admin, otherMembership, board } = await boardWithAdmins()
		const byAdmin = await request(app).patch(`/api/board/boards/${board._id}/members/${otherMembership._id}`).set('Cookie', sessionCookie(admin._id)).send({ role: 'member' })
		assert.equal(byAdmin.status, 403)
		const byOwner = await request(app).patch(`/api/board/boards/${board._id}/members/${otherMembership._id}`).set('Cookie', sessionCookie(owner._id)).send({ role: 'member' })
		assert.equal(byOwner.status, 200)
	})

	it('lets the owner revoke an invite link an admin made', async () => {
		const { owner, admin, board } = await boardWithAdmins()
		const created = await request(app).post(`/api/board/boards/${board._id}/invites`).set('Cookie', sessionCookie(admin._id)).send({ email: '', role: 'admin' })
		assert.equal(created.status, 201)
		const invite = await BoardInvite.findOne({ board: board._id, createdBy: admin._id })
		const revoked = await request(app).delete(`/api/board/boards/${board._id}/invites/${invite._id}`).set('Cookie', sessionCookie(owner._id))
		assert.equal(revoked.status, 200)
		assert.equal(await BoardInvite.countDocuments({ _id: invite._id }), 0)
	})
})
