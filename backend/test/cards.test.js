import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import { sessionCookie } from './helpers.js'
import { after, before, beforeEach, describe, it } from 'node:test'

import { app } from '../index.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Notification from '../models/notification.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import TimeEntry from '../models/timeEntry.model.js'
import User from '../models/user.model.js'

let mongoServer
const cookie = (user) => sessionCookie(user._id)
const api = (method, path, user) => request(app)[method](`/api/board${path}`).set('Cookie', cookie(user))

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri(), { dbName: `cards-${process.pid}` })
})
beforeEach(async () => {
	await Promise.all([Board, BoardMember, Column, Task, TaskActivity, TimeEntry, User, Notification].map((model) => model.deleteMany({})))
})
after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

const setup = async () => {
	const owner = await User.create({ email: 'owner@example.com', name: 'Owner', emailVerified: true, profileSetup: true })
	const member = await User.create({ email: 'member@example.com', name: 'Member', emailVerified: true, profileSetup: true, emailFrequency: 'never' })
	const stranger = await User.create({ email: 'stranger@example.com', name: 'Stranger', emailVerified: true, profileSetup: true })
	const board = await Board.create({ name: 'Launch', createdBy: owner._id })
	await BoardMember.create({ board: board._id, user: owner._id, role: 'admin' })
	await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
	const todo = await Column.create({ board: board._id, title: 'To do', position: 0 })
	const doing = await Column.create({ board: board._id, title: 'Doing', position: 1 })
	const card = await Task.create({ column: todo._id, title: 'Hero section', position: 0, labels: ['Design'], checklist: [{ text: 'Draft', completed: true }], assignees: [member._id] })
	const other = await Task.create({ column: todo._id, title: 'Footer', position: 1 })
	return { owner, member, stranger, board, todo, doing, card, other }
}

