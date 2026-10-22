import mongoose from 'mongoose'

import { emitBoardEvent } from '../../lib/realtime.js'
import Board from '../../models/board.model.js'
import BoardMember from '../../models/boardMember.model.js'
import Column from '../../models/column.model.js'
import Notification from '../../models/notification.model.js'
import Task from '../../models/task.model.js'
import TaskActivity from '../../models/taskActivity.model.js'
import TimeEntry from '../../models/timeEntry.model.js'
import { canManageBoard, ensureBoardAccess } from '../../services/boardAccess.service.js'
import { recordBoardActivity } from '../../services/boardActivity.service.js'
import {
	boardCardLimitMessage,
	exceedsBoardCardLimit,
	MAX_COLUMNS_PER_BOARD,
	MAX_TASKS_PER_COLUMN,
} from '../../services/limits.service.js'

// Lists (columns) of a board, and loading a board's lists with their cards.

export const getBoardContent = async (req, res) => {
	try {
		const { board, allowed } = await ensureBoardAccess(req.user._id, req.board)
		if (!board) return res.status(404).json({ message: 'Board not found' })
		if (!allowed) return res.status(403).json({ message: 'Access denied' })

		const columns = await Column.find({ board: board._id })
			.sort({ position: 1, createdAt: 1 })
			.lean()
		const tasks = await Task.find({ column: { $in: columns.map((column) => column._id) } })
			.populate('assignees', 'name email avatar')
			.sort({ position: 1, createdAt: 1 })
			.lean()
		// What the card faces show: how many comments, and who has a timer running.
		const taskIds = tasks.map((task) => task._id)
		const [commentCounts, runningTimers] = await Promise.all([
			TaskActivity.aggregate([{ $match: { task: { $in: taskIds }, type: 'comment' } }, { $group: { _id: '$task', count: { $sum: 1 } } }]),
			TimeEntry.find({ task: { $in: taskIds }, endedAt: null }).select('task user startedAt').lean(),
		])
		const commentsByTask = new Map(commentCounts.map((row) => [row._id.toString(), row.count]))
		const runningByTask = new Map()
		for (const entry of runningTimers) {
			const key = entry.task.toString()
			runningByTask.set(key, [...(runningByTask.get(key) || []), { user: entry.user, startedAt: entry.startedAt }])
		}
		const tasksByColumn = new Map(columns.map((column) => [column._id.toString(), []]))
		for (const task of tasks) {
			task.commentCount = commentsByTask.get(task._id.toString()) || 0
			task.runningTimers = runningByTask.get(task._id.toString()) || []
			tasksByColumn.get(task.column.toString())?.push(task)
		}

		return res.status(200).json(columns.map((column) => ({
			...column,
			tasks: tasksByColumn.get(column._id.toString()) || [],
		})))
	} catch (error) {
		console.error('Board content fetch failed:', error)
		return res.status(500).json({ message: 'Could not load this board' })
	}
}

