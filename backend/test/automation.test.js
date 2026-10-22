import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import { after, before, beforeEach, describe, it } from 'node:test'

import { app } from '../index.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import BoardRule from '../models/boardRule.model.js'
import Column from '../models/column.model.js'
import Notification from '../models/notification.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import User from '../models/user.model.js'
import { automationsIdle, runCardAutomations, runScheduledAutomations, triggerMatches } from '../services/automation.service.js'
import { nextRunAfter, runsOn } from '../services/schedule.service.js'
import { sessionCookie } from './helpers.js'

let mongoServer
const api = (method, path, user) => request(app)[method](`/api/board${path}`).set('Cookie', sessionCookie(user._id))

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri(), { dbName: `automation-${process.pid}` })
})
beforeEach(async () => {
	await Promise.all([Board, BoardMember, BoardRule, Column, Task, TaskActivity, User, Notification].map((model) => model.deleteMany({})))
})
after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

const setup = async () => {
	const owner = await User.create({ email: 'owner@example.com', name: 'Owner', emailVerified: true, profileSetup: true, emailFrequency: 'never', timezone: 'Europe/Kyiv' })
	const member = await User.create({ email: 'member@example.com', name: 'Member', emailVerified: true, profileSetup: true, emailFrequency: 'never', timezone: 'Europe/Kyiv' })
	const stranger = await User.create({ email: 'stranger@example.com', name: 'Stranger', emailVerified: true, profileSetup: true, emailFrequency: 'never' })
	const board = await Board.create({ name: 'Launch', createdBy: owner._id, labels: [{ name: 'Shipped', color: 'green' }, { name: 'Weekly', color: 'blue' }] })
	await BoardMember.create({ board: board._id, user: owner._id, role: 'admin' })
	await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
	const todo = await Column.create({ board: board._id, title: 'To do', position: 0 })
	const doing = await Column.create({ board: board._id, title: 'Doing', position: 1 })
	const done = await Column.create({ board: board._id, title: 'Done', position: 2 })
	const card = await Task.create({ column: todo._id, title: 'Card', position: 0, dueDate: new Date('2026-10-30T00:00:00Z'), checklist: [{ text: 'a' }, { text: 'b' }] })
	await Task.create({ column: todo._id, title: 'Other', position: 1 })
	return { owner, member, stranger, board, todo, doing, done, card }
}

const addRule = async (user, board, rule) => {
	const response = await api('post', `/boards/${board._id}/rules`, user).send(rule)
	assert.equal(response.status, 201, JSON.stringify(response.body))
	return response.body
}
const fresh = (task) => Task.findById(task._id).setOptions({ withArchived: true }).lean()
const titlesIn = async (column) => (await Task.find({ column: column._id }).sort({ position: 1 })).map((task) => task.title)

