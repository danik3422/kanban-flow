import crypto from 'node:crypto'

import { env } from '../config/env.js'
import Board from '../models/board.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'
import User from '../models/user.model.js'
import { getAccessibleBoardIds } from './boardAccess.service.js'
import { finishedColumnIdsOf } from './finishedColumns.service.js'
import { buildCalendar, eventOf } from './icalendar.service.js'

// The calendar link: a secret address that calendar apps read without signing in. Only
// a hash of its token is stored; the token itself is derived again to show the link.
// Resetting the link counts the version up, so the old address stops working.

const MAX_EVENTS = 3000
const MAX_DESCRIPTION = 1500

const tokenFor = (userId, version) => crypto.createHmac('sha256', env.jwtSecret).update(`calendar:${userId}:${version}`).digest('base64url')
const hashOf = (token) => crypto.createHash('sha256').update(token).digest('hex')

/** The person's calendar token, or null when the link is off. */
export const currentCalendarToken = async (userId) => {
	const user = await User.findById(userId).select('+calendarTokenHash calendarTokenVersion').lean()
	if (!user?.calendarTokenHash) return null
	const token = tokenFor(user._id, user.calendarTokenVersion || 0)
	return hashOf(token) === user.calendarTokenHash ? token : null
}

/** Turns the link on, or gives it a new address (`reset`), and returns the token. */
export const issueCalendarToken = async (userId, { reset = false } = {}) => {
	if (!reset) {
		const existing = await currentCalendarToken(userId)
		if (existing) return existing
	}
	const user = await User.findByIdAndUpdate(userId, { $inc: { calendarTokenVersion: 1 } }, { returnDocument: 'after' }).select('calendarTokenVersion').lean()
	const token = tokenFor(user._id, user.calendarTokenVersion)
	await User.updateOne({ _id: userId }, { $set: { calendarTokenHash: hashOf(token) } })
	return token
}

/** Turns the link off: every address given out so far stops working. */
export const revokeCalendarToken = async (userId) => {
	await User.updateOne({ _id: userId }, { $unset: { calendarTokenHash: 1 }, $inc: { calendarTokenVersion: 1 } })
}

export const userForCalendarToken = async (token) => {
	if (typeof token !== 'string' || !/^[\w-]{20,100}$/.test(token)) return null
	return User.findOne({ calendarTokenHash: hashOf(token) }).select('name email language').lean()
}

const WORDS = {
	en: { mine: 'My cards', all: 'All my boards', board: 'Board', list: 'List', open: 'Open in KanbanHub', desc: 'Cards with dates from KanbanHub' },
	uk: { mine: 'Мої картки', all: 'Усі мої дошки', board: 'Дошка', list: 'Список', open: 'Відкрити в KanbanHub', desc: 'Картки з датами з KanbanHub' },
	ru: { mine: 'Мои карточки', all: 'Все мои доски', board: 'Доска', list: 'Список', open: 'Открыть в KanbanHub', desc: 'Карточки с датами из KanbanHub' },
}

/**
 * The calendar file for a person. `scope` is "mine" (cards they are on), "all" (every
 * card of their boards) or a board id; `done: false` leaves finished cards out.
 * null when the board is not theirs (any more).
 */
export const calendarFor = async (user, { scope = 'mine', done = true, now = new Date() } = {}) => {
	const words = WORDS[user.language] || WORDS.en
	const accessible = await getAccessibleBoardIds(user._id)
	const boardScope = scope !== 'mine' && scope !== 'all'
	if (boardScope && !accessible.includes(String(scope))) return null
	const boardIds = boardScope ? [String(scope)] : accessible
	const [boards, columns] = await Promise.all([
		Board.find({ _id: { $in: boardIds } }).select('name').lean(),
		Column.find({ board: { $in: boardIds } }).select('board title position').lean(),
	])
	const finished = finishedColumnIdsOf(columns)
	const columnOf = new Map(columns.map((column) => [String(column._id), column]))
	const boardOf = new Map(boards.map((board) => [String(board._id), board]))
	const filter = {
		column: { $in: columns.map((column) => column._id) },
		$or: [{ dueDate: { $ne: null } }, { startDate: { $ne: null } }],
		...(scope === 'mine' && { assignees: user._id }),
	}
	const tasks = await Task.find(filter)
		.select('title description dueDate startDate column labels priority repeat completed updatedAt')
		.sort({ dueDate: -1 })
		.limit(MAX_EVENTS)
		.lean()
	const domain = new URL(env.frontendUrl).hostname || 'kanbanhub'
	const events = []
	for (const task of tasks) {
		const column = columnOf.get(String(task.column))
		const board = column && boardOf.get(String(column.board))
		if (!board) continue
		const isDone = Boolean(task.completed) || finished.has(String(column._id))
		if (isDone && !done) continue
		const url = `${env.frontendUrl}/workspaces/${board._id}?task=${task._id}`
		const text = (task.description || '').trim()
		const description = [
			`${words.board}: ${board.name}`,
			`${words.list}: ${column.title}`,
			...(text ? ['', text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION)}…` : text] : []),
			'',
			`${words.open}: ${url}`,
		].join('\n')
		const event = eventOf({ task, url, description, done: isDone, now, domain })
		if (event) events.push(event)
	}
	const name = boardScope ? `${boardOf.get(String(scope))?.name || words.board} · KanbanHub` : `KanbanHub · ${scope === 'all' ? words.all : words.mine}`
	return buildCalendar({ name, description: words.desc, events })
}
