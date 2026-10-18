import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import { after, before, beforeEach, describe, it } from 'node:test'

import { env } from '../config/env.js'
import { app } from '../index.js'
import { runDueReminders, runEmailDigests } from '../lib/emailJobs.js'
import { PREVIEW_NAMES, renderPreview } from '../lib/emails/preview.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Notification from '../models/notification.model.js'
import Task from '../models/task.model.js'
import User from '../models/user.model.js'

let mongoServer
const sent = []
const originalFetch = globalThis.fetch
const settled = () => new Promise((resolve) => setTimeout(resolve, 150))
const cookie = (user) => [`jwt=${jwt.sign({ userId: user._id.toString() }, env.jwtSecret)}`]

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri(), { dbName: `email-notify-${process.pid}` })
	env.brevoApiKey = 'test-key'
	env.mailFrom = 'KanbanHub <hello@example.com>'
	// Brevo is the only thing fetched here: keep what would have been sent.
	globalThis.fetch = async (url, options) => {
		sent.push(JSON.parse(options.body))
		return { ok: true, text: async () => '' }
	}
})

beforeEach(async () => {
	sent.length = 0
	await Promise.all([Notification.deleteMany({}), BoardMember.deleteMany({}), Board.deleteMany({}), Column.deleteMany({}), Task.deleteMany({}), User.deleteMany({})])
})

after(async () => {
	globalThis.fetch = originalFetch
	await mongoose.disconnect()
	await mongoServer.stop()
})

const setup = async (memberFields = {}) => {
	const owner = await User.create({ email: 'owner@example.com', name: 'Olena Owner', emailVerified: true, profileSetup: true })
	const member = await User.create({ email: 'member@example.com', name: 'Max Member', emailVerified: true, profileSetup: true, ...memberFields })
	const board = await Board.create({ name: 'Launch', createdBy: owner._id })
	await BoardMember.create({ board: board._id, user: owner._id, role: 'admin' })
	await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
	const todo = await Column.create({ board: board._id, title: 'To do', position: 0 })
	const done = await Column.create({ board: board._id, title: 'Done', position: 1 })
	return { owner, member, board, todo, done }
}

const addCard = (owner, column, body) => request(app).post(`/api/board/columns/${column._id}/task`).set('Cookie', cookie(owner)).send(body)

describe('email settings', () => {
	it('saves the frequency and preferences key by key', async () => {
		const { member } = await setup()
		let response = await request(app).patch('/api/auth/settings').set('Cookie', cookie(member)).send({ emailFrequency: 'periodic', emailPreferences: { comments: false } })
		assert.equal(response.status, 200)
		assert.equal(response.body.emailFrequency, 'periodic')
		assert.equal(response.body.emailPreferences.comments, false)
		assert.equal(response.body.emailPreferences.dueDates, true)
		response = await request(app).patch('/api/auth/settings').set('Cookie', cookie(member)).send({ emailPreferences: { cardsMoved: false } })
		assert.equal(response.body.emailPreferences.comments, false, 'earlier choices stay')
		assert.equal(response.body.emailPreferences.cardsMoved, false)
		response = await request(app).patch('/api/auth/settings').set('Cookie', cookie(member)).send({ emailFrequency: 'never' })
		assert.equal(response.body.emailNotifications, false, 'the old switch follows')
		assert.equal((await request(app).patch('/api/auth/settings').set('Cookie', cookie(member)).send({ emailPreferences: { spam: true } })).status, 400)
	})
})

