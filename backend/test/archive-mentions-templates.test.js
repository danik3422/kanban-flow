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
import User from '../models/user.model.js'

let mongoServer
const api = (method, path, user) => request(app)[method](`/api/board${path}`).set('Cookie', sessionCookie(user._id))

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri(), { dbName: `archive-${process.pid}` })
})
beforeEach(async () => {
	await Promise.all([Board, BoardMember, Column, Task, TaskActivity, User, Notification].map((model) => model.deleteMany({})))
})
after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

const setup = async () => {
	const owner = await User.create({ email: 'owner@example.com', name: 'Owner', emailVerified: true, profileSetup: true, emailFrequency: 'never' })
	const member = await User.create({ email: 'member@example.com', name: 'Member', emailVerified: true, profileSetup: true, emailFrequency: 'never' })
	const stranger = await User.create({ email: 'stranger@example.com', name: 'Stranger', emailVerified: true, profileSetup: true, emailFrequency: 'never' })
	const board = await Board.create({ name: 'Launch', createdBy: owner._id })
	await BoardMember.create({ board: board._id, user: owner._id, role: 'admin' })
	await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
	const todo = await Column.create({ board: board._id, title: 'To do', position: 0 })
	const doing = await Column.create({ board: board._id, title: 'Doing', position: 1 })
	const first = await Task.create({ column: todo._id, title: 'First', position: 0 })
	const second = await Task.create({ column: todo._id, title: 'Second', position: 1 })
	const third = await Task.create({ column: todo._id, title: 'Third', position: 2 })
	return { owner, member, stranger, board, todo, doing, first, second, third }
}

const titlesIn = async (column) => (await Task.find({ column: column._id }).sort({ position: 1 })).map((task) => task.title)

describe('archive', () => {
	it('hides an archived card everywhere, closes the gap and brings it back at the end', async () => {
		const { member, board, todo, first } = await setup()
		assert.equal((await api('post', `/tasks/${first._id}/archive`, member)).status, 200)
		assert.deepEqual(await titlesIn(todo), ['Second', 'Third'])
		assert.deepEqual((await Task.find({ column: todo._id }).sort({ position: 1 })).map((task) => task.position), [0, 1])
		const content = await api('get', `/boards/${board._id}/content`, member)
		assert.ok(!JSON.stringify(content.body).includes('"First"'))
		assert.equal((await api('patch', `/tasks/${first._id}`, member).send({ title: 'Changed' })).status, 404)

		const archive = await api('get', `/boards/${board._id}/archive`, member)
		assert.equal(archive.status, 200)
		assert.deepEqual(archive.body.tasks.map((task) => [task.title, task.columnTitle, task.archivedBy.name]), [['First', 'To do', 'Member']])

		assert.equal((await api('post', `/tasks/${first._id}/restore`, member)).status, 200)
		assert.deepEqual(await titlesIn(todo), ['Second', 'Third', 'First'])
		assert.equal((await api('get', `/boards/${board._id}/archive`, member)).body.tasks.length, 0)
	})

	it('archives a list with its cards and restores them together, but not cards archived before', async () => {
		const { owner, member, board, todo, doing, first } = await setup()
		await api('post', `/tasks/${first._id}/archive`, member)
		assert.equal((await api('post', `/columns/${todo._id}/archive`, member)).status, 403)
		assert.equal((await api('post', `/columns/${todo._id}/archive`, owner)).status, 200)
		assert.equal((await Column.findById(doing._id)).position, 0)
		assert.equal(await Task.countDocuments({}), 0)

		const archive = (await api('get', `/boards/${board._id}/archive`, owner)).body
		assert.deepEqual(archive.columns.map((column) => [column.title, column.taskCount]), [['To do', 2]])
		assert.deepEqual(archive.tasks.map((task) => task.title), ['First'])

		assert.equal((await api('post', `/columns/${todo._id}/restore`, owner)).status, 200)
		assert.equal((await Column.findById(todo._id)).position, 1)
		assert.deepEqual(await titlesIn(todo), ['Second', 'Third'])
	})

	it('restores a card whose list is archived into the first list', async () => {
		const { owner, todo, doing, first } = await setup()
		await api('post', `/tasks/${first._id}/archive`, owner)
		await api('post', `/columns/${todo._id}/archive`, owner)
		assert.equal((await api('post', `/tasks/${first._id}/restore`, owner)).status, 200)
		assert.deepEqual(await titlesIn(doing), ['First'])
	})

	it('deletes archived cards and lists for good, keeps strangers out', async () => {
		const { owner, stranger, board, todo, doing, first } = await setup()
		await api('post', `/tasks/${first._id}/archive`, owner)
		assert.equal((await api('get', `/boards/${board._id}/archive`, stranger)).status, 404)
		assert.equal((await api('post', `/tasks/${first._id}/restore`, stranger)).status, 404)
		assert.equal((await api('delete', `/tasks/${first._id}`, owner)).status, 200)
		assert.deepEqual(await titlesIn(todo), ['Second', 'Third'])

		await api('post', `/columns/${doing._id}/archive`, owner)
		assert.equal((await api('delete', `/columns/${doing._id}`, owner)).status, 200)
		assert.equal(await Column.countDocuments({ _id: doing._id }).setOptions({ withArchived: true }), 0)
		assert.equal((await Column.findById(todo._id)).position, 0)
	})

	it('deleting the board removes archived cards too', async () => {
		const { owner, board, first } = await setup()
		await api('post', `/tasks/${first._id}/archive`, owner)
		assert.equal((await api('delete', `/boards/${board._id}`, owner)).status, 200)
		assert.equal(await Task.countDocuments({}).setOptions({ withArchived: true }), 0)
	})
})