describe('automation rules: saving', () => {
	it('checks that actions fit the trigger and name only this board’s lists, people and labels', async () => {
		const { owner, board, done } = await setup()
		const other = await Board.create({ name: 'Other', createdBy: owner._id })
		const otherList = await Column.create({ board: other._id, title: 'Elsewhere', position: 0 })
		const post = (rule) => api('post', `/boards/${board._id}/rules`, owner).send(rule)
		assert.equal((await post({ trigger: { type: 'card_added', column: done._id }, actions: [{ type: 'create_card', column: done._id, title: 'x' }] })).status, 400)
		assert.equal((await post({ trigger: { type: 'schedule', schedule: { frequency: 'daily', time: '09:00' } }, actions: [{ type: 'complete' }] })).status, 400)
		assert.equal((await post({ trigger: { type: 'schedule', schedule: { frequency: 'weekly', time: '09:00' } }, actions: [{ type: 'archive_list', column: done._id }] })).status, 400)
		assert.equal((await post({ trigger: { type: 'card_added', column: otherList._id }, actions: [{ type: 'complete' }] })).status, 400)
		assert.equal((await post({ trigger: { type: 'card_added', column: done._id }, actions: [{ type: 'add_label', label: 'Nope' }] })).status, 400)
		const stranger = await User.create({ email: 's2@example.com', name: 'S', emailVerified: true, profileSetup: true })
		assert.equal((await post({ trigger: { type: 'card_added', column: done._id }, actions: [{ type: 'assign', users: [stranger._id.toString()] }] })).status, 400)
		assert.equal((await post({ trigger: { type: 'card_added', column: done._id }, actions: [] })).status, 400)
		assert.equal((await post({ trigger: { type: 'card_added', column: done._id }, actions: [{ type: 'complete' }] })).status, 201)
	})

	it('lets everyone on the board add rules, and only the author or an admin change them', async () => {
		const { owner, member, stranger, board, done } = await setup()
		const rule = { name: 'Finish', trigger: { type: 'card_added', column: done._id }, actions: [{ type: 'complete' }] }
		assert.equal((await api('post', `/boards/${board._id}/rules`, stranger).send(rule)).status, 404)
		assert.equal((await api('get', `/boards/${board._id}/rules`, stranger)).status, 404)
		const ownerRule = await addRule(owner, board, rule)
		const memberRule = await addRule(member, board, { ...rule, name: 'Mine' })
		const listed = (await api('get', `/boards/${board._id}/rules`, member)).body
		assert.deepEqual(listed.map((item) => [item.name, item.canEdit, item.createdBy.name]), [['Finish', false, 'Owner'], ['Mine', true, 'Member']])
		assert.equal((await api('patch', `/boards/${board._id}/rules/${ownerRule._id}`, member).send({ enabled: false })).status, 403)
		assert.equal((await api('delete', `/boards/${board._id}/rules/${ownerRule._id}`, member)).status, 403)
		assert.equal((await api('patch', `/boards/${board._id}/rules/${memberRule._id}`, owner).send({ enabled: false })).status, 200)
		assert.equal((await api('put', `/boards/${board._id}/rules/${memberRule._id}`, member).send({ ...rule, name: 'Renamed' })).body.name, 'Renamed')
		assert.equal((await api('delete', `/boards/${board._id}/rules/${memberRule._id}`, member)).status, 204)
		assert.equal(await BoardRule.countDocuments({ board: board._id }), 1)
	})
})