describe('activity email', () => {
	it('instantly: one email per event, in the reader’s language, with the card', async () => {
		const { owner, member, todo } = await setup({ language: 'uk' })
		await addCard(owner, todo, { title: 'Write the release notes', assignees: [member._id.toString()] })
		await settled()
		assert.equal(sent.length, 1)
		assert.equal(sent[0].to[0].email, 'member@example.com')
		assert.match(sent[0].subject, /Olena Owner додає вас до «Write the release notes»/)
		assert.match(sent[0].htmlContent, /Launch/)
		assert.match(sent[0].htmlContent, /settings#notifications/)
		assert.equal((await Notification.findOne({ user: member._id })).emailStatus, 'sent')
	})

	it('respects the categories: a turned-off kind is not emailed, being added always is', async () => {
		const { owner, member, todo } = await setup({ emailPreferences: { comments: false, removed: false } })
		const card = await addCard(owner, todo, { title: 'Card', assignees: [member._id.toString()] })
		await settled()
		assert.equal(sent.length, 1, 'added to a card emails even with other kinds off')
		await request(app).post(`/api/board/tasks/${card.body._id}/comments`).set('Cookie', cookie(owner)).send({ message: 'Hello' })
		await request(app).patch(`/api/board/tasks/${card.body._id}`).set('Cookie', cookie(owner)).send({ assignees: [] })
		await settled()
		assert.equal(sent.length, 1, 'comments and removals are off')
		const statuses = await Notification.find({ user: member._id }).distinct('emailStatus')
		assert.ok(statuses.includes('skipped'))
	})

	it('never: no email at all, the bell still works', async () => {
		const { owner, member, todo } = await setup({ emailFrequency: 'never' })
		await addCard(owner, todo, { title: 'Card', assignees: [member._id.toString()] })
		await settled()
		assert.equal(sent.length, 0)
		assert.equal(await Notification.countDocuments({ user: member._id, hidden: { $ne: true } }), 1)
	})

	it('emails removals and due date changes', async () => {
		const { owner, member, todo } = await setup()
		const other = await User.create({ email: 'other@example.com', name: 'Other', emailVerified: true, profileSetup: true })
		const board = await Board.findOne()
		await BoardMember.create({ board: board._id, user: other._id, role: 'member' })
		const card = await addCard(owner, todo, { title: 'Plan', assignees: [member._id.toString(), other._id.toString()] })
		await settled()
		sent.length = 0
		await request(app).patch(`/api/board/tasks/${card.body._id}`).set('Cookie', cookie(owner)).send({ dueDate: '2030-05-01' })
		await settled()
		assert.equal(sent.length, 2, 'both assignees hear about the new due date')
		assert.ok(sent.every((mail) => /is now due/.test(mail.subject)))
		sent.length = 0
		await request(app).patch(`/api/board/tasks/${card.body._id}`).set('Cookie', cookie(owner)).send({ assignees: [member._id.toString()] })
		await settled()
		assert.equal(sent.length, 1)
		assert.equal(sent[0].to[0].email, 'other@example.com')
		assert.match(sent[0].subject, /removed you from “Plan”/)
	})
})

describe('hourly digest', () => {
	it('collects events into one email, grouped by board, leaving out what was read', async () => {
		const { owner, member, todo, board } = await setup({ emailFrequency: 'periodic' })
		const first = await addCard(owner, todo, { title: 'First', assignees: [member._id.toString()] })
		await addCard(owner, todo, { title: 'Second', assignees: [member._id.toString()] })
		await addCard(owner, todo, { title: 'Third', assignees: [member._id.toString()] })
		await settled()
		assert.equal(sent.length, 0, 'nothing is sent right away')
		await Notification.updateOne({ user: member._id, task: first.body._id }, { $set: { readAt: new Date() } })

		assert.equal(await runEmailDigests(), 0, 'it waits a few minutes to gather a burst')
		assert.equal(await runEmailDigests({ now: new Date(Date.now() + 10 * 60 * 1000) }), 1)
		assert.equal(sent.length, 1)
		assert.match(sent[0].subject, /2 updates on your boards/)
		assert.match(sent[0].htmlContent, new RegExp(board.name))
		assert.match(sent[0].htmlContent, /Second/)
		assert.doesNotMatch(sent[0].htmlContent, /First/, 'read in the app, so not emailed')
		assert.equal(await Notification.countDocuments({ user: member._id, emailStatus: 'pending' }), 0)

		await addCard(owner, todo, { title: 'Fourth', assignees: [member._id.toString()] })
		assert.equal(await runEmailDigests({ now: new Date(Date.now() + 20 * 60 * 1000) }), 0, 'at most one digest an hour')
		assert.equal(await runEmailDigests({ now: new Date(Date.now() + 75 * 60 * 1000) }), 1)
	})
})

describe('due date reminders', () => {
	it('reminds assignees once, not for done cards or far-off dates', async () => {
		const { member, todo, done } = await setup()
		const soon = new Date(Date.now() + 6 * 60 * 60 * 1000)
		await Task.create({ column: todo._id, title: 'Due soon', dueDate: soon, assignees: [member._id] })
		await Task.create({ column: done._id, title: 'Already done', dueDate: soon, assignees: [member._id] })
		await Task.create({ column: todo._id, title: 'Next month', dueDate: new Date(Date.now() + 30 * 86400000), assignees: [member._id] })
		assert.equal(await runDueReminders(), 1)
		await settled()
		assert.equal(sent.length, 1)
		assert.match(sent[0].subject, /“Due soon” is due/)
		assert.equal(await runDueReminders(), 0, 'only once')
	})
})

describe('email templates', () => {
	it('render in every language with a subject, text and the KanbanHub layout', () => {
		for (const lang of ['en', 'uk', 'ru']) {
			for (const name of PREVIEW_NAMES) {
				const email = renderPreview(name, lang)
				assert.ok(email.subject && !/\{\w+\}/.test(email.subject), `${lang}/${name} subject`)
				assert.ok(email.text.length > 20 && !/\{\w+\}/.test(email.text), `${lang}/${name} text`)
				assert.match(email.html, new RegExp(`<html lang="${lang}"`))
				assert.doesNotMatch(email.html, /\{\w+\}|undefined|\[object/, `${lang}/${name} html`)
			}
		}
		assert.match(renderPreview('digest', 'ru').subject, /5 обновлений/)
		assert.match(renderPreview('digest', 'uk').subject, /5 оновлень/)
	})

	it('escapes what people typed', () => {
		const email = renderPreview('invite', 'en')
		assert.doesNotMatch(email.html, /<script/)
	})
})

describe('comment notifications', () => {
	it('carry the board name, so the bell and the digest can say where', async () => {
		const { owner, member, todo, board } = await setup({ emailFrequency: 'periodic' })
		const card = await addCard(owner, todo, { title: 'Card', assignees: [member._id.toString()] })
		await request(app).post(`/api/board/tasks/${card.body._id}/comments`).set('Cookie', cookie(owner)).send({ message: 'Looks good' })
		const comment = await Notification.findOne({ user: member._id, type: 'task_commented' })
		assert.equal(comment.data.boardName, board.name)
		assert.equal(comment.data.comment, 'Looks good')
	})
})
