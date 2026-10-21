import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'

import { app } from '../index.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import User from '../models/user.model.js'
import { sessionCookie } from './helpers.js'

// Own board backgrounds and what a self-hosted server without email or internet needs.

let mongoServer
const PNG = 'data:image/png;base64,iVBORw0KGgo='

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri(), { dbName: `self-hosting-${process.pid}` })
})
beforeEach(async () => {
	await Promise.all([Board, BoardMember, User].map((model) => model.deleteMany({})))
})
after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

const createUser = (email) => User.create({ email, name: email.split('@')[0], emailVerified: true, profileSetup: true })
const boardFor = async () => {
	const owner = await createUser('owner@example.com')
	const member = await createUser('member@example.com')
	const board = await Board.create({ name: 'Launch', createdBy: owner._id })
	await BoardMember.create({ board: board._id, user: owner._id, role: 'admin' })
	await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
	return { owner, member, board }
}
const upload = (board, user) => request(app).post(`/api/board/boards/${board._id}/background/upload`).set('Cookie', sessionCookie(user._id))

describe('own board background', () => {
	it('uploads a photo, adjusts how it looks and removes the files when replaced', async () => {
		const { owner, board } = await boardFor()
		const uploaded = await upload(board, owner).send({ image: PNG, thumb: PNG, color: '#334455' })
		assert.equal(uploaded.status, 200)
		const background = uploaded.body.background
		assert.equal(background.type, 'upload')
		assert.match(background.url, new RegExp(`^/uploads/backgrounds/${board._id}/`))
		assert.equal((await request(app).get(background.url)).status, 200)

		const adjusted = await request(app).patch(`/api/board/boards/${board._id}`).set('Cookie', sessionCookie(owner._id))
			.send({ background: { type: 'upload', url: background.url, adjust: { x: 20, y: 80, blur: 6, dim: 30, brightness: 110, saturate: 80 } } })
		assert.equal(adjusted.status, 200)
		assert.deepEqual(adjusted.body.background.adjust, { x: 20, y: 80, blur: 6, dim: 30, brightness: 110, saturate: 80 })
		assert.equal(adjusted.body.background.url, background.url, 'the stored photo is kept')

		const replaced = await request(app).patch(`/api/board/boards/${board._id}`).set('Cookie', sessionCookie(owner._id)).send({ background: { type: 'gradient', key: 'ocean' } })
		assert.equal(replaced.status, 200)
		await new Promise((resolve) => setTimeout(resolve, 50))
		assert.equal((await request(app).get(background.url)).status, 404, 'the old photo is deleted')
	})

	it('accepts only photos this board already has, and only from board admins', async () => {
		const { owner, member, board } = await boardFor()
		assert.equal((await upload(board, member).send({ image: PNG, thumb: PNG })).status, 403)
		const foreign = await request(app).patch(`/api/board/boards/${board._id}`).set('Cookie', sessionCookie(owner._id))
			.send({ background: { type: 'upload', url: '/uploads/backgrounds/000000000000000000000000/x.png' } })
		assert.equal(foreign.status, 400)
		assert.equal((await upload(board, owner).send({ image: 'data:text/html;base64,PGgxPg==', thumb: PNG })).status, 400)
	})
})

describe('self-hosted server', () => {
	afterEach(() => {
		delete process.env.EMAIL_VERIFICATION
	})

	it('tells the web app what it offers', async () => {
		const config = await request(app).get('/api/config')
		assert.equal(config.status, 200)
		assert.deepEqual(Object.keys(config.body).sort(), ['email', 'emailVerification', 'photos', 'selfHosted', 'signup'])
	})

	it('signs people straight in when there is no email to confirm with', async () => {
		process.env.EMAIL_VERIFICATION = 'off'
		const signup = await request(app).post('/api/auth/signup').send({ email: 'new@example.com', password: 'Password123!' })
		assert.equal(signup.status, 201)
		assert.equal(signup.body.emailVerified, true)
		assert.ok(signup.headers['set-cookie']?.some((cookie) => cookie.startsWith('jwt=')))
		const again = await request(app).post('/api/auth/signup').send({ email: 'new@example.com', password: 'Password123!' })
		assert.equal(again.status, 409)
	})

	it('lets only the first person sign up when sign-up is closed', async () => {
		process.env.EMAIL_VERIFICATION = 'off'
		const { env } = await import('../config/env.js')
		env.signupOpen = false
		try {
			assert.equal((await request(app).post('/api/auth/signup').send({ email: 'admin@example.com', password: 'Password123!' })).status, 201, 'the first account is the admin')
			const second = await request(app).post('/api/auth/signup').send({ email: 'stranger@example.com', password: 'Password123!' })
			assert.equal(second.status, 403)
		} finally {
			env.signupOpen = true
		}
	})

	it('accepts changes from a page served at this server’s own address', async () => {
		const user = await createUser('lan@example.com')
		const sameHost = await request(app).post('/api/board/boards').set('Host', '192.168.1.20:8080').set('Origin', 'http://192.168.1.20:8080').set('Cookie', sessionCookie(user._id)).send({ name: 'Home server' })
		assert.equal(sameHost.status, 201)
		const otherHost = await request(app).post('/api/board/boards').set('Host', '192.168.1.20:8080').set('Origin', 'http://evil.example').set('Cookie', sessionCookie(user._id)).send({ name: 'Nope' })
		assert.equal(otherHost.status, 403)
	})
})