describe('automation rules: cards', () => {
	it('answers a card moved into a list: completes it, clears the date, labels it and assigns the mover', async () => {
		const { member, board, done, card } = await setup()
		await addRule(member, board, { name: 'Done means done', trigger: { type: 'card_added', column: done._id }, actions: [{ type: 'complete' }, { type: 'clear_due' }, { type: 'add_label', label: 'Shipped' }, { type: 'assign_actor' }] })
		assert.equal((await api('patch', `/tasks/${card._id}`, member).send({ column: done._id.toString() })).status, 200)
		await automationsIdle()
		const task = await fresh(card)
		assert.equal(task.completed, true)
		assert.equal(task.dueDate, null)
		assert.deepEqual(task.labels, ['Shipped'])
		assert.deepEqual(task.assignees.map(String), [member._id.toString()])
		const history = await TaskActivity.findOne({ task: card._id, type: 'automation' }).lean()
		assert.equal(history.message, 'Done means done')
		assert.deepEqual(history.fields, ['complete', 'clear_due', 'add_label', 'assign'])
		const rule = await BoardRule.findOne({ board: board._id }).lean()
		assert.equal(rule.runs, 1)
		assert.ok(rule.lastRunAt)
	})

	it('answers cards dragged, created, copied and moved with their whole list', async () => {
		const { member, board, todo, doing, done, card } = await setup()
		await addRule(member, board, { trigger: { type: 'card_moved', column: doing._id }, actions: [{ type: 'set_priority', priority: 'high' }] })
		await addRule(member, board, { trigger: { type: 'card_created', column: todo._id }, actions: [{ type: 'set_due', days: 3 }] })
		const others = await Task.find({ column: todo._id, _id: { $ne: card._id } }).sort({ position: 1 })
		await api('patch', `/boards/${board._id}/tasks/reorder`, member).send({ columns: [
			{ columnId: todo._id.toString(), taskIds: others.map((task) => task._id.toString()) },
			{ columnId: doing._id.toString(), taskIds: [card._id.toString()] },
		] })
		await automationsIdle()
		assert.equal((await fresh(card)).priority, 'high')

		const created = (await api('post', `/columns/${todo._id}/task`, member).send({ title: 'New' })).body
		await automationsIdle()
		const due = (await fresh(created)).dueDate.toISOString().slice(0, 10)
		const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date())
		assert.equal(due, new Date(Date.parse(`${today}T00:00:00Z`) + 3 * 86400000).toISOString().slice(0, 10))

		const copy = (await api('post', `/tasks/${card._id}/copy`, member).send({ title: 'Copy', column: todo._id.toString() })).body
		await automationsIdle()
		assert.ok((await fresh(copy)).dueDate, 'a copy counts as a card created in the list')

		const owner = await User.findOne({ email: 'owner@example.com' })
		await api('post', `/columns/${todo._id}/move-tasks`, owner).send({ targetColumnId: doing._id.toString() })
		await automationsIdle()
		assert.ok((await Task.find({ column: doing._id })).every((task) => task.priority === 'high'))
		assert.equal(await Task.countDocuments({ column: done._id }), 0)
	})

	it('chains rules, each at most once, so two rules that send a card back and forth stop', async () => {
		const { member, board, doing, done, card } = await setup()
		await addRule(member, board, { name: 'Ping', trigger: { type: 'card_added', column: doing._id }, actions: [{ type: 'move', column: done._id }] })
		await addRule(member, board, { name: 'Pong', trigger: { type: 'card_added', column: done._id }, actions: [{ type: 'move', column: doing._id, position: 'top' }] })
		await api('patch', `/tasks/${card._id}`, member).send({ column: doing._id.toString() })
		await automationsIdle()
		assert.equal((await fresh(card)).column.toString(), doing._id.toString())
		assert.deepEqual((await BoardRule.find({ board: board._id }).sort({ createdAt: 1 }).lean()).map((rule) => rule.runs), [1, 1])
		assert.deepEqual(await titlesIn(done), [])
	})

	it('completes a card when its checklist is done, then a second rule files it away', async () => {
		const { member, board, todo, done, card } = await setup()
		await addRule(member, board, { trigger: { type: 'checklist_done', column: null }, actions: [{ type: 'complete' }] })
		await addRule(member, board, { trigger: { type: 'card_completed', column: null }, actions: [{ type: 'move', column: done._id, position: 'top' }, { type: 'comment', text: 'Filed by the robot' }] })
		await api('patch', `/tasks/${card._id}`, member).send({ checklist: [{ text: 'a', completed: true }, { text: 'b', completed: false }] })
		await automationsIdle()
		assert.equal((await fresh(card)).completed, false)
		await api('patch', `/tasks/${card._id}`, member).send({ checklist: [{ text: 'a', completed: true }, { text: 'b', completed: true }] })
		await automationsIdle()
		const task = await fresh(card)
		assert.equal(task.completed, true)
		assert.equal(task.column.toString(), done._id.toString())
		assert.deepEqual(await titlesIn(todo), ['Other'])
		const comment = await TaskActivity.findOne({ task: card._id, type: 'comment' }).lean()
		assert.equal(comment.message, 'Filed by the robot')
		assert.ok(comment.rule)
	})

	it('archives, checks every item, starts the next repeating card, and skips switched-off rules', async () => {
		const { member, board, todo, doing, done, card } = await setup()
		const off = await addRule(member, board, { trigger: { type: 'card_added', column: doing._id }, actions: [{ type: 'archive' }] })
		await api('patch', `/boards/${board._id}/rules/${off._id}`, member).send({ enabled: false })
		await addRule(member, board, { trigger: { type: 'card_added', column: done._id }, actions: [{ type: 'check_all' }, { type: 'complete' }] })
		await Task.updateOne({ _id: card._id }, { $set: { repeat: { frequency: 'weekly', interval: 1, days: [5] } } })
		await api('patch', `/tasks/${card._id}`, member).send({ column: doing._id.toString() })
		await automationsIdle()
		assert.equal((await fresh(card)).archivedAt, null)

		await api('patch', `/tasks/${card._id}`, member).send({ column: done._id.toString() })
		await automationsIdle()
		const task = await fresh(card)
		assert.ok(task.checklist.every((item) => item.completed))
		assert.equal(task.completed, true)
		assert.ok(task.repeatedTo, 'the next card of the series was made')
		const next = await fresh({ _id: task.repeatedTo })
		assert.equal(next.column.toString(), todo._id.toString())

		await api('patch', `/boards/${board._id}/rules/${off._id}`, member).send({ enabled: true })
		await api('patch', `/tasks/${next._id}`, member).send({ column: doing._id.toString() })
		await automationsIdle()
		assert.ok((await fresh(next)).archivedAt)
		assert.deepEqual(await titlesIn(doing), [])
	})

	it('matches triggers to events by list', () => {
		const list = new mongoose.Types.ObjectId()
		assert.equal(triggerMatches({ type: 'card_added', column: list }, { type: 'created', column: list }), true)
		assert.equal(triggerMatches({ type: 'card_added', column: list }, { type: 'moved', column: new mongoose.Types.ObjectId() }), false)
		assert.equal(triggerMatches({ type: 'card_moved', column: null }, { type: 'created', column: list }), false)
		assert.equal(triggerMatches({ type: 'card_completed', column: null }, { type: 'completed', column: list }), true)
	})
})

