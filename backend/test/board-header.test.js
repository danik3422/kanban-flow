import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import { after, before, beforeEach, describe, it } from 'node:test'

import { env } from '../config/env.js'
import { app } from '../index.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'
import User from '../models/user.model.js'

let mongoServer
const cookie = (user) => [`jwt=${jwt.sign({ userId: user._id.toString() }, env.jwtSecret)}`]

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri(), { dbName: `board-header-${process.pid}` })
})
beforeEach(async () => {
	await Promise.all([Board.deleteMany({}), BoardMember.deleteMany({}), Column.deleteMany({}), Task.deleteMany({}), User.deleteMany({})])
})
after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

const setup = async () => {
	const owner = await User.create({ email: 'owner@example.com', name: 'Owner', emailVerified: true, profileSetup: true })
	const member = await User.create({ email: 'member@example.com', name: 'Member', emailVerified: true, profileSetup: true })
	const board = await Board.create({ name: 'Launch', createdBy: owner._id, visibility: 'workspace', background: { type: 'gradient', key: 'ocean' } })
	await BoardMember.create({ board: board._id, user: owner._id, role: 'admin' })
	await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
	const todo = await Column.create({ board: board._id, title: 'To do', position: 0, color: 'blue' })
	const done = await Column.create({ board: board._id, title: 'Done', position: 1 })
	await Task.create({ column: todo._id, title: 'Plan', position: 0, labels: ['Design'], priority: 'high', assignees: [member._id], checklist: [{ text: 'Draft', completed: true }] })
	await Task.create({ column: done._id, title: 'Ship', position: 0 })
	return { owner, member, board }
}

describe('board description', () => {
	it('admins write it, members cannot', async () => {
		const { owner, member, board } = await setup()
		const saved = await request(app).patch(`/api/board/boards/${board._id}`).set('Cookie', cookie(owner)).send({ description: '  Q4 launch plan  ' })
		assert.equal(saved.status, 200)
		assert.equal(saved.body.description, 'Q4 launch plan')
		assert.equal((await request(app).patch(`/api/board/boards/${board._id}`).set('Cookie', cookie(member)).send({ description: 'x' })).status, 403)
		assert.equal((await request(app).patch(`/api/board/boards/${board._id}`).set('Cookie', cookie(owner)).send({ description: 'x'.repeat(1001) })).status, 400)
	})
})

describe('copy board', () => {
	it('copies lists and cards (without people) into a private board of the copier', async () => {
		const { member, board } = await setup()
		const response = await request(app).post(`/api/board/boards/${board._id}/copy`).set('Cookie', cookie(member)).send({ name: 'Launch copy' })
		assert.equal(response.status, 201)
		const copy = response.body
		assert.equal(copy.name, 'Launch copy')
		assert.equal(copy.visibility, 'private')
		assert.equal(copy.createdBy, member._id.toString())
		assert.equal(copy.background.key, 'ocean')
		const columns = await Column.find({ board: copy._id }).sort({ position: 1 })
		assert.deepEqual(columns.map((column) => column.title), ['To do', 'Done'])
		assert.equal(columns[0].color, 'blue')
		const cards = await Task.find({ column: { $in: columns.map((column) => column._id) } })
		assert.equal(cards.length, 2)
		const plan = cards.find((card) => card.title === 'Plan')
		assert.deepEqual([...plan.labels], ['Design'])
		assert.equal(plan.priority, 'high')
		assert.equal(plan.assignees.length, 0, 'people are not copied')
		assert.equal(plan.checklist[0].completed, true)
		assert.equal(await BoardMember.countDocuments({ board: copy._id }), 1)
		assert.equal(await Task.countDocuments({ column: { $in: (await Column.find({ board: board._id })).map((column) => column._id) } }), 2, 'the original is untouched')
	})

	it('can leave the cards out, and needs access to the board', async () => {
		const { owner, board } = await setup()
		const response = await request(app).post(`/api/board/boards/${board._id}/copy`).set('Cookie', cookie(owner)).send({ name: 'Template', keepCards: false })
		assert.equal(response.status, 201)
		const columns = await Column.find({ board: response.body._id })
		assert.equal(columns.length, 2)
		assert.equal(await Task.countDocuments({ column: { $in: columns.map((column) => column._id) } }), 0)
		const stranger = await User.create({ email: 'stranger@example.com', emailVerified: true, profileSetup: true })
		assert.equal((await request(app).post(`/api/board/boards/${board._id}/copy`).set('Cookie', cookie(stranger)).send({ name: 'Nope' })).status, 404)
		assert.equal((await request(app).post(`/api/board/boards/${board._id}/copy`).set('Cookie', cookie(owner)).send({ name: '  ' })).status, 400)
	})
})
