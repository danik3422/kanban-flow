import mongoose from 'mongoose'

import Board from '../../models/board.model.js'
import BoardMember from '../../models/boardMember.model.js'
import Column from '../../models/column.model.js'
import Task from '../../models/task.model.js'
import TaskActivity from '../../models/taskActivity.model.js'
import { getBoardWithRole } from '../../services/boardAccess.service.js'
import { recordBoardActivity } from '../../services/boardActivity.service.js'
import { boardLimitMessage, MAX_CARDS_PER_BOARD, reachedBoardLimit } from '../../services/limits.service.js'

// Moving boards in and out: a full export (JSON to bring back later, CSV for spreadsheets)
// and an import of a board the app has already read from a Trello or KanbanHub file.

export const EXPORT_FORMAT = 'kanbanhub-board'
const MAX_IMPORTED_COMMENTS = 5000

const withArchived = { withArchived: true }
const dateOnly = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null)
const fileName = (name, extension) => {
	const base = String(name || 'board').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'board'
	return `${base}-${new Date().toISOString().slice(0, 10)}.${extension}`
}
const attachmentHeader = (name, extension) => {
	const ascii = fileName(name, extension)
	const unicode = `${String(name || 'board').trim() || 'board'}.${extension}`
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(unicode)}`
}
const plainText = (html) => String(html || '')
	.replace(/<\/(p|li|h\d|div)>/gi, '\n')
	.replace(/<br\s*\/?>/gi, '\n')
	.replace(/<[^>]+>/g, '')
	.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
	.replace(/\n{3,}/g, '\n\n')
	.trim()
const csvCell = (value) => {
	const text = String(value ?? '')
	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Everything on a board, archived lists and cards included, in reading order. */
const collectBoard = async (board) => {
	const columns = await Column.find({ board: board._id }).setOptions(withArchived).sort({ archivedAt: 1, position: 1 }).lean()
	const tasks = await Task.find({ column: { $in: columns.map((column) => column._id) } })
		.setOptions(withArchived)
		.populate('assignees', 'name email')
		.sort({ position: 1 })
		.lean()
	const comments = await TaskActivity.find({ task: { $in: tasks.map((task) => task._id) }, type: 'comment' })
		.populate('user', 'name email')
		.sort({ createdAt: 1 })
		.lean()
	const commentsOf = Map.groupBy(comments, (comment) => comment.task.toString())
	const tasksOf = Map.groupBy(tasks, (task) => task.column.toString())
	return columns.map((column) => ({
		column,
		tasks: (tasksOf.get(column._id.toString()) || []).map((task) => ({ task, comments: commentsOf.get(task._id.toString()) || [] })),
	}))
}

/** GET /boards/:id/export?format=json|csv: a file to keep, move or open in a spreadsheet. */
export const exportBoard = async (req, res) => {
	try {
		const access = await getBoardWithRole(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Board not found' })
		const { board } = access
		const content = await collectBoard(board)
		res.setHeader('Cache-Control', 'no-store')

		if (req.query.format === 'csv') {
			const header = ['List', 'Card', 'Description', 'Labels', 'Members', 'Start date', 'Due date', 'Priority', 'Completed', 'Checklist', 'Archived', 'Created']
			const rows = content.flatMap(({ column, tasks }) => tasks.map(({ task }) => [
				column.title,
				task.title,
				plainText(task.description),
				(task.labels || []).join(', '),
				(task.assignees || []).map((person) => person.name || person.email).join(', '),
				dateOnly(task.startDate) || '',
				dateOnly(task.dueDate) || '',
				task.priority && task.priority !== 'none' ? task.priority : '',
				task.completed ? 'yes' : '',
				task.checklist?.length ? `${task.checklist.filter((item) => item.completed).length}/${task.checklist.length}` : '',
				task.archivedAt || column.archivedAt ? 'yes' : '',
				dateOnly(task.createdAt) || '',
			]))
			res.setHeader('Content-Type', 'text/csv; charset=utf-8')
			res.setHeader('Content-Disposition', attachmentHeader(board.name, 'csv'))
			// The byte order mark makes Excel read the file as UTF-8.
			return res.status(200).send(`﻿${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`)
		}

		const file = {
			format: EXPORT_FORMAT,
			version: 1,
			exportedAt: new Date().toISOString(),
			name: board.name,
			description: board.description || '',
			labels: (board.labels || []).map(({ name, color }) => ({ name, color })),
			columns: content.map(({ column, tasks }) => ({
				title: column.title,
				color: column.color || null,
				archived: Boolean(column.archivedAt),
				cards: tasks.map(({ task, comments }) => ({
					title: task.title,
					description: task.description || '',
					dueDate: dateOnly(task.dueDate),
					startDate: dateOnly(task.startDate),
					priority: task.priority || 'none',
					labels: task.labels || [],
					checklist: (task.checklist || []).map(({ text, completed }) => ({ text, completed: Boolean(completed) })),
					completed: Boolean(task.completed),
					archived: Boolean(task.archivedAt && !task.archivedWithColumn),
					estimateMinutes: task.estimateMinutes || 0,
					members: (task.assignees || []).map((person) => person.name || person.email),
					attachments: (task.attachments || []).filter((item) => item.kind === 'link').map(({ url, name }) => ({ url, name })),
					comments: comments.map((comment) => ({ text: comment.message, author: comment.user?.name || comment.user?.email || '', date: comment.createdAt })),
				})),
			})),
		}
		res.setHeader('Content-Type', 'application/json; charset=utf-8')
		res.setHeader('Content-Disposition', attachmentHeader(board.name, 'json'))
		return res.status(200).send(JSON.stringify(file, null, 2))
	} catch (error) {
		console.error('Board export failed:', error)
		return res.status(500).json({ message: 'Could not export the board' })
	}
}

const commentText = ({ text, author, date }) => {
	const when = date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString().slice(0, 10) : ''
	const signature = [author, when].filter(Boolean).join(', ')
	return (signature ? `${text}\n\n— ${signature}` : text).slice(0, 2000)
}

/**
 * POST /boards/import: a new private board with the lists, labels, cards, checklists and
 * comments of the file. Closed Trello lists and cards land in the archive. Comments keep
 * their author's name in the text, since those people have no account here.
 */
export const importBoard = async (req, res) => {
	const session = await mongoose.startSession()
	try {
		const { name, description, visibility, source, labels, columns } = req.body
		const cardCount = columns.reduce((sum, column) => sum + column.cards.length, 0)
		const commentCount = columns.reduce((sum, column) => sum + column.cards.reduce((inner, card) => inner + (card.comments?.length || 0), 0), 0)
		if (cardCount > MAX_CARDS_PER_BOARD) return res.status(400).json({ message: `A board can hold up to ${MAX_CARDS_PER_BOARD} cards` })
		if (commentCount > MAX_IMPORTED_COMMENTS) return res.status(400).json({ message: `An import can bring up to ${MAX_IMPORTED_COMMENTS} comments` })
		if (await reachedBoardLimit(req.user._id)) return res.status(400).json({ message: boardLimitMessage })

		const userId = req.user._id
		const now = new Date()
		const boardLabels = [...new Map(labels.map((label) => [label.name.toLowerCase(), label])).values()]
		const labelNames = new Set(boardLabels.map((label) => label.name))
		let board
		await session.withTransaction(async () => {
			;[board] = await Board.create([{ name, description: description || '', visibility, createdBy: userId, labels: boardLabels }], { session })
			await BoardMember.create([{ board: board._id, user: userId, role: 'admin' }], { session })

			// Open lists keep their order; archived ones go after them, out of sight.
			let openPosition = 0
			const columnDocs = await Column.insertMany(columns.map((column, index) => ({
				board: board._id,
				title: column.title,
				color: column.color || null,
				position: column.archived ? columns.length + index : openPosition++,
				...(column.archived && { archivedAt: now, archivedBy: userId }),
			})), { session })

			const taskDocs = []
			const commentsByTask = []
			columns.forEach((column, columnIndex) => {
				let position = 0
				for (const card of column.cards) {
					const archived = column.archived || card.archived
					taskDocs.push({
						column: columnDocs[columnIndex]._id,
						position: archived ? column.cards.length + position : position++,
						title: card.title,
						description: card.description || '',
						dueDate: card.dueDate ? new Date(card.dueDate) : null,
						startDate: card.startDate ? new Date(card.startDate) : null,
						priority: card.priority || 'none',
						labels: (card.labels || []).filter((label) => labelNames.has(label)),
						checklist: card.checklist || [],
						completed: Boolean(card.completed),
						completedAt: card.completed ? now : null,
						estimateMinutes: card.estimateMinutes || 0,
						...(archived && { archivedAt: now, archivedBy: userId, archivedWithColumn: Boolean(column.archived && !card.archived) }),
					})
					commentsByTask.push(card.comments || [])
				}
			})
			const inserted = taskDocs.length ? await Task.insertMany(taskDocs, { session }) : []
			const activities = inserted.flatMap((task, index) => commentsByTask[index].map((comment) => ({
				task: task._id,
				board: board._id,
				user: userId,
				type: 'comment',
				message: commentText(comment),
			})))
			if (activities.length) await TaskActivity.insertMany(activities, { session })
			await recordBoardActivity({
				boardId: board._id,
				userId,
				action: 'created',
				entityType: 'board',
				entityId: board._id,
				entityName: board.name,
				details: `imported this board from ${source === 'trello' ? 'Trello' : 'a KanbanHub file'}`,
				session,
				emit: false,
			})
		})
		return res.status(201).json({ ...board.toObject(), access: 'owned', role: 'owner', imported: { lists: columns.length, cards: cardCount, comments: commentCount } })
	} catch (error) {
		console.error('Board import failed:', error)
		return res.status(500).json({ message: 'Could not import the board' })
	} finally {
		await session.endSession()
	}
}