describe('automation rules: schedule', () => {
	it('works out the next run in the author’s time zone', () => {
		assert.equal(runsOn({ frequency: 'monthly', dayOfMonth: 31 }, '2027-02-28'), true)
		assert.equal(runsOn({ frequency: 'weekdays' }, '2026-10-24'), false)
		assert.equal(nextRunAfter({ frequency: 'weekdays', time: '09:00', timezone: 'Europe/Kyiv' }, new Date('2026-10-23T07:00:00Z')).toISOString(), '2026-10-26T07:00:00.000Z')
		assert.equal(nextRunAfter({ frequency: 'weekly', days: [1, 3], time: '18:30', timezone: 'America/New_York' }, new Date('2026-10-22T12:00:00Z')).toISOString(), '2026-10-26T22:30:00.000Z')
	})

	it('creates a card on time, once, and moves and archives lists', async () => {
		const { owner, member, board, todo, doing, done, card } = await setup()
		await Task.updateOne({ _id: card._id }, { $set: { column: done._id, position: 0, completed: true } })
		await Task.create({ column: done._id, title: 'Open in done', position: 1 })
		const rule = await addRule(member, board, {
			name: 'Monday',
			trigger: { type: 'schedule', schedule: { frequency: 'weekly', days: [1], time: '09:00' } },
			actions: [
				{ type: 'create_card', column: todo._id.toString(), position: 'top', title: 'Weekly report {date}', labels: ['Weekly'], users: [owner._id.toString()], days: 2 },
				{ type: 'archive_list', column: done._id.toString(), onlyDone: true },
				{ type: 'move_list', from: doing._id.toString(), column: todo._id.toString() },
			],
		})
		const nextRun = new Date(rule.nextRunAt)
		assert.ok(nextRun > new Date())
		assert.equal(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(nextRun), 'Mon 09:00')
		await Task.create({ column: doing._id, title: 'In progress', position: 0 })

		assert.equal(await runScheduledAutomations({ now: new Date(nextRun.getTime() - 1000) }), 0)
		assert.equal(await runScheduledAutomations({ now: nextRun }), 1)
		assert.equal(await runScheduledAutomations({ now: nextRun }), 0, 'a run is claimed once')
		const titles = await titlesIn(todo)
		const runDay = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' }).format(nextRun)
		assert.equal(titles[0], `Weekly report ${runDay}`, 'the title has the day of the run, in the author’s language')
		assert.deepEqual(titles.slice(1), ['Other', 'In progress'])
		const report = await Task.findOne({ title: titles[0] }).lean()
		assert.deepEqual(report.labels, ['Weekly'])
		assert.deepEqual(report.assignees.map(String), [owner._id.toString()])
		const runKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(nextRun)
		assert.equal(report.dueDate.toISOString().slice(0, 10), new Date(Date.parse(`${runKey}T00:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10))
		assert.deepEqual(await titlesIn(done), ['Open in done'])
		assert.ok((await fresh(card)).archivedAt)
		const saved = await BoardRule.findById(rule._id).lean()
		assert.equal(saved.runs, 1)
		assert.equal(saved.nextRunAt.getTime(), nextRun.getTime() + 7 * 86400000)
		assert.ok(await Notification.exists({ user: owner._id }), 'the person put on the new card hears about it')
	})

	it('runs by hand without moving the schedule, and switches off when its author leaves', async () => {
		const { member, board, todo } = await setup()
		const rule = await addRule(member, board, { trigger: { type: 'schedule', schedule: { frequency: 'daily', time: '08:00' } }, actions: [{ type: 'create_card', column: todo._id.toString(), title: 'Stand-up' }] })
		const run = await api('post', `/boards/${board._id}/rules/${rule._id}/run`, member)
		assert.equal(run.status, 200)
		assert.equal(run.body.created, 1)
		assert.equal(run.body.rule.runs, 1)
		assert.equal(new Date(run.body.rule.nextRunAt).getTime(), new Date(rule.nextRunAt).getTime())
		assert.ok((await titlesIn(todo)).includes('Stand-up'))

		await BoardMember.deleteOne({ board: board._id, user: member._id })
		assert.equal(await runScheduledAutomations({ now: new Date(rule.nextRunAt) }), 1)
		const saved = await BoardRule.findById(rule._id).lean()
		assert.equal(saved.enabled, false)
		assert.equal(saved.lastError, 'author')
		assert.equal((await titlesIn(todo)).filter((title) => title === 'Stand-up').length, 1)
	})

	it('lets new cards from a schedule set off card rules', async () => {
		const { member, board, todo } = await setup()
		await addRule(member, board, { trigger: { type: 'card_created', column: todo._id }, actions: [{ type: 'set_priority', priority: 'urgent' }] })
		const rule = await addRule(member, board, { trigger: { type: 'schedule', schedule: { frequency: 'monthly', dayOfMonth: 1, time: '09:00' } }, actions: [{ type: 'create_card', column: todo._id.toString(), title: 'Invoices' }] })
		await api('post', `/boards/${board._id}/rules/${rule._id}/run`, member)
		await automationsIdle()
		assert.equal((await Task.findOne({ title: 'Invoices' }).lean()).priority, 'urgent')
	})
})

describe('automation rules: around the board', () => {
	it('follow a renamed label, and go away with their board', async () => {
		const { owner, board, todo, done } = await setup()
		const rule = await addRule(owner, board, { trigger: { type: 'card_added', column: done._id }, actions: [{ type: 'add_label', label: 'Shipped' }] })
		await addRule(owner, board, { trigger: { type: 'schedule', schedule: { frequency: 'daily', time: '09:00' } }, actions: [{ type: 'create_card', column: todo._id.toString(), title: 'x', labels: ['Shipped', 'Weekly'] }] })
		const label = board.labels.find((item) => item.name === 'Shipped')
		assert.equal((await api('patch', `/boards/${board._id}/labels/${label._id}`, owner).send({ name: 'Released' })).status, 200)
		const rules = await BoardRule.find({ board: board._id }).sort({ createdAt: 1 }).lean()
		assert.equal(rules[0].actions[0].label, 'Released')
		assert.deepEqual(rules[1].actions[0].labels, ['Released', 'Weekly'])
		assert.equal(String(rules[0]._id), rule._id)
		assert.equal((await api('delete', `/boards/${board._id}`, owner)).status, 200)
		assert.equal(await BoardRule.countDocuments({}), 0)
	})

	it('stop working once their author leaves the board', async () => {
		const { member, board, done, card } = await setup()
		await addRule(member, board, { trigger: { type: 'card_added', column: done._id }, actions: [{ type: 'comment', text: 'From a former member' }] })
		await BoardMember.deleteOne({ board: board._id, user: member._id })
		const owner = await User.findOne({ email: 'owner@example.com' })
		await api('patch', `/tasks/${card._id}`, owner).send({ column: done._id.toString() })
		await automationsIdle()
		assert.equal(await TaskActivity.countDocuments({ task: card._id, type: 'comment' }), 0)
		const rule = await BoardRule.findOne({ board: board._id }).lean()
		assert.equal(rule.enabled, false)
		assert.equal(rule.lastError, 'author')
	})

	it('leave archived cards’ places alone when they move cards', async () => {
		const { member, board, todo, done, card } = await setup()
		await Task.updateOne({ _id: card._id }, { $set: { column: done._id, position: 0 } })
		await Task.updateOne({ title: 'Other' }, { $set: { position: 0 } })
		const archivedHere = await Task.create({ column: todo._id, title: 'Old here', position: 5, archivedAt: new Date() })
		const archivedThere = await Task.create({ column: done._id, title: 'Old there', position: 5, archivedAt: new Date() })
		await addRule(member, board, { trigger: { type: 'card_moved', column: done._id }, actions: [{ type: 'move', column: todo._id.toString(), position: 'top' }] })
		await runCardAutomations({ boardId: board._id, taskId: card._id, events: [{ type: 'moved', column: done._id }], actor: member })
		assert.equal((await fresh(card)).column.toString(), todo._id.toString())
		assert.equal((await fresh(archivedHere)).position, 5)
		assert.equal((await fresh(archivedThere)).position, 5)
		assert.deepEqual(await titlesIn(todo), ['Card', 'Other'])
		assert.deepEqual((await Task.find({ column: todo._id }).sort({ position: 1 })).map((task) => task.position), [0, 1])
	})
})