describe('card fields', () => {
	it('saves completion, dates, estimate and cover, and logs completion', async () => {
		const { owner, card } = await setup()
		const saved = await api('patch', `/tasks/${card._id}`, owner).send({ completed: true, startDate: '2030-01-02', estimateMinutes: 90, cover: { type: 'color', key: 'blue', size: 'full' } })
		assert.equal(saved.status, 200)
		assert.equal(saved.body.completed, true)
		assert.ok(saved.body.completedAt)
		assert.equal(saved.body.estimateMinutes, 90)
		assert.equal(saved.body.cover.key, 'blue')
		assert.equal(saved.body.cover.size, 'full')
		assert.equal(await TaskActivity.countDocuments({ task: card._id, type: 'completed' }), 1)
		const reopened = await api('patch', `/tasks/${card._id}`, owner).send({ completed: false, cover: null })
		assert.equal(reopened.body.completedAt, null)
		assert.equal(reopened.body.cover, null)
		assert.equal(await TaskActivity.countDocuments({ task: card._id, type: 'reopened' }), 1)
		assert.equal((await api('patch', `/tasks/${card._id}`, owner).send({ cover: { type: 'color', key: 'neon' } })).status, 400)
		assert.equal((await api('patch', `/tasks/${card._id}`, owner).send({ cover: { type: 'photo', id: 'x', url: 'https://evil.example.com/a.jpg' } })).status, 400)
		const photo = await api('patch', `/tasks/${card._id}`, owner).send({ cover: { type: 'photo', id: 'picsum-12', size: 'strip' } })
		assert.equal(photo.status, 200)
		assert.match(photo.body.cover.url, /^https:\/\/picsum\.photos\//)
	})

	it('records which fields an edit touched', async () => {
		const { owner, card } = await setup()
		await api('patch', `/tasks/${card._id}`, owner).send({ title: 'Hero', priority: 'high' })
		const activity = await TaskActivity.findOne({ task: card._id, type: 'updated' })
		assert.deepEqual([...activity.fields].sort(), ['priority', 'title'])
	})
})

describe('board labels', () => {
	it('creates, renames everywhere and deletes everywhere', async () => {
		const { owner, member, board, card } = await setup()
		const created = await api('post', `/boards/${board._id}/labels`, member).send({ name: 'Design', color: 'purple' })
		assert.equal(created.status, 201)
		assert.equal((await api('post', `/boards/${board._id}/labels`, member).send({ name: 'design', color: 'red' })).status, 400, 'names are unique, ignoring case')
		assert.equal((await api('post', `/boards/${board._id}/labels`, member).send({ name: 'X', color: 'neon' })).status, 400)
		const labelId = created.body[0]._id
		assert.equal((await api('patch', `/boards/${board._id}/labels/${labelId}`, member).send({ name: 'UI' })).status, 403, 'renaming rewrites every card, so members cannot')
		assert.equal((await api('delete', `/boards/${board._id}/labels/${labelId}`, member)).status, 403)
		const renamed = await api('patch', `/boards/${board._id}/labels/${labelId}`, owner).send({ name: 'UI', color: 'blue' })
		assert.equal(renamed.body[0].name, 'UI')
		assert.deepEqual([...(await Task.findById(card._id)).labels], ['UI'], 'cards follow the new name')
		await api('delete', `/boards/${board._id}/labels/${labelId}`, owner)
		assert.deepEqual([...(await Task.findById(card._id)).labels], [], 'cards lose a deleted label')
		assert.equal((await Board.findById(board._id)).labels.length, 0)
	})

	it('is for people on the board only', async () => {
		const { stranger, board } = await setup()
		assert.equal((await api('post', `/boards/${board._id}/labels`, stranger).send({ name: 'X', color: 'red' })).status, 404)
	})
})

describe('time tracking', () => {
	it('gives each person their own timer and stops the one left running elsewhere', async () => {
		const { owner, member, card, other } = await setup()
		assert.equal((await api('post', `/tasks/${card._id}/timer/start`, owner)).status, 201)
		assert.equal((await api('post', `/tasks/${card._id}/timer/start`, member)).status, 201, 'two people can track the same card')
		const switched = await api('post', `/tasks/${other._id}/timer/start`, owner)
		assert.equal(switched.status, 201)
		assert.equal(String(switched.body.stopped.taskId), String(card._id), 'starting elsewhere stops my other timer')
		const running = await api('get', '/timer/running', owner)
		assert.equal(running.body.task.title, 'Footer')
		const board = await api('get', `/boards/${(await Column.findById(card.column)).board}/content`, owner)
		const face = board.body[0].tasks.find((task) => task.title === 'Hero section')
		assert.equal(face.runningTimers.length, 1, 'the card shows who is tracking it')
	})

	it('adds, edits and deletes time by hand, with totals per person', async () => {
		const { owner, member, card } = await setup()
		const added = await api('post', `/tasks/${card._id}/time`, member).send({ minutes: 90, note: 'Sketches' })
		assert.equal(added.status, 201)
		assert.equal(added.body.trackedSeconds, 5400)
		await api('post', `/tasks/${card._id}/time`, owner).send({ minutes: 30, date: '2026-01-05' })
		const summary = await api('get', `/tasks/${card._id}/time`, owner)
		assert.equal(summary.body.trackedSeconds, 7200)
		assert.deepEqual(summary.body.people.map((person) => [person.user.name, person.seconds]), [['Member', 5400], ['Owner', 1800]])
		const entryId = added.body.entry._id
		assert.equal((await api('patch', `/time/${entryId}`, member).send({ minutes: 60 })).body.trackedSeconds, 5400)
		const ownersEntry = summary.body.entries.find((entry) => entry.user.name === 'Owner')._id
		assert.equal((await api('patch', `/time/${ownersEntry}`, member).send({ minutes: 5 })).status, 403, 'not someone else’s time')
		assert.equal((await api('delete', `/time/${entryId}`, owner)).status, 200, 'admins can tidy up')
		assert.equal((await Task.findById(card._id)).trackedSeconds, 1800)
		assert.equal((await api('post', `/tasks/${card._id}/time`, owner).send({ minutes: 0 })).status, 400)
		assert.equal((await api('post', `/tasks/${card._id}/time`, owner).send({ minutes: 10, date: '2099-01-01' })).status, 400)
	})
})

describe('comments', () => {
	it('can be edited by their author and deleted by the author or an admin', async () => {
		const { owner, member, card } = await setup()
		const posted = await api('post', `/tasks/${card._id}/comments`, member).send({ message: 'First' })
		const id = posted.body._id
		assert.equal((await api('patch', `/tasks/${card._id}/comments/${id}`, owner).send({ message: 'Hijack' })).status, 403)
		const edited = await api('patch', `/tasks/${card._id}/comments/${id}`, member).send({ message: 'First, edited' })
		assert.equal(edited.body.message, 'First, edited')
		assert.ok(edited.body.editedAt)
		assert.equal((await api('delete', `/tasks/${card._id}/comments/${id}`, owner)).status, 204)
		const board = await api('get', `/boards/${(await Column.findById(card.column)).board}/content`, owner)
		assert.equal(board.body[0].tasks[0].commentCount, 0)
	})

	it('reach the card watchers', async () => {
		const { owner, member, card } = await setup()
		const watch = await api('post', `/tasks/${card._id}/watch`, owner)
		assert.equal(watch.body.watching, true)
		await api('post', `/tasks/${card._id}/comments`, member).send({ message: 'Looks good' })
		assert.equal(await Notification.countDocuments({ user: owner._id, type: 'task_commented' }), 1)
		assert.equal((await api('post', `/tasks/${card._id}/watch`, owner)).body.watching, false)
	})
})

describe('attachments', () => {
	it('adds links, refuses other schemes, and lets the adder or an admin remove them', async () => {
		const { owner, member, card } = await setup()
		const added = await api('post', `/tasks/${card._id}/attachments`, member).send({ url: 'https://figma.com/file/abc', name: 'Mockups' })
		assert.equal(added.status, 201)
		assert.equal(added.body.attachments[0].name, 'Mockups')
		assert.equal((await api('post', `/tasks/${card._id}/attachments`, member).send({ url: 'javascript:alert(1)' })).status, 400)
		const id = added.body.attachments[0]._id
		assert.equal((await api('delete', `/tasks/${card._id}/attachments/${id}`, owner)).status, 200)
		assert.equal((await Task.findById(card._id)).attachments.length, 0)
	})

	it('says when image uploads are not set up', async () => {
		const { owner, card } = await setup()
		const response = await api('post', `/tasks/${card._id}/attachments/image`, owner).send({ image: 'data:image/png;base64,iVBORw0KGgo=' })
		assert.equal(response.status, 503)
		assert.equal((await api('get', '/features', owner)).body.uploads, false)
	})
})

describe('copy card', () => {
	it('copies right after the original, keeping what was asked', async () => {
		const { owner, card, todo, doing } = await setup()
		const copy = await api('post', `/tasks/${card._id}/copy`, owner).send({ title: 'Hero section (copy)', keep: { members: false } })
		assert.equal(copy.status, 201)
		assert.equal(copy.body.position, 1)
		assert.deepEqual(copy.body.labels, ['Design'])
		assert.equal(copy.body.assignees.length, 0)
		assert.equal(copy.body.checklist[0].completed, true)
		assert.equal((await Task.findOne({ title: 'Footer' })).position, 2, 'cards after it move down')
		const elsewhere = await api('post', `/tasks/${card._id}/copy`, owner).send({ title: 'In Doing', column: doing._id.toString() })
		assert.equal(String(elsewhere.body.column), String(doing._id))
		assert.equal(await Task.countDocuments({ column: todo._id }), 3)
	})
})
