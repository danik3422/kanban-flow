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
import User from '../models/user.model.js'
import { escapeText, eventOf, foldLine, recurrenceOf, rruleOf } from '../services/icalendar.service.js'
import { sessionCookie } from './helpers.js'

let mongoServer

before(async () => {
	mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
	await mongoose.connect(mongoServer.getUri(), { dbName: `calendar-${process.pid}` })
})
beforeEach(async () => {
	await Promise.all([Board, BoardMember, Column, Task, User].map((model) => model.deleteMany({})))
})
after(async () => {
	await mongoose.disconnect()
	await mongoServer.stop()
})

const link = (method, user) => request(app)[method]('/api/calendar/link').set('Cookie', sessionCookie(user._id))
// Calendar apps send no cookies and no app headers.
const feed = (token, query = '') => request(app).get(`/api/calendar/${token}.ics${query}`).set('X-Requested-With', '')
const unfold = (text) => text.replace(/\r\n /g, '')

const setup = async () => {
	const owner = await User.create({ email: 'owner@example.com', name: 'Owner', emailVerified: true, profileSetup: true, language: 'ru' })
	const member = await User.create({ email: 'member@example.com', name: 'Member', emailVerified: true, profileSetup: true })
	const board = await Board.create({ name: 'Launch', createdBy: owner._id })
	await BoardMember.create({ board: board._id, user: member._id, role: 'member' })
	const todo = await Column.create({ board: board._id, title: 'To do', position: 0 })
	const done = await Column.create({ board: board._id, title: 'Done', position: 1 })
	const mine = await Task.create({ column: todo._id, title: 'Write, plan; ship', description: 'Line one\nLine two', position: 0, dueDate: new Date('2026-10-30T00:00:00Z'), assignees: [owner._id], labels: ['Design'], priority: 'high' })
	const theirs = await Task.create({ column: todo._id, title: 'Their card', position: 1, dueDate: new Date('2026-11-02T00:00:00Z'), assignees: [member._id] })
	const finished = await Task.create({ column: done._id, title: 'Shipped', position: 0, dueDate: new Date('2026-10-20T00:00:00Z'), assignees: [owner._id] })
	await Task.create({ column: todo._id, title: 'No date', position: 2, assignees: [owner._id] })
	return { owner, member, board, todo, done, mine, theirs, finished }
}