export const getBoardColumns = async (req, res) => {
	try {
		const boardId = req.params.id
		if (!mongoose.Types.ObjectId.isValid(boardId)) {
			return res.status(400).json({ message: 'Invalid board ID' })
		}

		const { board, allowed } = await ensureBoardAccess(req.user._id, req.board)
		if (!board) {
			return res.status(404).json({ message: 'Board not found' })
		}
		if (!allowed) {
			return res.status(403).json({ message: 'Access denied' })
		}

		const columns = await Column.find({ board: boardId })
			.sort({ position: 1, createdAt: 1 })
			.lean()

		return res.status(200).json(columns)
	} catch (error) {
		console.error('Error fetching board columns:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const createColumn = async (req, res) => {
	try {
		const board = req.board
		const userId = req.user._id
		const { title } = req.body

		if (!title || title.trim() === '') {
			return res.status(400).json({ message: 'Column title is required' })
		}
		if (title.trim().length > 60) {
			return res.status(400).json({ message: 'Column title must be 60 characters or fewer' })
		}

		if (board.createdBy.toString() !== userId.toString()) {
			const boardMember = await BoardMember.findOne({
				board: board._id,
				user: userId,
			})

			if (!boardMember || boardMember.role !== 'admin') {
				return res.status(403).json({
					message: 'Access denied: Only board admins can create columns.',
				})
			}
		}

		// The server appends: client-supplied positions collide when people add columns at once.
		const columnCount = await Column.countDocuments({ board: board._id })
		if (columnCount >= MAX_COLUMNS_PER_BOARD) {
			return res.status(400).json({ message: `A board can have up to ${MAX_COLUMNS_PER_BOARD} columns` })
		}
		const newColumn = new Column({
			title: title.trim(),
			board: board._id,
			position: columnCount,
		})

		const savedColumn = await newColumn.save()
		await recordBoardActivity({
			boardId: board._id,
			userId,
			action: 'created',
			entityType: 'column',
			entityId: savedColumn._id,
			entityName: savedColumn.title,
			details: `created the ${savedColumn.title} column`,
		})
		emitBoardEvent(board._id.toString(), 'column:created', savedColumn.toObject())
		res.status(201).json(savedColumn)
	} catch (error) {
		console.error('Error creating column:', error)
		res.status(500).json({ message: 'Internal server error' })
	}
}

export const updateColumn = async (req, res) => {
	try {
		const columnId = req.params.id
		const userId = req.user._id
		const { title, pinned, color } = req.body

		if (!mongoose.Types.ObjectId.isValid(columnId)) {
			return res.status(400).json({ message: 'Invalid column ID' })
		}

		const column = await Column.findById(columnId)
		if (!column) {
			return res.status(404).json({ message: 'Column not found' })
		}

		const board = await Board.findById(column.board)
		if (!board) {
			return res.status(404).json({ message: 'Board not found' })
		}

		// Check if user is board creator or admin
		const canManage = board.createdBy.toString() === userId.toString() ||
			await BoardMember.exists({ board: board._id, user: userId, role: 'admin' })

		if (!canManage) {
			return res.status(403).json({
				message: 'Access denied: Only board admins can update columns.',
			})
		}

		const previousTitle = column.title
		if (typeof title !== 'undefined') {
			if (!title || title.trim() === '') {
				return res.status(400).json({ message: 'Column title is required' })
			}
			if (title.trim().length > 60) {
				return res.status(400).json({ message: 'Column title must be 60 characters or fewer' })
			}
			column.title = title.trim()
		}

		if (typeof pinned !== 'undefined') {
			if (typeof pinned !== 'boolean') {
				return res.status(400).json({ message: 'Pinned must be a boolean' })
			}
			column.pinned = pinned
		}
		if (typeof color !== 'undefined') column.color = color

		const updatedColumn = await column.save()
		const columnData = updatedColumn.toObject()
		if (typeof title !== 'undefined' || typeof pinned !== 'undefined') {
			await recordBoardActivity({
				boardId: column.board,
				userId,
				action: 'updated',
				entityType: 'column',
				entityId: column._id,
				entityName: column.title,
				details: typeof title !== 'undefined'
					? `renamed column from ${previousTitle} to ${column.title}`
					: `${column.pinned ? 'pinned' : 'unpinned'} the ${column.title} column`,
			})
		}

		emitBoardEvent(column.board.toString(), 'column:updated', columnData)

		return res.status(200).json(columnData)
	} catch (error) {
		console.error('Error updating column:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const reorderColumn = async (req, res) => {
	let session
	try {
		const columnId = req.params.id
		const userId = req.user._id
		const requestedPosition = Number(req.body.position)

		if (!mongoose.Types.ObjectId.isValid(columnId)) {
			return res.status(400).json({ message: 'Invalid column ID' })
		}
		if (!Number.isInteger(requestedPosition) || requestedPosition < 0) {
			return res.status(400).json({ message: 'Invalid column position' })
		}

		const column = await Column.findById(columnId)
		if (!column) return res.status(404).json({ message: 'Column not found' })

		const board = await Board.findById(column.board)
		if (!board) return res.status(404).json({ message: 'Board not found' })

		const canManage = board.createdBy.toString() === userId.toString() ||
			await BoardMember.exists({ board: board._id, user: userId, role: 'admin' })
		if (!canManage) {
			return res.status(403).json({
				message: 'Access denied: Only board admins can reorder columns.',
			})
		}

		let columns
		let activity = null
		session = await mongoose.startSession()
		await session.withTransaction(async () => {
			const currentColumn = await Column.findById(columnId).session(session)
			const columnCount = await Column.countDocuments({ board: board._id }).session(session)
			const nextPosition = Math.min(requestedPosition, Math.max(0, columnCount - 1))
			const originalPosition = currentColumn.position
			if (nextPosition < originalPosition) {
				await Column.updateMany(
					{ board: board._id, _id: { $ne: currentColumn._id }, position: { $gte: nextPosition, $lt: originalPosition } },
					{ $inc: { position: 1 } },
					{ session },
				)
			} else if (nextPosition > originalPosition) {
				await Column.updateMany(
					{ board: board._id, _id: { $ne: currentColumn._id }, position: { $gt: originalPosition, $lte: nextPosition } },
					{ $inc: { position: -1 } },
					{ session },
				)
			}
			currentColumn.position = nextPosition
			await currentColumn.save({ session })
			if (nextPosition !== originalPosition) {
				activity = await recordBoardActivity({
					boardId: board._id,
					userId,
					action: 'reordered',
					entityType: 'column',
					entityId: currentColumn._id,
					entityName: currentColumn.title,
					details: `moved ${currentColumn.title} from position ${originalPosition + 1} to ${nextPosition + 1}`,
					session,
					emit: false,
				})
			}
			columns = await Column.find({ board: board._id })
				.sort({ position: 1, createdAt: 1 })
				.session(session)
				.lean()
		})
		await session.endSession()
		if (activity) emitBoardEvent(board._id.toString(), 'activity:new', activity)
		emitBoardEvent(board._id.toString(), 'columns:reordered', { columns })
		return res.status(200).json(columns)
	} catch (error) {
		if (session) await session.endSession().catch(() => {})
		console.error('Error reordering column:', error)
		return res.status(500).json({ message: 'Could not reorder column' })
	}
}

export const updateColumnSort = async (req, res) => {
	try {
		const columnId = req.params.id
		const userId = req.user._id
		const { sortBy } = req.body

		if (!mongoose.Types.ObjectId.isValid(columnId)) {
			return res.status(400).json({ message: 'Invalid column ID' })
		}

		const column = await Column.findById(columnId)
		if (!column) {
			return res.status(404).json({ message: 'Column not found' })
		}

		const board = await Board.findById(column.board)
		if (!board) {
			return res.status(404).json({ message: 'Board not found' })
		}

		// Check if user has access to this board
		const { allowed } = await ensureBoardAccess(userId, board)
		if (!allowed) {
			return res.status(403).json({ message: 'Access denied' })
		}

		// Validate sortBy value
		const validSortValues = [
			'date-newest',
			'date-oldest',
			'name-alpha',
			'due-date',
			'priority',
			'custom',
			null,
		]
		if (!validSortValues.includes(sortBy)) {
			return res.status(400).json({ message: 'Invalid sort option' })
		}

		column.sortBy = sortBy
		const updatedColumn = await column.save()
		const columnData = updatedColumn.toObject()
		await recordBoardActivity({
			boardId: column.board,
			userId,
			action: 'changed sort',
			entityType: 'column',
			entityId: column._id,
			entityName: column.title,
			details: `changed ${column.title} sorting to ${sortBy || 'custom'}`,
		})

		emitBoardEvent(column.board.toString(), 'column:sort-updated', columnData)

		return res.status(200).json(columnData)
	} catch (error) {
		console.error('Error updating column sort:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const deleteColumn = async (req, res) => {
	try {
		const columnId = req.params.id
		const userId = req.user._id

		if (!mongoose.Types.ObjectId.isValid(columnId)) {
			return res.status(400).json({ message: 'Invalid column ID' })
		}

		// An archived list can be deleted for good from the archive.
		const column = await Column.findById(columnId).setOptions({ withArchived: true })
		if (!column) {
			return res.status(404).json({ message: 'Column not found' })
		}

		const board = await Board.findById(column.board)
		if (!board) {
			return res.status(404).json({ message: 'Board not found' })
		}

		// Check if user is board creator or admin
		const canManage = board.createdBy.toString() === userId.toString() ||
			await BoardMember.exists({ board: board._id, user: userId, role: 'admin' })

		if (!canManage) {
			return res.status(403).json({
				message: 'Access denied: Only board admins can delete columns.',
			})
		}
		const session = await mongoose.startSession()
		let activity
		try {
			await session.withTransaction(async () => {
				const taskIds = await Task.find({ column: columnId }).setOptions({ withArchived: true }).distinct('_id').session(session)
				await Task.deleteMany({ column: columnId }, { session })
				await TaskActivity.deleteMany({ task: { $in: taskIds } }, { session })
				await TimeEntry.deleteMany({ task: { $in: taskIds } }, { session })
				await Notification.deleteMany({ task: { $in: taskIds } }, { session })
				await Column.deleteOne({ _id: columnId }, { session })
				// An archived list already left the order when it was archived.
				if (!column.archivedAt) {
					await Column.updateMany(
						{ board: column.board, position: { $gt: column.position } },
						{ $inc: { position: -1 } },
						{ session },
					)
				}
				activity = await recordBoardActivity({
					boardId: board._id,
					userId,
					action: 'deleted',
					entityType: 'column',
					entityId: column._id,
					entityName: column.title,
					details: `deleted the ${column.title} column and its tasks`,
					session,
					emit: false,
				})
			})
		} finally {
			await session.endSession()
		}

		emitBoardEvent(board._id.toString(), 'activity:new', activity)
		emitBoardEvent(column.board.toString(), 'column:deleted', { columnId })

		return res.status(200).json({ message: 'Column deleted successfully' })
	} catch (error) {
		console.error('Error deleting column:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

// Columns are loaded with the column middleware; these helpers keep the checks in one place.
const managedColumnContext = async (req, res) => {
	const column = await Column.findById(req.params.id)
	if (!column) {
		res.status(404).json({ message: 'Column not found' })
		return null
	}
	const board = await Board.findById(column.board)
	if (!board) {
		res.status(404).json({ message: 'Board not found' })
		return null
	}
	if (!(await canManageBoard(board, req.user._id))) {
		res.status(403).json({ message: 'Only board admins can change lists.' })
		return null
	}
	return { column, board }
}

const COPIED_TASK_FIELDS = 'title description dueDate labels checklist priority assignees position'

/** Copy a list with all its cards, placed right after the original. */
export const copyColumn = async (req, res) => {
	let session
	try {
		const context = await managedColumnContext(req, res)
		if (!context) return
		const { column, board } = context
		if (await Column.countDocuments({ board: board._id }) >= MAX_COLUMNS_PER_BOARD) {
			return res.status(400).json({ message: `A board can have up to ${MAX_COLUMNS_PER_BOARD} columns` })
		}
		if (await exceedsBoardCardLimit(board._id, await Task.countDocuments({ column: column._id }))) {
			return res.status(400).json({ message: boardCardLimitMessage })
		}
		let copy
		session = await mongoose.startSession()
		await session.withTransaction(async () => {
			await Column.updateMany({ board: board._id, position: { $gt: column.position } }, { $inc: { position: 1 } }, { session })
			const [created] = await Column.create([{
				title: req.body.title.trim(),
				board: board._id,
				position: column.position + 1,
				color: column.color,
				sortBy: column.sortBy,
			}], { session })
			copy = created
			const tasks = await Task.find({ column: column._id }).select(COPIED_TASK_FIELDS).sort({ position: 1, createdAt: 1 }).session(session).lean()
			if (tasks.length) {
				await Task.insertMany(tasks.map(({ _id, ...task }, index) => ({
					...task,
					checklist: (task.checklist || []).map(({ _id: itemId, ...item }) => item),
					column: copy._id,
					position: index,
				})), { session })
			}
		})
		await session.endSession()
		session = null
		await recordBoardActivity({
			boardId: board._id,
			userId: req.user._id,
			action: 'created',
			entityType: 'column',
			entityId: copy._id,
			entityName: copy.title,
			details: `copied the ${column.title} column as ${copy.title}`,
		})
		emitBoardEvent(board._id.toString(), 'board:content-changed', { reason: 'column-copied' })
		return res.status(201).json(copy.toObject())
	} catch (error) {
		if (session) await session.endSession().catch(() => {})
		console.error('Error copying column:', error)
		return res.status(500).json({ message: 'Could not copy the list' })
	}
}

/** Move every card of a list to the end of another list on the same board. */
export const moveColumnTasks = async (req, res) => {
	try {
		const context = await managedColumnContext(req, res)
		if (!context) return
		const { column, board } = context
		const target = await Column.findOne({ _id: req.body.targetColumnId, board: board._id })
		if (!target) return res.status(400).json({ message: 'Choose a list on this board.' })
		if (target._id.equals(column._id)) return res.status(200).json({ moved: 0 })
		const tasks = await Task.find({ column: column._id }).select('_id').sort({ position: 1, createdAt: 1 }).lean()
		if (!tasks.length) return res.status(200).json({ moved: 0 })
		const offset = await Task.countDocuments({ column: target._id })
		if (offset + tasks.length > MAX_TASKS_PER_COLUMN) {
			return res.status(400).json({ message: `A column can hold up to ${MAX_TASKS_PER_COLUMN} tasks` })
		}
		await Task.bulkWrite(tasks.map((task, index) => ({
			updateOne: { filter: { _id: task._id }, update: { $set: { column: target._id, position: offset + index } } },
		})))
		await Column.updateOne({ _id: target._id }, { $set: { sortBy: 'custom' } })
		await recordBoardActivity({
			boardId: board._id,
			userId: req.user._id,
			action: 'moved',
			entityType: 'column',
			entityId: column._id,
			entityName: column.title,
			details: `moved ${tasks.length} cards from ${column.title} to ${target.title}`,
		})
		emitBoardEvent(board._id.toString(), 'board:content-changed', { reason: 'cards-moved' })
		return res.status(200).json({ moved: tasks.length })
	} catch (error) {
		console.error('Error moving column cards:', error)
		return res.status(500).json({ message: 'Could not move the cards' })
	}
}

/** Start or stop watching a list; any member may watch. */
export const watchColumn = async (req, res) => {
	try {
		const column = req.column
		const { allowed } = await ensureBoardAccess(req.user._id, column.board)
		if (!allowed) return res.status(403).json({ message: 'Access denied' })
		const update = req.body.watching ? { $addToSet: { watchers: req.user._id } } : { $pull: { watchers: req.user._id } }
		const updated = await Column.findByIdAndUpdate(column._id, update, { returnDocument: 'after' }).lean()
		emitBoardEvent(updated.board.toString(), 'column:updated', updated)
		return res.status(200).json(updated)
	} catch (error) {
		console.error('Error watching column:', error)
		return res.status(500).json({ message: 'Could not update watching' })
	}
}