describe('mentions', () => {
	it('notifies people called on with @name once, and only people on the board', async () => {
		const { owner, member, stranger, first } = await setup()
		await Task.updateOne({ _id: first._id }, { $set: { assignees: [member._id] } })
		const response = await api('post', `/tasks/${first._id}/comments`, owner).send({ message: '@Member can you look?', mentions: [member._id.toString(), stranger._id.toString(), owner._id.toString()] })
		assert.equal(response.status, 201)
		assert.deepEqual(response.body.mentions.map((person) => person.name), ['Member'])
		const notes = await Notification.find({ user: member._id })
		assert.deepEqual(notes.map((note) => note.type), ['task_mentioned'])
		assert.equal(await Notification.countDocuments({ user: stranger._id }), 0)

		const edited = await api('patch', `/tasks/${first._id}/comments/${response.body._id}`, owner).send({ message: '@Member please, today', mentions: [member._id.toString()] })
		assert.equal(edited.status, 200)
		assert.equal(await Notification.countDocuments({ user: member._id }), 1)

		const activities = await api('get', `/tasks/${first._id}/activities`, owner)
		assert.equal(activities.body.find((item) => item.type === 'comment').mentions[0].name, 'Member')
	})
})

describe('templates', () => {
	it('creates the lists, labels and example cards of a template', async () => {
		const { owner } = await setup()
		const response = await api('post', '/boards', owner).send({
			name: 'Product',
			starter: {
				labels: [{ name: 'Bug', color: 'red' }, { name: 'Bug', color: 'green' }],
				columns: [
					{ title: 'Backlog', cards: [{ title: 'Fix <login>', description: 'Line one\nLine two', labels: ['Bug', 'Unknown'], checklist: ['Reproduce'], priority: 'high' }] },
					{ title: 'Done' },
				],
			},
		})
		assert.equal(response.status, 201)
		const board = await Board.findById(response.body._id)
		assert.deepEqual(board.labels.map((label) => label.name), ['Bug'])
		const columns = await Column.find({ board: board._id }).sort({ position: 1 })
		assert.deepEqual(columns.map((column) => column.title), ['Backlog', 'Done'])
		const [card] = await Task.find({ column: columns[0]._id })
		assert.equal(card.description, '<p>Line one</p><p>Line two</p>')
		assert.deepEqual(card.labels, ['Bug'])
		assert.equal(card.checklist[0].text, 'Reproduce')
		assert.equal(card.priority, 'high')
	})

	it('rejects a template that is too large', async () => {
		const { owner } = await setup()
		const columns = Array.from({ length: 9 }, (_, index) => ({ title: `List ${index}` }))
		assert.equal((await api('post', '/boards', owner).send({ name: 'Big', starter: { columns } })).status, 400)
	})
})

