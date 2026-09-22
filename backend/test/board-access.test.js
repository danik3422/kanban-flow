import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import { after, before, beforeEach, describe, it } from 'node:test'

import { env } from '../config/env.js'
import { app } from '../index.js'
import Board from '../models/board.model.js'
import BoardActivity from '../models/boardActivity.model.js'
import BoardInvite from '../models/boardInvite.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Notification from '../models/notification.model.js'
import PasswordResetToken from '../models/passwordResetToken.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import User from '../models/user.model.js'

let mongoServer

const createUser = (email, name = email.split('@')[0]) =>
	User.create({
		email,
		name,
		emailVerified: true,
		profileSetup: true,
	})

const authCookie = (userId) => {
	const token = jwt.sign({ userId: userId.toString() }, env.jwtSecret)
	return [`jwt=${token}`]
}

const createInvite = async ({ boardId, email = '', role = 'member' }) => {
	const rawToken = `invite-${crypto.randomBytes(16).toString('hex')}`
	const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
	const invite = await BoardInvite.create({
		board: boardId,
		email,
		role,
		tokenHash,
		createdBy: (await Board.findById(boardId)).createdBy,
		expiresAt: new Date(Date.now() + 60_000),
	})
	return { invite, rawToken }
}

const createBoardWithOwner = async () => {
	const owner = await createUser('owner@example.com', 'Owner')
	const board = await Board.create({ name: 'Private board', createdBy: owner._id })
	await BoardMember.create({ board: board._id, user: owner._id, role: 'admin' })
	return { owner, board }
}

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri())
})

beforeEach(async () => {
	await Promise.all([
		BoardInvite.deleteMany({}),
		BoardActivity.deleteMany({}),
		Notification.deleteMany({}),
		BoardMember.deleteMany({}),
		Board.deleteMany({}),
		PasswordResetToken.deleteMany({}),
		User.deleteMany({}),
	])
})

after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

