import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import { after, before, beforeEach, describe, it } from 'node:test'

import { env } from '../config/env.js'
import { app } from '../index.js'
import Board from '../models/board.model.js'
import BoardInvite from '../models/boardInvite.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Notification from '../models/notification.model.js'
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

const createInvite = async ({ boardId, email = '' }) => {
	const rawToken = `invite-${crypto.randomBytes(16).toString('hex')}`
	const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
	const invite = await BoardInvite.create({
		board: boardId,
		email,
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
	mongoServer = await MongoMemoryServer.create()
	await mongoose.connect(mongoServer.getUri())
})

beforeEach(async () => {
	await Promise.all([
		BoardInvite.deleteMany({}),
		BoardMember.deleteMany({}),
		Board.deleteMany({}),
		User.deleteMany({}),
	])
})

after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

describe('board access and invitation flow', () => {
	it('rejects protected requests without a session', async () => {
		const response = await request(app).get('/api/board/boards')

		assert.equal(response.status, 401)
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
		assert.ok((await BoardInvite.findById(invite._id)).usedAt)
		assert.equal(owner.email, 'owner@example.com')
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
})