describe('export and import', () => {
	it('exports every list and card, archived ones marked, as JSON and CSV', async () => {
		const { owner, stranger, board, first, second } = await setup()
		await Board.updateOne({ _id: board._id }, { $set: { labels: [{ name: 'Bug', color: 'red' }] } })
		await Task.updateOne({ _id: second._id }, { $set: { labels: ['Bug'], description: '<p>Fix "it", now</p>', checklist: [{ text: 'A', completed: true }, { text: 'B' }] } })
		await api('post', `/tasks/${first._id}/comments`, owner).send({ message: 'Looks good' })
		await api('post', `/tasks/${first._id}/archive`, owner)

		assert.equal((await api('get', `/boards/${board._id}/export`, stranger)).status, 404)
		const json = await api('get', `/boards/${board._id}/export`, owner)
		assert.equal(json.status, 200)
		assert.match(json.headers['content-disposition'], /attachment; filename="launch-\d{4}-\d{2}-\d{2}\.json"/)
		const file = JSON.parse(json.text)
		assert.equal(file.format, 'kanbanhub-board')
		assert.deepEqual(file.columns.map((column) => column.title), ['To do', 'Doing'])
		const archived = file.columns[0].cards.find((card) => card.title === 'First')
		assert.equal(archived.archived, true)
		assert.equal(archived.comments[0].text, 'Looks good')

		const csv = await api('get', `/boards/${board._id}/export?format=csv`, owner)
		assert.match(csv.headers['content-type'], /text\/csv/)
		assert.ok(csv.text.includes('To do,Second,"Fix ""it"", now",Bug,,,,,,1/2,,'))
		assert.ok(csv.text.includes('To do,First,'))
	})

	it('imports a board with archived lists and cards and comments, and round-trips an export', async () => {
		const { owner } = await setup()
		const response = await api('post', '/boards/import', owner).send({
			name: 'From Trello',
			source: 'trello',
			labels: [{ name: 'Bug', color: 'red' }],
			columns: [
				{ title: 'Doing', cards: [{ title: 'Open', labels: ['Bug', 'Nope'], checklist: [{ text: 'Step', completed: true }], comments: [{ text: 'Hi', author: 'Ann', date: '2026-01-02T10:00:00.000Z' }] }, { title: 'Closed', archived: true }, { title: 'Next' }] },
				{ title: 'Old list', archived: true, cards: [{ title: 'Old card' }] },
			],
		})
		assert.equal(response.status, 201)
		assert.deepEqual(response.body.imported, { lists: 2, cards: 4, comments: 1 })
		const boardId = response.body._id
		const content = await api('get', `/boards/${boardId}/content`, owner)
		const lists = content.body.columns || content.body
		assert.deepEqual(lists.map((column) => column.title), ['Doing'])
		assert.deepEqual(lists[0].tasks.map((task) => [task.title, task.position]), [['Open', 0], ['Next', 1]])
		assert.deepEqual(lists[0].tasks[0].labels, ['Bug'])
		const archive = (await api('get', `/boards/${boardId}/archive`, owner)).body
		assert.deepEqual(archive.tasks.map((task) => task.title), ['Closed'])
		assert.deepEqual(archive.columns.map((column) => [column.title, column.taskCount]), [['Old list', 1]])
		const [comment] = await TaskActivity.find({ type: 'comment' })
		assert.equal(comment.message, 'Hi\n\n— Ann, 2026-01-02')

		// Its own export comes back in the same shape.
		const file = JSON.parse((await api('get', `/boards/${boardId}/export`, owner)).text)
		const again = await api('post', '/boards/import', owner).send({ name: file.name, source: 'kanbanhub', labels: file.labels, columns: file.columns })
		assert.equal(again.status, 201)
		assert.equal(again.body.imported.cards, 4)
	})

	it('refuses imports over the limits', async () => {
		const { owner } = await setup()
		const cards = Array.from({ length: 2001 }, (_, index) => ({ title: `Card ${index}` }))
		assert.equal((await api('post', '/boards/import', owner).send({ name: 'Big', source: 'trello', columns: [{ title: 'All', cards }] })).status, 400)
	})
})
