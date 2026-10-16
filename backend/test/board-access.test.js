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
import PasskeyChallenge from '../models/passkeyChallenge.model.js'
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

	it('keeps the current session signed in after changing the password', async () => {
		const user = await User.create({
			email: 'change-keep@example.com',
			password: await bcrypt.hash('OldPassword123!', 10),
			emailVerified: true,
			profileSetup: true,
		})

		const changeResponse = await request(app)
			.patch('/api/auth/change-password')
			.set('Cookie', authCookie(user._id))
			.send({ currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' })
		assert.equal(changeResponse.status, 200)
		const freshCookie = changeResponse.headers['set-cookie']?.find((cookie) => cookie.startsWith('jwt='))
		assert.ok(freshCookie, 'a fresh session cookie is issued')

		const freshSessionResponse = await request(app)
			.get('/api/auth/get-user')
			.set('Cookie', [freshCookie.split(';')[0]])
		assert.equal(freshSessionResponse.status, 200)
	})

	it('clears the session cookie with matching attributes on logout', async () => {
		const response = await request(app).post('/api/auth/logout')
		assert.equal(response.status, 200)
		const cookie = response.headers['set-cookie']?.find((value) => value.startsWith('jwt='))
		assert.match(cookie, /Expires=Thu, 01 Jan 1970/)
		assert.match(cookie, /HttpOnly/)
		assert.match(cookie, /SameSite=Strict/)
	})

	it('rejects a malformed email verification token', async () => {
		const user = await User.create({ email: 'verify-shape@example.com', emailVerified: false })
		const response = await request(app)
			.post('/api/auth/verify-email')
			.set('Cookie', authCookie(user._id))
			.send({ token: { $ne: '' } })
		assert.equal(response.status, 400)
	})

	it('issues passkey sign-in challenges without an email and accepts each one only once', async () => {
		const optionsResponse = await request(app).post('/api/auth/passkeys/auth-options').send({})
		assert.equal(optionsResponse.status, 200)
		const { challenge } = optionsResponse.body
		assert.ok(await PasskeyChallenge.exists({ challenge }))

		const assertion = {
			id: 'unknown-credential',
			rawId: 'unknown-credential',
			type: 'public-key',
			response: {
				clientDataJSON: Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge })).toString('base64url'),
				authenticatorData: '',
				signature: '',
			},
			clientExtensionResults: {},
		}
		const firstAttempt = await request(app).post('/api/auth/passkeys/authenticate').send(assertion)
		assert.equal(firstAttempt.status, 400)
		assert.equal(await PasskeyChallenge.exists({ challenge }), null)

		const replay = await request(app).post('/api/auth/passkeys/authenticate').send(assertion)
		assert.equal(replay.status, 400)
		assert.equal(replay.body.message, 'Passkey sign-in session expired')
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

	it('unassigns a member and drops their board notifications when they leave', async () => {
		const { owner, board } = await createBoardWithOwner()
		const member = await createUser('leave-cleanup@example.com', 'Leave cleanup')
		await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
		const column = await Column.create({ board: board._id, title: 'Doing' })
		const task = await Task.create({ column: column._id, title: 'Shared', assignees: [member._id, owner._id] })
		await Notification.create({ user: member._id, type: 'task_assigned', title: 't', message: 'm', board: board._id, task: task._id })

		const response = await request(app)
			.post(`/api/board/boards/${board._id}/leave`)
			.set('Cookie', authCookie(member._id))
		assert.equal(response.status, 200)

		const updatedTask = await Task.findById(task._id).lean()
		assert.deepEqual(updatedTask.assignees.map(String), [owner._id.toString()])
		assert.equal(await Notification.exists({ user: member._id, board: board._id }), null)
		assert.ok(await BoardActivity.exists({ board: board._id, action: 'left' }))
	})

	it('treats malformed notification ids and repeated my-tasks filters as bad input, not server errors', async () => {
		const user = await createUser('query-shape@example.com')
		const [notificationResponse, tasksResponse] = await Promise.all([
			request(app).patch('/api/notifications/not-an-id/read').set('Cookie', authCookie(user._id)),
			request(app).get('/api/board/my-tasks?search=a&search=b&priority=high&priority=low').set('Cookie', authCookie(user._id)),
		])
		assert.equal(notificationResponse.status, 400)
		assert.equal(tasksResponse.status, 200)
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

	it('updates priority and appends a card moved to another column without gaps', async () => {
		const { owner, board } = await createBoardWithOwner()
		const source = await Column.create({ board: board._id, title: 'Source', position: 0 })
		const target = await Column.create({ board: board._id, title: 'Target', position: 1 })
		const [first, moving, last] = await Task.create([
			{ column: source._id, title: 'First', position: 0 },
			{ column: source._id, title: 'Moving', position: 1 },
			{ column: source._id, title: 'Last', position: 2 },
		])
		await Task.create({ column: target._id, title: 'Existing', position: 0 })

		const response = await request(app)
			.patch(`/api/board/tasks/${moving._id}`)
			.set('Cookie', authCookie(owner._id))
			.send({ column: target._id.toString(), priority: 'urgent' })
		assert.equal(response.status, 200)
		assert.equal(response.body.priority, 'urgent')

		const sourceTasks = await Task.find({ column: source._id }).sort({ position: 1 }).lean()
		assert.deepEqual(sourceTasks.map((task) => [task.title, task.position]), [['First', 0], ['Last', 1]])
		const targetTasks = await Task.find({ column: target._id }).sort({ position: 1 }).lean()
		assert.deepEqual(targetTasks.map((task) => [task.title, task.position]), [['Existing', 0], ['Moving', 1]])
		assert.ok(first && last)
	})

	it('loads every column with its ordered tasks in one request and hides it from outsiders', async () => {
		const { owner, board } = await createBoardWithOwner()
		const outsider = await createUser('content-outsider@example.com')
		const todo = await Column.create({ board: board._id, title: 'Todo', position: 0 })
		const done = await Column.create({ board: board._id, title: 'Done', position: 1 })
		await Task.create([
			{ column: todo._id, title: 'Second', position: 1, assignees: [owner._id] },
			{ column: todo._id, title: 'First', position: 0 },
		])

		const response = await request(app)
			.get(`/api/board/boards/${board._id}/content`)
			.set('Cookie', authCookie(owner._id))
		assert.equal(response.status, 200)
		assert.deepEqual(response.body.map((column) => column.title), ['Todo', 'Done'])
		assert.deepEqual(response.body[0].tasks.map((task) => task.title), ['First', 'Second'])
		assert.equal(response.body[0].tasks[1].assignees[0].name, 'Owner')
		assert.deepEqual(response.body[1].tasks, [])
		assert.ok(done)

		const outsiderResponse = await request(app)
			.get(`/api/board/boards/${board._id}/content`)
			.set('Cookie', authCookie(outsider._id))
		assert.equal(outsiderResponse.status, 403)
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

describe('my tasks filtering', () => {
	it('filters assigned tasks by priority, board and search the same way across fields', async () => {
		const { owner, board } = await createBoardWithOwner()
		await Board.updateOne({ _id: board._id }, { name: 'Alpha launch' })
		const otherBoard = await Board.create({ name: 'Beta', createdBy: owner._id })
		const outsiderBoard = await Board.create({ name: 'Alpha outsider', createdBy: (await createUser('mt-outsider@example.com'))._id })
		const todo = await Column.create({ board: board._id, title: 'Todo' })
		const review = await Column.create({ board: otherBoard._id, title: 'Review (QA)' })
		const hidden = await Column.create({ board: outsiderBoard._id, title: 'Hidden' })
		await Task.create([
			{ column: todo._id, title: 'Write copy', priority: 'high', assignees: [owner._id] },
			{ column: todo._id, title: 'Design', description: '<p>needs a hero image</p>', assignees: [owner._id] },
			{ column: review._id, title: 'Check flow', labels: ['research'], priority: 'low', assignees: [owner._id] },
			{ column: review._id, title: 'Unassigned', assignees: [] },
			{ column: hidden._id, title: 'Not my board', assignees: [owner._id] },
		])
		const titles = async (query) => {
			const response = await request(app).get(`/api/board/my-tasks${query}`).set('Cookie', authCookie(owner._id))
			assert.equal(response.status, 200)
			return response.body.map((task) => task.title).sort()
		}
		assert.deepEqual(await titles(''), ['Check flow', 'Design', 'Write copy'])
		assert.deepEqual(await titles('?priority=high'), ['Write copy'])
		assert.deepEqual(await titles('?priority=none'), ['Design'])
		assert.deepEqual(await titles(`?board=${otherBoard._id}`), ['Check flow'])
		assert.deepEqual(await titles('?search=HERO'), ['Design'])
		assert.deepEqual(await titles('?search=research'), ['Check flow'])
		assert.deepEqual(await titles('?search=alpha'), ['Design', 'Write copy'])
		assert.deepEqual(await titles(`?search=${encodeURIComponent('(qa)')}`), ['Check flow'])
		assert.deepEqual(await titles(`?search=${encodeURIComponent('.*')}`), [])
		const populated = (await request(app).get('/api/board/my-tasks?search=copy').set('Cookie', authCookie(owner._id))).body[0]
		assert.equal(populated.column.board.name, 'Alpha launch')
		assert.equal(populated.assignees[0].email, 'owner@example.com')
	})
})

describe('team overview', () => {
	it('returns every accessible board with its members and nothing from other boards', async () => {
		const { owner, board } = await createBoardWithOwner()
		const teammate = await createUser('team-mate@example.com', 'Mate')
		await BoardMember.create({ board: board._id, user: teammate._id, role: 'member' })
		const foreignOwner = await createUser('team-foreign@example.com')
		const sharedWithOwner = await Board.create({ name: 'Shared in', createdBy: foreignOwner._id })
		await BoardMember.create([
			{ board: sharedWithOwner._id, user: foreignOwner._id, role: 'admin' },
			{ board: sharedWithOwner._id, user: owner._id, role: 'member' },
		])
		const unrelated = await Board.create({ name: 'Unrelated', createdBy: foreignOwner._id })
		await BoardMember.create({ board: unrelated._id, user: foreignOwner._id, role: 'admin' })

		const response = await request(app).get('/api/board/team').set('Cookie', authCookie(owner._id))
		assert.equal(response.status, 200)
		const byName = Object.fromEntries(response.body.map((entry) => [entry.board.name, entry.members.map((member) => member.user.email).sort()]))
		assert.deepEqual(byName, {
			'Private board': ['owner@example.com', 'team-mate@example.com'],
			'Shared in': ['owner@example.com', 'team-foreign@example.com'],
		})
		const access = Object.fromEntries(response.body.map((entry) => [entry.board.name, [entry.board.access, entry.board.role]]))
		assert.deepEqual(access, { 'Private board': ['owned', 'owner'], 'Shared in': ['invited', 'member'] })
	})
})

describe('activity feed', () => {
	it('records task edits with the changed fields and skips saves that change nothing', async () => {
		const { owner, board } = await createBoardWithOwner()
		const cookie = authCookie(owner._id)
		const column = await Column.create({ board: board._id, title: 'Feed' })
		const task = await Task.create({ column: column._id, title: 'Quiet', priority: 'low', position: 0 })

		const unchanged = await request(app).patch(`/api/board/tasks/${task._id}`).set('Cookie', cookie).send({ title: 'Quiet', priority: 'low', position: 0 })
		assert.equal(unchanged.status, 200)
		assert.equal(await TaskActivity.countDocuments({ task: task._id }), 0)
		assert.equal(await BoardActivity.countDocuments({ board: board._id, entityId: task._id }), 0)

		await request(app).patch(`/api/board/tasks/${task._id}`).set('Cookie', cookie).send({ priority: 'high', dueDate: '2026-10-20' })
		const activity = await TaskActivity.findOne({ task: task._id }).lean()
		assert.equal(activity.message, 'updated the due date, priority')
		const boardActivity = await BoardActivity.findOne({ board: board._id, entityId: task._id }).lean()
		assert.equal(boardActivity.details, 'updated due date, priority of Quiet')
	})
})

describe('security and integrity hardening', () => {
	it('shifts the remaining cards only once when a task is deleted twice at the same moment', async () => {
		const { owner, board } = await createBoardWithOwner()
		const cookie = authCookie(owner._id)
		const column = await Column.create({ board: board._id, title: 'Delete race' })
		const [, doomed] = await Task.create([
			{ column: column._id, title: 'Keep 0', position: 0 },
			{ column: column._id, title: 'Doomed', position: 1 },
			{ column: column._id, title: 'Keep 2', position: 2 },
			{ column: column._id, title: 'Keep 3', position: 3 },
		])
		const results = await Promise.all([
			request(app).delete(`/api/board/tasks/${doomed._id}`).set('Cookie', cookie),
			request(app).delete(`/api/board/tasks/${doomed._id}`).set('Cookie', cookie),
		])
		assert.deepEqual(results.map((response) => response.status).sort(), [200, 404])
		const remaining = await Task.find({ column: column._id }).sort({ position: 1 }).lean()
		assert.deepEqual(remaining.map((task) => [task.title, task.position]), [['Keep 0', 0], ['Keep 2', 1], ['Keep 3', 2]])
	})

	it('requires a recent password confirmation before registering a passkey', async () => {
		const user = await User.create({
			email: 'passkey-reauth@example.com',
			password: await bcrypt.hash('Password123!', 10),
			emailVerified: true,
			profileSetup: true,
		})
		const cookie = authCookie(user._id)
		const blocked = await request(app).post('/api/auth/passkeys/options').set('Cookie', cookie)
		assert.equal(blocked.status, 401)
		assert.equal(blocked.body.code, 'reauth_required')

		const reauth = await request(app).post('/api/auth/reauthenticate').set('Cookie', cookie).send({ currentPassword: 'Password123!' })
		assert.equal(reauth.status, 204)
		const allowed = await request(app).post('/api/auth/passkeys/options').set('Cookie', cookie)
		assert.equal(allowed.status, 200)
		assert.ok(allowed.body.challenge)
	})

	it('appends new tasks and columns server-side and keeps the due date', async () => {
		const { owner, board } = await createBoardWithOwner()
		const cookie = authCookie(owner._id)
		const first = await request(app).post(`/api/board/boards/${board._id}/columns`).set('Cookie', cookie).send({ title: 'One', position: 0 })
		const second = await request(app).post(`/api/board/boards/${board._id}/columns`).set('Cookie', cookie).send({ title: 'Two', position: 0 })
		assert.deepEqual([first.body.position, second.body.position], [0, 1])

		const taskA = await request(app).post(`/api/board/columns/${first.body._id}/task`).set('Cookie', cookie).send({ title: 'A', position: 7, dueDate: '2026-10-20' })
		const taskB = await request(app).post(`/api/board/columns/${first.body._id}/task`).set('Cookie', cookie).send({ title: 'B', position: 0 })
		assert.equal(taskA.status, 201)
		assert.deepEqual([taskA.body.position, taskB.body.position], [0, 1])
		assert.equal(taskA.body.dueDate, '2026-10-20T00:00:00.000Z')
	})

	it('caps columns per board and tasks per column at the reorderable limits', async () => {
		const { owner, board } = await createBoardWithOwner()
		const cookie = authCookie(owner._id)
		await Column.insertMany(Array.from({ length: 100 }, (_, position) => ({ board: board._id, title: `C${position}`, position })))
		const extraColumn = await request(app).post(`/api/board/boards/${board._id}/columns`).set('Cookie', cookie).send({ title: 'Too many' })
		assert.equal(extraColumn.status, 400)

		const column = await Column.findOne({ board: board._id, position: 0 })
		await Task.insertMany(Array.from({ length: 2000 }, (_, position) => ({ column: column._id, title: `T${position}`, position })))
		const extraTask = await request(app).post(`/api/board/columns/${column._id}/task`).set('Cookie', cookie).send({ title: 'Overflow' })
		assert.equal(extraTask.status, 400)

		const other = await Column.findOne({ board: board._id, position: 1 })
		const outsideTask = await Task.create({ column: other._id, title: 'Mover', position: 0 })
		const move = await request(app).patch(`/api/board/tasks/${outsideTask._id}`).set('Cookie', cookie).send({ column: column._id.toString() })
		assert.equal(move.status, 400)
		assert.equal((await Task.findById(outsideTask._id)).column.toString(), other._id.toString())
	})

	it('logs time only once when a timer is stopped twice at the same moment', async () => {
		const { owner, board } = await createBoardWithOwner()
		const cookie = authCookie(owner._id)
		const column = await Column.create({ board: board._id, title: 'Timer' })
		const task = await Task.create({ column: column._id, title: 'Timed', timerStartedAt: new Date(Date.now() - 120_000) })

		const doubleStart = await request(app).post(`/api/board/tasks/${task._id}/timer/start`).set('Cookie', cookie)
		assert.equal(doubleStart.status, 400)

		const results = await Promise.all([
			request(app).post(`/api/board/tasks/${task._id}/timer/stop`).set('Cookie', cookie),
			request(app).post(`/api/board/tasks/${task._id}/timer/stop`).set('Cookie', cookie),
		])
		assert.deepEqual(results.map((response) => response.status).sort(), [200, 400])
		const stored = await Task.findById(task._id).lean()
		assert.equal(stored.timerStartedAt, null)
		assert.ok(stored.trackedSeconds >= 120 && stored.trackedSeconds < 130, `tracked ${stored.trackedSeconds}`)
		assert.equal(await TaskActivity.countDocuments({ task: task._id, type: 'time_logged' }), 1)
	})

	it('revokes invite links of an admin who is demoted or leaves', async () => {
		const { owner, board } = await createBoardWithOwner()
		const admin = await createUser('invite-admin@example.com', 'Invite admin')
		const adminMembership = await BoardMember.create({ board: board._id, user: admin._id, role: 'admin' })
		const adminCookie = authCookie(admin._id)

		const link = await request(app).post(`/api/board/boards/${board._id}/invites`).set('Cookie', adminCookie).send({})
		assert.equal(link.status, 201)
		const token = link.body.inviteUrl.split('/invite/')[1]
		assert.equal((await request(app).get(`/api/board/invites/${token}/details`)).status, 200)

		const demote = await request(app)
			.patch(`/api/board/boards/${board._id}/members/${adminMembership._id}`)
			.set('Cookie', authCookie(owner._id))
			.send({ role: 'member' })
		assert.equal(demote.status, 200)
		assert.equal((await request(app).get(`/api/board/invites/${token}/details`)).status, 400)

		await BoardMember.updateOne({ _id: adminMembership._id }, { role: 'admin' })
		const email = await request(app).post(`/api/board/boards/${board._id}/invites`).set('Cookie', adminCookie).send({ email: 'later@example.com' })
		assert.equal(email.status, 201)
		const leave = await request(app).post(`/api/board/boards/${board._id}/leave`).set('Cookie', adminCookie)
		assert.equal(leave.status, 200)
		assert.equal(await BoardInvite.exists({ board: board._id, createdBy: admin._id }), null)
	})

	it('limits password reset emails per address even though every request answers 200', async () => {
		const statuses = []
		for (let attempt = 0; attempt < 4; attempt += 1) {
			const response = await request(app).post('/api/auth/password-reset/request').send({ email: 'reset-flood@example.com' })
			statuses.push(response.status)
		}
		assert.deepEqual(statuses, [200, 200, 200, 429])
	})

	it('locks an account after repeated failed sign-ins, whatever the source IP', async () => {
		await User.create({ email: 'brute@example.com', password: await bcrypt.hash('RightPassword1!', 10), emailVerified: true })
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const response = await request(app).post('/api/auth/login').send({ email: 'brute@example.com', password: `wrong-${attempt}` })
			assert.equal(response.status, 400)
		}
		const locked = await request(app).post('/api/auth/login').send({ email: 'brute@example.com', password: 'RightPassword1!' })
		assert.equal(locked.status, 429)
	})

	it('rejects malformed password reset tokens without a server error', async () => {
		const response = await request(app).get('/api/auth/password-reset/validate?token=a&token=b')
		assert.equal(response.status, 400)
	})

	it('refuses to start without a real JWT secret unless the environment is explicitly local', async () => {
		const { spawnSync } = await import('node:child_process')
		const run = (extraEnv) => spawnSync(process.execPath, ['-e', "import('./config/env.js')"], {
			cwd: new URL('..', import.meta.url),
			env: { PATH: process.env.PATH, ...extraEnv },
			encoding: 'utf8',
		})
		const unset = run({})
		assert.notEqual(unset.status, 0)
		assert.match(unset.stderr, /JWT_SECRET must be configured/)
		assert.equal(run({ NODE_ENV: 'development' }).status, 0)
	})
})

describe('input hardening', () => {
	it('rejects query operators in the member email instead of matching arbitrary users', async () => {
		const { owner, board } = await createBoardWithOwner()
		const victim = await createUser('victim@example.com', 'Victim')

		const response = await request(app)
			.post(`/api/board/boards/${board._id}/invites`)
			.set('Cookie', authCookie(owner._id))
			.send({ email: { $regex: '^victim' } })

		assert.equal(response.status, 400)
		assert.equal(await BoardMember.exists({ board: board._id, user: victim._id }), null)
	})

	it('does not let an admin add a user to a board without an invite', async () => {
		const { owner, board } = await createBoardWithOwner()
		const outsider = await createUser('no-consent@example.com', 'No consent')

		const response = await request(app)
			.post(`/api/board/boards/${board._id}/members`)
			.set('Cookie', authCookie(owner._id))
			.send({ email: outsider.email })

		assert.equal(response.status, 404)
		assert.equal(await BoardMember.exists({ board: board._id, user: outsider._id }), null)
	})

	it('returns 400 for malformed route IDs instead of a server error', async () => {
		const { owner } = await createBoardWithOwner()

		const [boardResponse, taskResponse] = await Promise.all([
			request(app).get('/api/board/boards/not-an-id').set('Cookie', authCookie(owner._id)),
			request(app).patch('/api/board/tasks/not-an-id').set('Cookie', authCookie(owner._id)).send({ title: 'x' }),
		])

		assert.equal(boardResponse.status, 400)
		assert.equal(taskResponse.status, 400)
	})

	it('validates task payloads and persists priority', async () => {
		const { owner, board } = await createBoardWithOwner()
		const column = await Column.create({ board: board._id, title: 'To do' })

		const invalid = await request(app)
			.post(`/api/board/columns/${column._id}/task`)
			.set('Cookie', authCookie(owner._id))
			.send({ title: 123, labels: 'not-an-array' })
		assert.equal(invalid.status, 400)

		const created = await request(app)
			.post(`/api/board/columns/${column._id}/task`)
			.set('Cookie', authCookie(owner._id))
			.send({ title: '  Ship it  ' })
		assert.equal(created.status, 201)
		assert.equal(created.body.title, 'Ship it')

		const updated = await request(app)
			.patch(`/api/board/tasks/${created.body._id}`)
			.set('Cookie', authCookie(owner._id))
			.send({ priority: 'urgent', dueDate: '2026-11-01' })
		assert.equal(updated.status, 200)
		assert.equal(updated.body.priority, 'urgent')

		const badDate = await request(app)
			.patch(`/api/board/tasks/${created.body._id}`)
			.set('Cookie', authCookie(owner._id))
			.send({ dueDate: 'tomorrow' })
		assert.equal(badDate.status, 400)
	})

	it('lets a social-only account reset its password without losing its provider', async () => {
		const user = await User.create({
			email: 'social-reset@example.com',
			provider: 'google',
			providerUid: 'google-uid-reset',
			password: null,
			emailVerified: true,
			profileSetup: true,
		})
		const rawToken = crypto.randomBytes(32).toString('hex')
		await PasswordResetToken.create({
			user: user._id,
			tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
			expiresAt: new Date(Date.now() + 60_000),
		})

		const response = await request(app)
			.post('/api/auth/password-reset/confirm')
			.send({ token: rawToken, password: 'BrandNewPassword1!' })

		assert.equal(response.status, 200)
		const updated = await User.findById(user._id)
		assert.equal(updated.provider, 'google')
		assert.equal(updated.hasPassword, true)
		assert.ok(await bcrypt.compare('BrandNewPassword1!', updated.password))
	})

	it('requires the current password to remove a passkey', async () => {
		const user = await User.create({
			email: 'passkey-owner@example.com',
			password: await bcrypt.hash('Password123!', 10),
			hasPassword: true,
			emailVerified: true,
			profileSetup: true,
			passkeys: [{ credentialID: 'cred_abc', publicKey: Buffer.from('key') }],
		})

		const rejected = await request(app)
			.delete('/api/auth/passkeys/cred_abc')
			.set('Cookie', authCookie(user._id))
			.send({ currentPassword: 'wrong-password' })
		assert.equal(rejected.status, 401)
		assert.equal((await User.findById(user._id)).passkeys.length, 1)

		const accepted = await request(app)
			.delete('/api/auth/passkeys/cred_abc')
			.set('Cookie', authCookie(user._id))
			.send({ currentPassword: 'Password123!' })
		assert.equal(accepted.status, 200)
		assert.equal((await User.findById(user._id)).passkeys.length, 0)
	})
})