describe('board access and invitation flow', () => {
	it('blocks state-changing requests from an untrusted origin', async () => {
		const response = await request(app)
			.post('/api/auth/signup')
			.set('Origin', 'https://attacker.example')
			.send({ email: 'blocked@example.com', password: 'Password123!' })

		assert.equal(response.status, 403)
		assert.equal(await User.findOne({ email: 'blocked@example.com' }), null)
	})

	it('allows state-changing requests from a configured origin', async () => {
		const response = await request(app)
			.post('/api/auth/signup')
			.set('Origin', env.corsOrigin[0])
			.send({ email: 'allowed@example.com', password: 'Password123!' })

		assert.notEqual(response.status, 403)
	})

	it('blocks unverified users from application APIs while allowing auth status checks', async () => {
		const user = await User.create({
			email: 'unverified-api@example.com',
			password: await bcrypt.hash('Password123!', 10),
			emailVerified: false,
		})
		const cookie = authCookie(user._id)

		const userResponse = await request(app)
			.get('/api/auth/get-user')
			.set('Cookie', cookie)
		const boardResponse = await request(app)
			.get('/api/board/boards')
			.set('Cookie', cookie)

		assert.equal(userResponse.status, 200)
		assert.equal(boardResponse.status, 403)
		assert.equal(boardResponse.body.code, 'email_verification_required')
	})

	it('does not keep a local account when its verification email cannot be sent', async () => {
		const originalBrevoApiKey = env.brevoApiKey
		env.brevoApiKey = ''
		try {
			const response = await request(app)
				.post('/api/auth/signup')
				.send({ email: 'email-failed@example.com', password: 'Password123!' })

			assert.equal(response.status, 503)
			assert.equal(
				await User.findOne({ email: 'email-failed@example.com' }),
				null,
			)
		} finally {
			env.brevoApiKey = originalBrevoApiKey
		}
	})

	it('redirects only a correctly authenticated unverified user to email verification', async () => {
		await User.create({
			email: 'unverified@example.com',
			password: await bcrypt.hash('Password123!', 10),
			emailVerified: false,
		})

		const unverifiedResponse = await request(app)
			.post('/api/auth/login')
			.send({ email: 'unverified@example.com', password: 'Password123!' })
		const incorrectPasswordResponse = await request(app)
			.post('/api/auth/login')
			.send({ email: 'unverified@example.com', password: 'WrongPassword123!' })

		assert.equal(unverifiedResponse.status, 200)
		assert.equal(unverifiedResponse.body.requiresVerification, true)
		assert.equal(unverifiedResponse.body.email, 'unverified@example.com')
		assert.equal(incorrectPasswordResponse.status, 400)
		assert.equal(incorrectPasswordResponse.body.code, undefined)
	})

	it('keeps an unverified account and its current token when a verification email resend fails', async () => {
		const user = await User.create({
			email: 'resend@example.com',
			password: await bcrypt.hash('Password123!', 10),
			emailVerified: false,
			emailVerificationTokenHash: 'existing-verification-token',
			emailVerificationTokenExpiresAt: new Date(Date.now() + 60_000),
		})
		const originalBrevoApiKey = env.brevoApiKey
		env.brevoApiKey = ''
		try {
			const cookie = authCookie(user._id)
			const existingResponse = await request(app)
				.post('/api/auth/verify-email/resend')
				.set('Cookie', cookie)
				.send({ email: 'resend@example.com' })
			const unauthenticatedResponse = await request(app)
				.post('/api/auth/verify-email/resend')
				.send({ email: 'missing@example.com' })

			assert.equal(existingResponse.status, 503)
			assert.equal(unauthenticatedResponse.status, 401)
			assert.equal(
				(await User.findOne({ email: 'resend@example.com' })).emailVerificationTokenHash,
				'existing-verification-token',
			)
		} finally {
			env.brevoApiKey = originalBrevoApiKey
		}
	})

	it('enforces the resend cooldown on the server before sending a new verification email', async () => {
		const user = await User.create({
			email: 'cooldown@example.com',
			password: await bcrypt.hash('Password123!', 10),
			emailVerified: false,
			emailVerificationLastSentAt: new Date(Date.now() - 30_000),
		})

		const cookie = authCookie(user._id)
		const response = await request(app)
			.post('/api/auth/verify-email/resend')
			.set('Cookie', cookie)
			.send({ email: 'cooldown@example.com' })

		assert.equal(response.status, 429)
		assert.equal(response.body.code, 'cooldown_active')
		assert.ok(response.body.retryAfter > 0)
	})

	it('allows a reset token to be claimed only once under concurrency', async () => {
		const password = await bcrypt.hash('OldPassword123!', 10)
		const user = await User.create({
			email: 'reset@example.com',
			password,
			emailVerified: true,
			profileSetup: true,
		})
		const rawToken = crypto.randomBytes(32).toString('hex')
		await PasswordResetToken.create({
			user: user._id,
			tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
			expiresAt: new Date(Date.now() + 60_000),
		})

		const responses = await Promise.all([
			request(app).post('/api/auth/password-reset/confirm').send({ token: rawToken, password: 'NewPassword123!' }),
			request(app).post('/api/auth/password-reset/confirm').send({ token: rawToken, password: 'NewPassword123!' }),
		])

		assert.deepEqual(responses.map((response) => response.status).sort(), [200, 410])
		assert.ok((await PasswordResetToken.findOne({ user: user._id })).usedAt)
	})

	it('invalidates an existing session after changing the password', async () => {
		const password = await bcrypt.hash('OldPassword123!', 10)
		const user = await User.create({
			email: 'change-session@example.com',
			password,
			emailVerified: true,
			profileSetup: true,
		})
		const oldSession = authCookie(user._id)

		const changeResponse = await request(app)
			.patch('/api/auth/change-password')
			.set('Cookie', oldSession)
			.send({ currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' })
		assert.equal(changeResponse.status, 200)

		const oldSessionResponse = await request(app)
			.get('/api/auth/get-user')
			.set('Cookie', oldSession)
		assert.equal(oldSessionResponse.status, 401)
	})

	it('invalidates an existing session after a password reset', async () => {
		const password = await bcrypt.hash('OldPassword123!', 10)
		const user = await User.create({
			email: 'reset-session@example.com',
			password,
			emailVerified: true,
			profileSetup: true,
		})
		const oldSession = authCookie(user._id)
		const rawToken = crypto.randomBytes(32).toString('hex')
		await PasswordResetToken.create({
			user: user._id,
			tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
			expiresAt: new Date(Date.now() + 60_000),
		})

		const resetResponse = await request(app)
			.post('/api/auth/password-reset/confirm')
			.send({ token: rawToken, password: 'ResetPassword123!' })
		assert.equal(resetResponse.status, 200)

		const oldSessionResponse = await request(app)
			.get('/api/auth/get-user')
			.set('Cookie', oldSession)
		assert.equal(oldSessionResponse.status, 401)
	})

	it('rejects protected requests without a session', async () => {
		const response = await request(app).get('/api/board/boards')

		assert.equal(response.status, 401)
	})

	it('does not allow setup-profile to change a password', async () => {
		const user = await createUser('profile@example.com', 'Profile User')
		const response = await request(app)
			.patch('/api/auth/setup-profile')
			.set('Cookie', authCookie(user._id))
			.send({ name: 'Updated User', password: 'Password123!' })

		assert.equal(response.status, 400)
		const updatedUser = await User.findById(user._id).select('+password')
		assert.equal(updatedUser.password, undefined)
	})

	it('returns only public user fields from get-user', async () => {
		const user = await User.create({
			email: 'private-fields@example.com',
			password: 'hashed-password',
			name: 'Private Fields',
			emailVerified: true,
			profileSetup: true,
			emailVerificationTokenHash: 'verification-hash',
			emailVerificationTokenExpiresAt: new Date(Date.now() + 60_000),
		})

		const response = await request(app)
			.get('/api/auth/get-user')
			.set('Cookie', authCookie(user._id))

		assert.equal(response.status, 200)
		assert.equal(response.body.email, user.email)
		assert.equal(response.body.name, user.name)
		assert.equal(response.body.password, undefined)
		assert.equal(response.body.sessionVersion, undefined)
		assert.equal(response.body.emailVerificationTokenHash, undefined)
		assert.equal(response.body.emailVerificationTokenExpiresAt, undefined)
	})

	it('rejects social provider claims on public signup', async () => {
		const response = await request(app)
			.post('/api/auth/signup')
			.send({
				email: 'claimed-google@example.com',
				password: 'Password123!',
				provider: 'google',
			})

		assert.equal(response.status, 400)
		assert.equal(await User.findOne({ email: 'claimed-google@example.com' }), null)
	})

	it('stores the selected board visibility and rejects invalid values', async () => {
		const { owner } = await createBoardWithOwner()
		const workspaceResponse = await request(app)
			.post('/api/board/boards')
			.set('Cookie', authCookie(owner._id))
			.send({ name: 'Workspace room', visibility: 'workspace' })
		assert.equal(workspaceResponse.status, 201)
		assert.equal(workspaceResponse.body.visibility, 'workspace')

		const publicResponse = await request(app)
			.post('/api/board/boards')
			.set('Cookie', authCookie(owner._id))
			.send({ name: 'Public room', visibility: 'public' })
		assert.equal(publicResponse.status, 201)
		assert.equal(publicResponse.body.visibility, 'public')

		const invalidResponse = await request(app)
			.post('/api/board/boards')
			.set('Cookie', authCookie(owner._id))
			.send({ name: 'Invalid room', visibility: 'everyone' })
		assert.equal(invalidResponse.status, 400)
	})

	it('keeps workspace rooms private from non-members', async () => {
		const { owner } = await createBoardWithOwner()
		const viewer = await createUser('discoverable-viewer@example.com', 'Viewer')
		const board = await Board.create({ name: 'Workspace visible', createdBy: owner._id, visibility: 'workspace' })
		const column = await Column.create({ board: board._id, title: 'Visible column' })

		const boardsResponse = await request(app)
			.get('/api/board/boards')
			.set('Cookie', authCookie(viewer._id))
		assert.equal(boardsResponse.status, 200)
		assert.deepEqual(boardsResponse.body, [])

		const columnsResponse = await request(app)
			.get(`/api/board/boards/${board._id}/columns`)
			.set('Cookie', authCookie(viewer._id))
		assert.equal(columnsResponse.status, 403)

		const activityResponse = await request(app)
			.get(`/api/board/boards/${board._id}/activity`)
			.set('Cookie', authCookie(viewer._id))
		assert.equal(activityResponse.status, 403)

		const membersResponse = await request(app)
			.get(`/api/board/boards/${board._id}/members`)
			.set('Cookie', authCookie(viewer._id))
		assert.equal(membersResponse.status, 403)

		const createTaskResponse = await request(app)
			.post(`/api/board/columns/${column._id}/task`)
			.set('Cookie', authCookie(viewer._id))
			.send({ title: 'Should be blocked' })
		assert.equal(createTaskResponse.status, 403)
	})

	it('creates a read-only public link without creating membership', async () => {
		const { owner } = await createBoardWithOwner()
		const viewer = await createUser('public-viewer@example.com', 'Public viewer')
		const board = await Board.create({ name: 'Public link room', createdBy: owner._id, visibility: 'public' })
		const column = await Column.create({ board: board._id, title: 'Public column' })
		await Task.create({ column: column._id, title: 'Visible card' })

		const linkResponse = await request(app)
			.post(`/api/board/boards/${board._id}/public-link`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(linkResponse.status, 200)
		const repeatedLinkResponse = await request(app)
			.post(`/api/board/boards/${board._id}/public-link`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(repeatedLinkResponse.body.publicUrl, linkResponse.body.publicUrl)
		const restoredLinkResponse = await request(app)
			.get(`/api/board/boards/${board._id}/public-link`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(restoredLinkResponse.body.publicUrl, linkResponse.body.publicUrl)
		const token = linkResponse.body.publicUrl.split('/').pop()

		const publicResponse = await request(app).get(`/api/board/public/${token}`)
		assert.equal(publicResponse.status, 200)
		assert.equal(publicResponse.body.board.name, board.name)
		assert.equal(publicResponse.body.columns[0].tasks[0].title, 'Visible card')
		assert.equal(publicResponse.body.board.publicTokenHash, undefined)
		assert.equal(publicResponse.body.board.publicTokenVersion, undefined)
		assert.equal(publicResponse.body.columns[0].board, undefined)
		assert.equal(publicResponse.body.columns[0].tasks[0].assignees, undefined)
		assert.equal(await BoardMember.exists({ board: board._id, user: viewer._id }), null)
		assert.equal(
			(await request(app)
				.get(`/api/board/boards/${board._id}/public-link`)
				.set('Cookie', authCookie(viewer._id))).status,
			403,
		)
	})

	it('revokes a public link and creates a new one afterward', async () => {
		const { owner } = await createBoardWithOwner()
		const board = await Board.create({ name: 'Revocable public room', createdBy: owner._id, visibility: 'public' })
		const firstResponse = await request(app)
			.post(`/api/board/boards/${board._id}/public-link`)
			.set('Cookie', authCookie(owner._id))
		const firstUrl = firstResponse.body.publicUrl
		const firstToken = firstUrl.split('/').pop()

		const revokeResponse = await request(app)
			.delete(`/api/board/boards/${board._id}/public-link`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(revokeResponse.status, 204)
		assert.equal((await request(app).get(`/api/board/public/${firstToken}`)).status, 404)

		const secondResponse = await request(app)
			.post(`/api/board/boards/${board._id}/public-link`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(secondResponse.status, 200)
		assert.notEqual(secondResponse.body.publicUrl, firstUrl)
	})

	it('keeps a general invite link stable until it is revoked', async () => {
		const { owner, board } = await createBoardWithOwner()
		const firstResponse = await request(app)
			.post(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))
			.send({ email: '', role: 'member' })
		const secondResponse = await request(app)
			.post(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))
			.send({ email: '', role: 'member' })
		assert.equal(firstResponse.status, 201)
		assert.equal(secondResponse.body.inviteUrl, firstResponse.body.inviteUrl)
		const linkDetails = await request(app)
			.get(`/api/board/boards/${board._id}/invites/link`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(linkDetails.status, 200)
		assert.equal(linkDetails.body.role, 'member')
		assert.equal(linkDetails.body.createdBy, owner._id.toString())

		const invite = (await request(app)
			.get(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))).body.find((item) => !item.email)
		const revokeResponse = await request(app)
			.delete(`/api/board/boards/${board._id}/invites/${invite._id}`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(revokeResponse.status, 200)

		const thirdResponse = await request(app)
			.post(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))
			.send({ email: '', role: 'member' })
		assert.notEqual(thirdResponse.body.inviteUrl, firstResponse.body.inviteUrl)
	})

	it('scopes invite links to the user who created them', async () => {
		const { owner, board } = await createBoardWithOwner()
		const admin = await createUser('admin-link@example.com', 'Admin link')
		await BoardMember.create({ board: board._id, user: admin._id, role: 'admin' })

		const ownerResponse = await request(app)
			.post(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))
			.send({ email: '', role: 'member' })
		assert.equal(ownerResponse.status, 201)

		const ownerLinkResponse = await request(app)
			.get(`/api/board/boards/${board._id}/invites/link`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(ownerLinkResponse.status, 200)
		assert.equal(ownerLinkResponse.body.role, 'member')
		assert.equal(ownerLinkResponse.body.createdBy, owner._id.toString())

		const adminViewResponse = await request(app)
			.get(`/api/board/boards/${board._id}/invites/link`)
			.set('Cookie', authCookie(admin._id))
		assert.equal(adminViewResponse.status, 404)

		const adminResponse = await request(app)
			.post(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(admin._id))
			.send({ email: '', role: 'admin' })
		assert.equal(adminResponse.status, 201)

		const adminLinkResponse = await request(app)
			.get(`/api/board/boards/${board._id}/invites/link`)
			.set('Cookie', authCookie(admin._id))
		assert.equal(adminLinkResponse.status, 200)
		assert.equal(adminLinkResponse.body.role, 'admin')
		assert.equal(adminLinkResponse.body.createdBy, admin._id.toString())
		assert.notEqual(adminLinkResponse.body.inviteUrl, ownerLinkResponse.body.inviteUrl)

		const ownerSeesAdminResponse = await request(app)
			.get(`/api/board/boards/${board._id}/invites/link`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(ownerSeesAdminResponse.status, 200)
		assert.equal(ownerSeesAdminResponse.body.createdBy, owner._id.toString())
		assert.notEqual(ownerSeesAdminResponse.body.inviteUrl, adminLinkResponse.body.inviteUrl)
	})

	it('does not allow another manager to copy or revoke a link invite', async () => {
		const { owner, board } = await createBoardWithOwner()
		const admin = await createUser('foreign-link-admin@example.com', 'Foreign link admin')
		await BoardMember.create({ board: board._id, user: admin._id, role: 'admin' })

		await request(app)
			.post(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))
			.send({ email: '', role: 'member' })
		const ownerInvite = (await request(app)
			.get(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))).body.find((invite) => !invite.email)

		const copyResponse = await request(app)
			.post(`/api/board/boards/${board._id}/invites/${ownerInvite._id}/copy`)
			.set('Cookie', authCookie(admin._id))
		assert.equal(copyResponse.status, 403)

		const revokeResponse = await request(app)
			.delete(`/api/board/boards/${board._id}/invites/${ownerInvite._id}`)
			.set('Cookie', authCookie(admin._id))
		assert.equal(revokeResponse.status, 403)

		const ownerLinkResponse = await request(app)
			.get(`/api/board/boards/${board._id}/invites/link`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(ownerLinkResponse.status, 200)
	})

	it('allows only the inviter to revoke an email invitation', async () => {
		const { owner, board } = await createBoardWithOwner()
		const admin = await createUser('email-invite-admin@example.com', 'Email invite admin')
		await BoardMember.create({ board: board._id, user: admin._id, role: 'admin' })

		await request(app)
			.post(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))
			.send({ email: 'pending-invite@example.com', role: 'member' })
		const invite = (await request(app)
			.get(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))).body.find((item) => item.email === 'pending-invite@example.com')

		const adminRevokeResponse = await request(app)
			.delete(`/api/board/boards/${board._id}/invites/${invite._id}`)
			.set('Cookie', authCookie(admin._id))
		assert.equal(adminRevokeResponse.status, 403)

		const ownerRevokeResponse = await request(app)
			.delete(`/api/board/boards/${board._id}/invites/${invite._id}`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(ownerRevokeResponse.status, 200)
	})

	it('invalidates pending email invites when a member is removed', async () => {
		const { owner, board } = await createBoardWithOwner()
		const removed = await createUser('removed-invite@example.com', 'Removed invite')
		const { rawToken } = await createInvite({ boardId: board._id, email: removed.email })
		const membership = await BoardMember.create({ board: board._id, user: removed._id, role: 'member' })

		const removeResponse = await request(app)
			.delete(`/api/board/boards/${board._id}/members/${membership._id}`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(removeResponse.status, 200)

		const acceptResponse = await request(app)
			.post(`/api/board/invites/${rawToken}/accept`)
			.set('Cookie', authCookie(removed._id))
		assert.equal(acceptResponse.status, 400)
		assert.equal(await BoardMember.exists({ board: board._id, user: removed._id }), null)
	})

	it('invalidates a public link across every non-public visibility', async () => {
		const { owner } = await createBoardWithOwner()
		const board = await Board.create({ name: 'Visibility transitions', createdBy: owner._id, visibility: 'public' })
		const firstUrl = (await request(app)
			.post(`/api/board/boards/${board._id}/public-link`)
			.set('Cookie', authCookie(owner._id))).body.publicUrl
		const firstToken = firstUrl.split('/').pop()

		for (const visibility of ['private', 'workspace']) {
			const updateResponse = await request(app)
				.patch(`/api/board/boards/${board._id}`)
				.set('Cookie', authCookie(owner._id))
				.send({ visibility })
			assert.equal(updateResponse.status, 200)
			assert.equal((await request(app).get(`/api/board/public/${firstToken}`)).status, 404)
			await Board.findByIdAndUpdate(board._id, { visibility: 'public' })
		}
	})

	it('invalidates a general invite link after room visibility changes', async () => {
		const { owner, board } = await createBoardWithOwner()
		const invited = await createUser('visibility-invite@example.com', 'Visibility invite')
		const inviteResponse = await request(app)
			.post(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))
			.send({ email: '', role: 'member' })
		const rawToken = inviteResponse.body.inviteUrl.split('/').pop()

		for (const visibility of ['workspace', 'public', 'private']) {
			const updateResponse = await request(app)
				.patch(`/api/board/boards/${board._id}`)
				.set('Cookie', authCookie(owner._id))
				.send({ visibility })
			assert.equal(updateResponse.status, 200)
			const activity = await BoardActivity.findOne({ board: board._id, action: 'changed visibility' }).sort({ createdAt: -1 })
			assert.match(activity.details, new RegExp(`changed room visibility from .* to ${visibility}`))
			assert.match(activity.details, /Automatically expired active invite links/)
			if (visibility === 'private') assert.match(activity.details, /public view link/)
			assert.equal((await request(app).get(`/api/board/invites/${rawToken}/details`)).status, 400)
			const visibleInvites = (await request(app)
				.get(`/api/board/boards/${board._id}/invites`)
				.set('Cookie', authCookie(owner._id))).body
			assert.equal(visibleInvites.some((invite) => !invite.email), false)
			const acceptResponse = await request(app)
				.post(`/api/board/invites/${rawToken}/accept`)
				.set('Cookie', authCookie(invited._id))
			assert.equal(acceptResponse.status, 400)
			assert.equal(await BoardMember.exists({ board: board._id, user: invited._id }), null)
		}
	})

	it('applies the selected admin role from an invite', async () => {
		const { owner, board } = await createBoardWithOwner()
		const invited = await createUser('invited-admin@example.com', 'Invited admin')
		const { rawToken } = await createInvite({ boardId: board._id, email: invited.email, role: 'admin' })

		const response = await request(app)
			.post(`/api/board/invites/${rawToken}/accept`)
			.set('Cookie', authCookie(invited._id))

		assert.equal(response.status, 200)
		assert.equal((await BoardMember.findOne({ board: board._id, user: invited._id })).role, 'admin')
		assert.equal(owner.email, 'owner@example.com')
	})

	it('invalidates a public link when visibility becomes private', async () => {
		const { owner } = await createBoardWithOwner()
		const board = await Board.create({ name: 'Rotating public room', createdBy: owner._id, visibility: 'public' })
		const linkResponse = await request(app)
			.post(`/api/board/boards/${board._id}/public-link`)
			.set('Cookie', authCookie(owner._id))
		const token = linkResponse.body.publicUrl.split('/').pop()

		const updateResponse = await request(app)
			.patch(`/api/board/boards/${board._id}`)
			.set('Cookie', authCookie(owner._id))
			.send({ visibility: 'private' })
		assert.equal(updateResponse.status, 200)

		const publicResponse = await request(app).get(`/api/board/public/${token}`)
		assert.equal(publicResponse.status, 404)
	})

	it('rejects an expired session with 401', async () => {
		const expiredToken = jwt.sign(
			{ userId: new mongoose.Types.ObjectId().toString() },
			env.jwtSecret,
			{ expiresIn: -1 },
		)

		const response = await request(app)
			.get('/api/board/boards')
			.set('Cookie', [`jwt=${expiredToken}`])

		assert.equal(response.status, 401)
	})

	it('accepts an invite and creates shared membership', async () => {
		const { owner, board } = await createBoardWithOwner()
		const member = await createUser('member@example.com', 'Member')
		const { rawToken, invite } = await createInvite({
			boardId: board._id,
			email: member.email,
		})

		const response = await request(app)
			.post(`/api/board/invites/${rawToken}/accept`)
			.set('Cookie', authCookie(member._id))

		assert.equal(response.status, 200)
		assert.equal(response.body.boardId, board._id.toString())
		assert.ok(await BoardMember.exists({ board: board._id, user: member._id }))
		const acceptedInvite = await BoardInvite.findById(invite._id)
		assert.ok(acceptedInvite.usedAt)
		assert.equal(acceptedInvite.acceptedBy.toString(), member._id.toString())
		assert.equal(owner.email, 'owner@example.com')
	})

	    it('allows an invite to be accepted only once under concurrency', async () => {
		    const { board } = await createBoardWithOwner()
		    const member = await createUser('concurrent@example.com', 'Concurrent')
		    const { rawToken } = await createInvite({
			    boardId: board._id,
			    email: member.email,
		    })

		    const responses = await Promise.all([
			    request(app)
				    .post(`/api/board/invites/${rawToken}/accept`)
				    .set('Cookie', authCookie(member._id)),
			    request(app)
				    .post(`/api/board/invites/${rawToken}/accept`)
				    .set('Cookie', authCookie(member._id)),
		    ])

		    assert.deepEqual(
			    responses.map((response) => response.status).sort(),
			    [200, 400],
		    )
		    assert.equal(
			    await BoardMember.countDocuments({ board: board._id, user: member._id }),
			    1,
		    )
	    })

	it('rejects a self-invite', async () => {
		const { owner, board } = await createBoardWithOwner()
		const { rawToken } = await createInvite({ boardId: board._id, email: owner.email })

		const response = await request(app)
			.post(`/api/board/invites/${rawToken}/accept`)
			.set('Cookie', authCookie(owner._id))

		assert.equal(response.status, 400)
		assert.match(response.body.message, /cannot invite yourself/i)
	})

	it('rejects accepting an invite when the user is already a member', async () => {
		const { owner, board } = await createBoardWithOwner()
		const member = await createUser('member@example.com', 'Member')
		await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
		const { rawToken } = await createInvite({
			boardId: board._id,
			email: member.email,
		})

		const response = await request(app)
			.post(`/api/board/invites/${rawToken}/accept`)
			.set('Cookie', authCookie(member._id))

		assert.equal(response.status, 400)
		assert.match(response.body.message, /already a member/i)
	})

	it('rejects an expired invite', async () => {
		const { board } = await createBoardWithOwner()
		const member = await createUser('expired@example.com', 'Expired')
		const rawToken = 'expired-invite-token'
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		await BoardInvite.create({
			board: board._id,
			email: member.email,
			tokenHash,
			createdBy: board.createdBy,
			expiresAt: new Date(Date.now() - 60_000),
		})

		const response = await request(app)
			.post(`/api/board/invites/${rawToken}/accept`)
			.set('Cookie', authCookie(member._id))

		assert.equal(response.status, 400)
		assert.match(response.body.message, /expired or invalid/i)
	})

	it('denies access to a board the user does not belong to', async () => {
		const { board } = await createBoardWithOwner()
		const outsider = await createUser('outsider@example.com', 'Outsider')

		const response = await request(app)
			.get(`/api/board/boards/${board._id}`)
			.set('Cookie', authCookie(outsider._id))

		assert.equal(response.status, 403)
	})

	it('protects board activity from outsiders', async () => {
		const { owner, board } = await createBoardWithOwner()
		const member = await createUser('member-activity@example.com', 'Activity member')
		const outsider = await createUser('outsider-activity@example.com', 'Activity outsider')
		await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
		await BoardActivity.create({
			board: board._id,
			user: owner._id,
			action: 'created',
			entityType: 'board',
			entityName: board.name,
			details: 'created this board',
		})

		const ownerResponse = await request(app)
			.get(`/api/board/boards/${board._id}/activity`)
			.set('Cookie', authCookie(owner._id))
		const memberResponse = await request(app)
			.get(`/api/board/boards/${board._id}/activity`)
			.set('Cookie', authCookie(member._id))
		const outsiderResponse = await request(app)
			.get(`/api/board/boards/${board._id}/activity`)
			.set('Cookie', authCookie(outsider._id))

		assert.equal(ownerResponse.status, 200)
		assert.equal(memberResponse.status, 200)
		assert.equal(outsiderResponse.status, 403)
		assert.equal(ownerResponse.body.length, 1)
	})

	it('deletes board activity when the board is deleted', async () => {
		const { owner, board } = await createBoardWithOwner()
		const column = await Column.create({ board: board._id, title: 'History' })
		const task = await Task.create({ column: column._id, title: 'Sensitive task' })
		await TaskActivity.create({
			task: task._id,
			board: board._id,
			user: owner._id,
			type: 'comment',
			message: 'Sensitive comment',
		})
		await Notification.create({
			user: owner._id,
			board: board._id,
			task: task._id,
			type: 'task_assigned',
			title: 'Sensitive notification',
			message: 'Sensitive task was assigned',
		})
		await BoardActivity.create({
			board: board._id,
			user: owner._id,
			action: 'created',
			entityType: 'board',
			entityName: board.name,
		})

		const response = await request(app)
			.delete(`/api/board/boards/${board._id}`)
			.set('Cookie', authCookie(owner._id))

		assert.equal(response.status, 200)
		assert.equal(await BoardActivity.countDocuments({ board: board._id }), 0)
		assert.equal(await TaskActivity.countDocuments({ board: board._id }), 0)
		assert.equal(await Notification.countDocuments({ board: board._id }), 0)
		assert.equal(await Notification.countDocuments({ task: task._id }), 0)
	})

	it('hides assigned tasks after leaving a board', async () => {
		const { board } = await createBoardWithOwner()
		const member = await createUser('leaving-member@example.com', 'Leaving member')
		await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
		const column = await Column.create({ board: board._id, title: 'Assigned' })
		await Task.create({
			column: column._id,
			title: 'Private assigned task',
			assignees: [member._id],
		})

		const beforeLeave = await request(app)
			.get('/api/board/my-tasks')
			.set('Cookie', authCookie(member._id))
		assert.equal(beforeLeave.status, 200)
		assert.equal(beforeLeave.body.length, 1)

		const leaveResponse = await request(app)
			.post(`/api/board/boards/${board._id}/leave`)
			.set('Cookie', authCookie(member._id))
		assert.equal(leaveResponse.status, 200)

		const afterLeave = await request(app)
			.get('/api/board/my-tasks')
			.set('Cookie', authCookie(member._id))
		assert.equal(afterLeave.status, 200)
		assert.equal(afterLeave.body.length, 0)
	})

	it('removes a member and revokes every board access path', async () => {
		const { owner, board } = await createBoardWithOwner()
		const admin = await createUser('remove-admin@example.com', 'Remove admin')
		const member = await createUser('remove-member@example.com', 'Remove member')
		await BoardMember.create([
			{ board: board._id, user: admin._id, role: 'admin' },
			{ board: board._id, user: member._id, role: 'member' },
		])
		const column = await Column.create({ board: board._id, title: 'Sensitive' })
		const task = await Task.create({ column: column._id, title: 'Assigned card', assignees: [member._id] })
		await Notification.create({
			user: member._id,
			board: board._id,
			task: task._id,
			type: 'task_assigned',
			title: 'Sensitive notification',
			message: 'Sensitive board data',
		})
		const inviteResponse = await request(app)
			.post(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))
			.send({ email: '', role: 'member' })
		assert.equal(inviteResponse.status, 201)
		const inviteToken = inviteResponse.body.inviteUrl.split('/').pop()

		const memberRemoveAttempt = await request(app)
			.delete(`/api/board/boards/${board._id}/members/${(await BoardMember.findOne({ board: board._id, user: member._id }))._id}`)
			.set('Cookie', authCookie(member._id))
		assert.equal(memberRemoveAttempt.status, 403)

		const membership = await BoardMember.findOne({ board: board._id, user: member._id })
		const removeResponse = await request(app)
			.delete(`/api/board/boards/${board._id}/members/${membership._id}`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(removeResponse.status, 200)
		assert.equal(await BoardMember.exists({ _id: membership._id }), null)
		assert.equal(await Notification.exists({ user: member._id, board: board._id }), null)
		assert.deepEqual((await Task.findById(task._id)).assignees, [])

		assert.equal((await request(app)
			.get(`/api/board/boards/${board._id}`)
			.set('Cookie', authCookie(member._id))).status, 403)
		assert.equal((await request(app)
			.get('/api/notifications')
			.set('Cookie', authCookie(member._id))).body.some((item) => item.board?.toString() === board._id.toString()), false)
		const staleNotification = await Notification.create({
			user: member._id,
			board: board._id,
			type: 'task_assigned',
			title: 'Stale notification',
			message: 'Should remain inaccessible',
		})
		assert.equal((await request(app)
			.patch(`/api/notifications/${staleNotification._id}/read`)
			.set('Cookie', authCookie(member._id))).status, 404)
		assert.equal((await request(app)
			.post(`/api/board/invites/${inviteToken}/accept`)
			.set('Cookie', authCookie(member._id))).status, 400)
	})

	it('rejects assignees who are not board members', async () => {
		const { owner, board } = await createBoardWithOwner()
		const outsider = await createUser('unassigned-outsider@example.com', 'Outsider')
		const column = await Column.create({ board: board._id, title: 'Tasks' })

		const createResponse = await request(app)
			.post(`/api/board/columns/${column._id}/task`)
			.set('Cookie', authCookie(owner._id))
			.send({ title: 'Blocked task', assignees: [outsider._id] })
		assert.equal(createResponse.status, 400)
		assert.equal(await Task.countDocuments({ column: column._id }), 0)

		const task = await Task.create({ column: column._id, title: 'Existing task' })
		const updateResponse = await request(app)
			.patch(`/api/board/tasks/${task._id}`)
			.set('Cookie', authCookie(owner._id))
			.send({ assignees: [outsider._id] })
		assert.equal(updateResponse.status, 400)
		assert.deepEqual((await Task.findById(task._id)).assignees, [])
		assert.equal(await Notification.countDocuments({ task: task._id }), 0)
	})

	it('creates assigned tasks and notifications successfully', async () => {
		const { owner, board } = await createBoardWithOwner()
		const member = await createUser('assigned-member@example.com', 'Assigned Member')
		await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
		const column = await Column.create({ board: board._id, title: 'Tasks' })

		const response = await request(app)
			.post(`/api/board/columns/${column._id}/task`)
			.set('Cookie', authCookie(owner._id))
			.send({ title: 'Assigned task', assignees: [member._id.toString()] })

		assert.equal(response.status, 201)
		assert.equal(response.body.title, 'Assigned task')
		assert.equal(await Notification.countDocuments({
			user: member._id,
			task: response.body._id,
			type: 'task_assigned',
		}), 1)
	})

	it('does not create task notifications when the recipient disables them', async () => {
		const { owner, board } = await createBoardWithOwner()
		const member = await createUser('quiet-member@example.com', 'Quiet Member')
		member.taskNotifications = false
		await member.save()
		await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
		const column = await Column.create({ board: board._id, title: 'Tasks' })

		const response = await request(app)
			.post(`/api/board/columns/${column._id}/task`)
			.set('Cookie', authCookie(owner._id))
			.send({ title: 'Quiet task', assignees: [member._id.toString()] })

		assert.equal(response.status, 201)
		assert.equal(await Notification.countDocuments({ user: member._id, task: response.body._id }), 0)
	})

	it('creates a task commentary notification for the assignees', async () => {
		const { owner, board } = await createBoardWithOwner()
		const member = await createUser('commented-member@example.com', 'Commented Member')
		await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
		const column = await Column.create({ board: board._id, title: 'Tasks' })
		const task = await Task.create({
			column: column._id,
			board: board._id,
			title: 'Discuss this task',
			assignees: [member._id],
		})

		const response = await request(app)
			.post(`/api/board/tasks/${task._id}/comments`)
			.set('Cookie', authCookie(owner._id))
			.send({ message: 'I left a new update on this card.' })

		assert.equal(response.status, 201)
		assert.equal(await Notification.countDocuments({
			user: member._id,
			task: task._id,
			type: 'task_commented',
		}), 1)
	})

	it('creates a task movement notification for assignees when a card changes columns', async () => {
		const { owner, board } = await createBoardWithOwner()
		const member = await createUser('moved-member@example.com', 'Moved Member')
		await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
		const fromColumn = await Column.create({ board: board._id, title: 'Backlog' })
		const toColumn = await Column.create({ board: board._id, title: 'Doing' })
		const task = await Task.create({
			column: fromColumn._id,
			board: board._id,
			title: 'Move me',
			assignees: [member._id],
		})

		const response = await request(app)
			.patch(`/api/board/tasks/${task._id}`)
			.set('Cookie', authCookie(owner._id))
			.send({ column: toColumn._id, position: 0 })

		assert.equal(response.status, 200)
		assert.equal(await Notification.countDocuments({
			user: member._id,
			task: task._id,
			type: 'task_moved',
		}), 1)
	})

	it('transfers ownership and demotes the previous owner to admin', async () => {
		const { owner, board } = await createBoardWithOwner()
		const nextOwner = await createUser('next-owner@example.com', 'Next owner')
		const membership = await BoardMember.create({
			board: board._id,
			user: nextOwner._id,
			role: 'member',
		})

		const response = await request(app)
			.patch(`/api/board/boards/${board._id}/members/${membership._id}`)
			.set('Cookie', authCookie(owner._id))
			.send({ role: 'owner' })

		assert.equal(response.status, 200)
		assert.equal((await Board.findById(board._id)).createdBy.toString(), nextOwner._id.toString())
		assert.equal(
			(await BoardMember.findOne({ board: board._id, user: owner._id })).role,
			'admin',
		)
	})

	it('deletes a task and records a deletion activity', async () => {
		const { owner, board } = await createBoardWithOwner()
		const column = await Column.create({ board: board._id, title: 'To do' })
		const task = await Task.create({
			board: board._id,
			column: column._id,
			title: 'Delete me',
			position: 0,
		})

		const response = await request(app)
			.delete(`/api/board/tasks/${task._id}`)
			.set('Cookie', authCookie(owner._id))

		assert.equal(response.status, 200)
		assert.equal(await Task.findById(task._id), null)
		assert.ok(
			await TaskActivity.exists({
				task: task._id,
				type: 'deleted',
			}),
		)

		const repeatedResponse = await request(app)
			.delete(`/api/board/tasks/${task._id}`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(repeatedResponse.status, 404)
	})

	it('deletes a column and all related task data', async () => {
		const { owner, board } = await createBoardWithOwner()
		await Column.create({ board: board._id, title: 'Keep me', position: 1 })
		const column = await Column.create({ board: board._id, title: 'Remove me' })
		const task = await Task.create({
			column: column._id,
			title: 'Column task',
			position: 0,
		})
		await TaskActivity.create({
			task: task._id,
			board: board._id,
			user: owner._id,
			type: 'created',
			message: 'created this task',
		})
		await Notification.create({
			user: owner._id,
			board: board._id,
			task: task._id,
			type: 'task_assigned',
			title: 'Task assigned',
			message: 'Column task was assigned to you',
		})

		const response = await request(app)
			.delete(`/api/board/columns/${column._id}`)
			.set('Cookie', authCookie(owner._id))

		assert.equal(response.status, 200)
		assert.equal(await Column.findById(column._id), null)
		assert.equal(await Task.findById(task._id), null)
		assert.equal(await TaskActivity.findOne({ task: task._id }), null)
		assert.equal(await Notification.findOne({ task: task._id }), null)
		assert.equal((await Column.findOne({ board: board._id, title: 'Keep me' })).position, 0)

		const repeatedResponse = await request(app)
			.delete(`/api/board/columns/${column._id}`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(repeatedResponse.status, 404)
	})

	it('reorders columns and persists their positions', async () => {
		const { owner, board } = await createBoardWithOwner()
		const member = await createUser('viewer@example.com', 'Viewer')
		await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
		const first = await Column.create({ board: board._id, title: 'First', position: 0 })
		const second = await Column.create({ board: board._id, title: 'Second', position: 1 })
		const third = await Column.create({ board: board._id, title: 'Third', position: 2 })

		const response = await request(app)
			.patch(`/api/board/columns/${third._id}/position`)
			.set('Cookie', authCookie(owner._id))
			.send({ position: 0 })

		assert.equal(response.status, 200)
		const orderedColumns = await Column.find({ board: board._id }).sort({ position: 1 }).lean()
		assert.deepEqual(orderedColumns.map((column) => column.title), ['Third', 'First', 'Second'])
		assert.deepEqual(orderedColumns.map((column) => column.position), [0, 1, 2])

		const memberResponse = await request(app)
			.get(`/api/board/boards/${board._id}/columns`)
			.set('Cookie', authCookie(member._id))
		assert.equal(memberResponse.status, 200)
		assert.deepEqual(
			memberResponse.body.map((column) => column.title),
			['Third', 'First', 'Second'],
		)
	})

	it('persists a pinned column flag in the column record and shares it through board columns fetch', async () => {
		const { owner, board } = await createBoardWithOwner()
		const column = await Column.create({
			title: 'Pinned list',
			board: board._id,
			position: 0,
			pinned: false,
		})

		const response = await request(app)
			.patch(`/api/board/columns/${column._id}`)
			.set('Cookie', authCookie(owner._id))
			.send({ title: 'Pinned list', pinned: true })

		assert.equal(response.status, 200)
		assert.equal(response.body.pinned, true)

		const columnsResponse = await request(app)
			.get(`/api/board/boards/${board._id}/columns`)
			.set('Cookie', authCookie(owner._id))

		assert.equal(columnsResponse.status, 200)
		assert.equal(columnsResponse.body[0].pinned, true)
	})

	it('moves a task between columns and exposes the new order to members', async () => {
		const { owner, board } = await createBoardWithOwner()
		const member = await createUser('task-viewer@example.com', 'Task viewer')
		await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
		const source = await Column.create({ board: board._id, title: 'Source', position: 0 })
		const target = await Column.create({ board: board._id, title: 'Target', position: 1 })
		const sourceTask = await Task.create({ column: source._id, title: 'Move me', position: 0 })
		const sourceFollower = await Task.create({ column: source._id, title: 'Stay behind', position: 1 })
		const targetTask = await Task.create({ column: target._id, title: 'Already here', position: 0 })

		const response = await request(app)
			.patch(`/api/board/tasks/${sourceTask._id}`)
			.set('Cookie', authCookie(owner._id))
			.send({ column: target._id, position: 1 })

		assert.equal(response.status, 200)
		const sourceTasks = await Task.find({ column: source._id }).sort({ position: 1 }).lean()
		const targetTasks = await Task.find({ column: target._id }).sort({ position: 1 }).lean()
		assert.deepEqual(sourceTasks.map((task) => task.title), ['Stay behind'])
		assert.deepEqual(targetTasks.map((task) => task.title), ['Already here', 'Move me'])
		assert.deepEqual(targetTasks.map((task) => task.position), [0, 1])

		const memberTasks = await request(app)
			.get(`/api/board/columns/${target._id}/tasks`)
			.set('Cookie', authCookie(member._id))
		assert.equal(memberTasks.status, 200)
		assert.deepEqual(memberTasks.body.map((task) => task.title), ['Already here', 'Move me'])
	})

	it('persists the complete task order after a visual reorder', async () => {
		const { owner, board } = await createBoardWithOwner()
		const column = await Column.create({ board: board._id, title: 'Ordered', position: 0 })
		const first = await Task.create({ column: column._id, title: 'First', position: 0 })
		const second = await Task.create({ column: column._id, title: 'Second', position: 1 })
		const third = await Task.create({ column: column._id, title: 'Third', position: 2 })

		const response = await request(app)
			.patch(`/api/board/boards/${board._id}/tasks/reorder`)
			.set('Cookie', authCookie(owner._id))
			.send({ columns: [{ columnId: column._id, taskIds: [third._id, first._id, second._id] }] })

		assert.equal(response.status, 200)
		const tasks = await Task.find({ column: column._id }).sort({ position: 1 }).lean()
		assert.deepEqual(tasks.map((task) => task.title), ['Third', 'First', 'Second'])
		assert.deepEqual(tasks.map((task) => task.position), [0, 1, 2])
		assert.equal((await Column.findById(column._id)).sortBy, 'custom')
	})

	it('persists a task moved to another column through reorder', async () => {
		const { owner, board } = await createBoardWithOwner()
		const source = await Column.create({ board: board._id, title: 'Source', position: 0 })
		const target = await Column.create({ board: board._id, title: 'Target', position: 1 })
		const moving = await Task.create({ column: source._id, title: 'Moving', position: 0 })
		const staying = await Task.create({ column: target._id, title: 'Staying', position: 0 })

		const response = await request(app)
			.patch(`/api/board/boards/${board._id}/tasks/reorder`)
			.set('Cookie', authCookie(owner._id))
			.send({
				columns: [
					{ columnId: source._id, taskIds: [] },
					{ columnId: target._id, taskIds: [staying._id, moving._id] },
				],
			})

		assert.equal(response.status, 200)
		const movedTask = await Task.findById(moving._id).lean()
		assert.equal(movedTask.column.toString(), target._id.toString())
		assert.equal(movedTask.position, 1)
	})
})