describe('calendar file', () => {
	it('escapes text and folds long lines without splitting characters', () => {
		assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne')
		const line = `SUMMARY:${'Привет '.repeat(20)}`
		const folded = foldLine(line)
		for (const part of folded.split('\r\n')) assert.ok(Buffer.byteLength(part) <= 75, part)
		assert.equal(folded.replace(/\r\n /g, ''), line)
	})

	it('turns repeat rules into RRULEs, the end of short months included', () => {
		assert.equal(rruleOf({ frequency: 'daily', interval: 2 }, '2026-10-22'), 'FREQ=DAILY;INTERVAL=2')
		assert.equal(rruleOf({ frequency: 'weekdays' }, '2026-10-22'), 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
		assert.equal(rruleOf({ frequency: 'weekly', interval: 1, days: [5, 1] }, '2026-10-22'), 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR;WKST=MO')
		assert.equal(rruleOf({ frequency: 'monthly', interval: 1, dayOfMonth: 15, until: '2027-01-31' }, '2026-10-15'), 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15;UNTIL=20270131')
		assert.equal(rruleOf({ frequency: 'monthly', interval: 1, dayOfMonth: 31 }, '2026-10-31'), 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1')
		// Day 30: February gets its 28th (or 29th) as an extra date, like the app moves it.
		const thirtieth = recurrenceOf({ frequency: 'monthly', interval: 1, dayOfMonth: 30 }, '2026-10-30')
		assert.equal(thirtieth.rule, 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=30')
		assert.deepEqual(thirtieth.extraDates, ['2027-02-28', '2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28'])
		const leap = recurrenceOf({ frequency: 'yearly', interval: 1 }, '2028-02-29')
		assert.equal(leap.rule, 'FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=29')
		assert.deepEqual(leap.extraDates.slice(0, 4), ['2029-02-28', '2030-02-28', '2031-02-28', '2033-02-28'])
		assert.equal(rruleOf(null, '2026-10-22'), null)
	})

	it('makes all-day events from the start to the due day, and none without dates', () => {
		const now = new Date('2026-10-22T10:00:00Z')
		const ranged = eventOf({ task: { _id: 'a', title: 'Range', startDate: '2026-10-20T00:00:00Z', dueDate: '2026-10-22T00:00:00Z' }, now })
		assert.ok(ranged.includes('DTSTART;VALUE=DATE:20261020'))
		assert.ok(ranged.includes('DTEND;VALUE=DATE:20261023'))
		const repeating = eventOf({ task: { _id: 'b', title: 'Weekly', dueDate: '2026-10-22T00:00:00Z', repeat: { frequency: 'weekly', interval: 1, days: [4] } }, now })
		assert.ok(repeating.some((line) => line.startsWith('RRULE:FREQ=WEEKLY')))
		const finished = eventOf({ task: { _id: 'c', title: 'Weekly', dueDate: '2026-10-22T00:00:00Z', repeat: { frequency: 'weekly' } }, done: true, now })
		assert.ok(finished.includes('SUMMARY:✓ Weekly'))
		assert.ok(!finished.some((line) => line.startsWith('RRULE')))
		assert.equal(eventOf({ task: { _id: 'd', title: 'None' }, now }), null)
	})
})

describe('calendar link', () => {
	it('is off until turned on, keeps its address, and stops working when reset or turned off', async () => {
		const { owner } = await setup()
		assert.equal((await link('get', owner)).body.token, null)
		const { token } = (await link('post', owner).send({})).body
		assert.match(token, /^[\w-]{40,}$/)
		assert.equal((await link('get', owner)).body.token, token)
		assert.equal((await link('post', owner).send({})).body.token, token)
		assert.equal((await feed(token)).status, 200)

		const reset = (await link('post', owner).send({ reset: true })).body.token
		assert.notEqual(reset, token)
		assert.equal((await feed(token)).status, 404)
		assert.equal((await feed(reset)).status, 200)

		assert.equal((await link('delete', owner)).status, 204)
		assert.equal((await link('get', owner)).body.token, null)
		assert.equal((await feed(reset)).status, 404)
		assert.equal((await feed('not-a-token')).status, 404)
	})

	it('needs a signed-in account to see or change the link', async () => {
		assert.equal((await request(app).get('/api/calendar/link')).status, 401)
		assert.equal((await request(app).post('/api/calendar/link').send({})).status, 401)
	})

	it('lists my dated cards, every card of my boards, or one board', async () => {
		const { owner, board } = await setup()
		const { token } = (await link('post', owner).send({})).body
		const mine = await feed(token)
		assert.equal(mine.status, 200)
		assert.match(mine.headers['content-type'], /^text\/calendar/)
		const text = unfold(mine.text)
		assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n'))
		assert.ok(text.endsWith('END:VCALENDAR\r\n'))
		assert.ok(text.includes('X-WR-CALNAME:KanbanHub · Мои карточки'))
		assert.ok(text.includes('SUMMARY:Write\\, plan\\; ship'))
		assert.ok(text.includes('DTSTART;VALUE=DATE:20261030'))
		assert.ok(text.includes('Доска: Launch\\nСписок: To do\\n\\nLine one\\nLine two'))
		assert.ok(text.includes('CATEGORIES:Design'))
		assert.ok(text.includes('SUMMARY:✓ Shipped'), 'the last list counts as done')
		assert.ok(!text.includes('Their card'))
		assert.ok(!text.includes('No date'))

		const all = unfold((await feed(token, '?scope=all')).text)
		assert.ok(all.includes('Their card'))
		assert.equal(all.match(/BEGIN:VEVENT/g).length, 3)

		const open = unfold((await feed(token, '?scope=all&done=0')).text)
		assert.ok(!open.includes('Shipped'))

		const one = unfold((await feed(token, `?board=${board._id}`)).text)
		assert.ok(one.includes('X-WR-CALNAME:Launch · KanbanHub'))
		assert.equal(one.match(/BEGIN:VEVENT/g).length, 3)
	})

	it('never shows a board the person is not on (any more)', async () => {
		const { owner, member, board } = await setup()
		const other = await Board.create({ name: 'Secret', createdBy: owner._id })
		const secretColumn = await Column.create({ board: other._id, title: 'Hidden', position: 0 })
		await Task.create({ column: secretColumn._id, title: 'Secret plan', position: 0, dueDate: new Date('2026-10-25T00:00:00Z') })
		const { token } = (await link('post', member).send({})).body
		assert.equal((await feed(token, `?board=${other._id}`)).status, 404)
		assert.ok(!(await feed(token, '?scope=all')).text.includes('Secret plan'))
		assert.ok((await feed(token)).text.includes('Their card'))

		await BoardMember.deleteOne({ board: board._id, user: member._id })
		assert.equal((await feed(token, `?board=${board._id}`)).status, 404)
		assert.ok(!(await feed(token)).text.includes('Their card'))
	})
})
