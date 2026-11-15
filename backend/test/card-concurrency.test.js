import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import { after, before, beforeEach, describe, it } from 'node:test'

import { app } from '../index.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import User from '../models/user.model.js'
import { sessionCookie } from './helpers.js'

// Requests that arrive at the same moment: double clicks, two people dragging at once,
// a card resent after a lost answer. Each must leave the lists in order.

let mongoServer
const api = (method, path, user) => request(app)[method](`/api/board${path}`).set('Cookie', sessionCookie(user._id))

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri(), { dbName: `card-concurrency-${process.pid}` })
})
beforeEach(async () => {
	await Promise.all([Board, BoardMember, Column, Task, TaskActivity, User].map((model) => model.deleteMany({})))
})
after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

const setup = async () => {
	const owner = await User.create({ email: 'owner@example.com', name: 'Owner', emailVerified: true, profileSetup: true, emailFrequency: 'never' })
	const board = await Board.create({ name: 'Launch', createdBy: owner._id })
	await BoardMember.create({ board: board._id, user: owner._id, role: 'admin' })
	const todo = await Column.create({ board: board._id, title: 'To do', position: 0 })
	const doing = await Column.create({ board: board._id, title: 'Doing', position: 1 })
	return { owner, board, todo, doing }
}

const positionsOf = async (column) =>
	(await Task.find({ column: column._id }).sort({ position: 1 }).lean()).map((task) => task.position)

const inOrder = (count) => Array.from({ length: count }, (_, index) => index)

describe('cards changed at the same time', () => {
	it('gives cards created at once different places in the list', async () => {
		const { owner, todo } = await setup()
		const responses = await Promise.all(inOrder(8).map((index) => api('post', `/columns/${todo._id}/task`, owner).send({ title: `Card ${index}` })))
		responses.forEach((response) => assert.equal(response.status, 201))
		assert.deepEqual(await positionsOf(todo), inOrder(8))
	})

	it('creates a card sent twice at once only once', async () => {
		const { owner, todo } = await setup()
		const clientId = 'offline-card-1'
		const responses = await Promise.all([1, 2].map(() => api('post', `/columns/${todo._id}/task`, owner).send({ title: 'Once', clientId })))
		responses.forEach((response) => assert.ok([200, 201].includes(response.status)))
		assert.equal(await Task.countDocuments({ clientId }), 1)
		assert.equal(responses[0].body._id, responses[1].body._id)
	})

	it('keeps both lists in order when two cards are dragged into the same list at once', async () => {
		const { owner, todo, doing } = await setup()
		const cards = await Task.create(inOrder(4).map((index) => ({ column: todo._id, title: `Todo ${index}`, position: index })))
		await Task.create(inOrder(3).map((index) => ({ column: doing._id, title: `Doing ${index}`, position: index })))
		const responses = await Promise.all([cards[0], cards[2]].map((card) => api('patch', `/tasks/${card._id}`, owner).send({ column: doing._id.toString(), position: 0 })))
		responses.forEach((response) => assert.equal(response.status, 200))
		assert.deepEqual(await positionsOf(todo), inOrder(2))
		assert.deepEqual(await positionsOf(doing), inOrder(5))
	})

	it('keeps a list in order when two cards in it are reordered at once', async () => {
		const { owner, todo } = await setup()
		const cards = await Task.create(inOrder(6).map((index) => ({ column: todo._id, title: `Card ${index}`, position: index })))
		const responses = await Promise.all([
			api('patch', `/tasks/${cards[0]._id}`, owner).send({ position: 5 }),
			api('patch', `/tasks/${cards[5]._id}`, owner).send({ position: 0 }),
		])
		responses.forEach((response) => assert.equal(response.status, 200))
		assert.deepEqual(await positionsOf(todo), inOrder(6))
	})

	it('brings one next card when a repeating card is completed twice at once', async () => {
		const { owner, todo } = await setup()
		const card = await Task.create({ column: todo._id, title: 'Weekly review', position: 0, dueDate: new Date('2030-01-07T00:00:00Z'), repeat: { frequency: 'weekly', interval: 1 } })
		const responses = await Promise.all([1, 2].map(() => api('patch', `/tasks/${card._id}`, owner).send({ completed: true })))
		responses.forEach((response) => assert.equal(response.status, 200))
		assert.equal(await Task.countDocuments({ title: 'Weekly review' }), 2)
		assert.deepEqual(await positionsOf(todo), inOrder(2))
		assert.equal(await TaskActivity.countDocuments({ task: card._id, type: 'completed' }), 1)
	})
})
