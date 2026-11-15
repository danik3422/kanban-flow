import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import { after, before, beforeEach, describe, it } from 'node:test'

import { app } from '../index.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Session from '../models/session.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import User from '../models/user.model.js'
import { sessionCookie } from './helpers.js'

let mongoServer

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri(), { dbName: `account-deletion-${process.pid}` })
})
beforeEach(async () => {
	await Promise.all([Board, BoardMember, Column, Session, Task, TaskActivity, User].map((model) => model.deleteMany({})))
})
after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

const PASSWORD = 'correct horse battery'

const createUser = async (email, name) => User.create({
	email,
	name,
	password: await bcrypt.hash(PASSWORD, 4),
	hasPassword: true,
	emailVerified: true,
	profileSetup: true,
	emailFrequency: 'never',
})

const createBoard = async (owner, name, members = []) => {
	const board = await Board.create({ name, createdBy: owner._id })
	await BoardMember.create({ board: board._id, user: owner._id, role: 'admin' })
	for (const member of members) await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
	const column = await Column.create({ board: board._id, title: 'To do', position: 0 })
	return { board, column }
}

const deleteAccount = (user, body, cookie = sessionCookie(user._id)) =>
	request(app).delete('/api/auth/account').set('Cookie', cookie).send(body)

describe('deleting an account', () => {
	it('asks for the current password and changes nothing without it', async () => {
		const alice = await createUser('alice@example.com', 'Alice')
		assert.equal((await deleteAccount(alice, { currentPassword: 'wrong password' })).status, 401)
		assert.equal((await deleteAccount(alice, {})).status, 401)
		const stored = await User.findById(alice._id)
		assert.equal(stored.email, 'alice@example.com')
		assert.equal(stored.deletedAt, null)
	})

	it('refuses while the person owns a board other people use, and names it', async () => {
		const alice = await createUser('alice@example.com', 'Alice')
		const bob = await createUser('bob@example.com', 'Bob')
		const { board } = await createBoard(alice, 'Team plans', [bob])
		const response = await deleteAccount(alice, { currentPassword: PASSWORD })
		assert.equal(response.status, 409)
		assert.equal(response.body.code, 'owns_shared_boards')
		assert.deepEqual(response.body.boards, ['Team plans'])
		assert.ok(await Board.exists({ _id: board._id }))
		assert.equal((await User.findById(alice._id)).email, 'alice@example.com')
	})

	it('deletes own boards, leaves shared ones and keeps nothing personal', async () => {
		const alice = await createUser('alice@example.com', 'Alice')
		const bob = await createUser('bob@example.com', 'Bob')
		const own = await createBoard(alice, 'Private notes')
		await Task.create({ column: own.column._id, title: 'Diary', position: 0 })
		const team = await createBoard(bob, 'Bob team', [alice])
		const teamCard = await Task.create({ column: team.column._id, title: 'Shared work', position: 0, assignees: [alice._id, bob._id], watchers: [alice._id] })
		await TaskActivity.create({ task: teamCard._id, board: team.board._id, user: alice._id, type: 'comment', message: 'Done on my side' })

		const cookie = sessionCookie(alice._id)
		assert.equal((await request(app).get('/api/auth/get-user').set('Cookie', cookie)).status, 200)
		const response = await deleteAccount(alice, { currentPassword: PASSWORD }, cookie)
		assert.equal(response.status, 204)
		assert.match(String(response.headers['set-cookie']), /jwt=;/)

		assert.equal(await Board.exists({ _id: own.board._id }), null, 'the board only she used is gone')
		assert.equal(await Task.exists({ title: 'Diary' }), null)
		assert.ok(await Board.exists({ _id: team.board._id }), "Bob's board stays")
		assert.equal(await BoardMember.exists({ board: team.board._id, user: alice._id }), null)
		const card = await Task.findById(teamCard._id)
		assert.deepEqual(card.assignees.map(String), [bob._id.toString()])
		assert.equal(card.watchers.length, 0)
		assert.equal(await TaskActivity.countDocuments({ task: teamCard._id, type: 'comment' }), 1, 'her comment stays for the team')

		const stored = await User.findById(alice._id).select('+calendarTokenHash')
		assert.ok(stored.deletedAt)
		assert.equal(stored.name, 'Deleted user')
		assert.doesNotMatch(stored.email, /alice/)
		assert.equal(stored.password, null)
		assert.equal(stored.passkeys.length, 0)
		assert.equal(await Session.countDocuments({ user: alice._id }), 0)

		assert.equal((await request(app).get('/api/auth/get-user').set('Cookie', cookie)).status, 401, 'the old cookie no longer works')
		const login = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: PASSWORD })
		assert.notEqual(login.status, 200)
		assert.equal(await User.exists({ email: 'alice@example.com' }), null, 'the address is free to sign up again')
	})
})
