import mongoose from 'mongoose'

import { emitBoardEvent } from '../../lib/realtime.js'
import Column from '../../models/column.model.js'
import Task from '../../models/task.model.js'
import { canManageBoard, getBoardWithRole, getCardAccess } from '../../services/boardAccess.service.js'
import { recordBoardActivity } from '../../services/boardActivity.service.js'
import { MAX_COLUMNS_PER_BOARD, MAX_TASKS_PER_COLUMN } from '../../services/limits.service.js'
import { recordTaskActivity } from '../../services/taskEvents.service.js'

// The archive: cards and lists put away instead of deleted, and brought back later.
// Archived items keep their content, comments and time; reads skip them (models/archivable.js).

const ARCHIVE_LIMIT = 200

const withArchived = { withArchived: true }

const fail = (status, message) => Object.assign(new Error(message), { statusCode: status })

const respondError = (res, error, fallback) => {
	if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
	console.error(`${fallback}:`, error)
	return res.status(500).json({ message: fallback })
}

/** GET /boards/:id/archive: archived cards (newest first) and archived lists with their card counts. */
export const getBoardArchive = async (req, res) => {
	try {
		const access = await getBoardWithRole(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Board not found' })
		const columns = await Column.find({ board: access.board._id }).setOptions(withArchived).select('title archivedAt archivedBy').populate('archivedBy', 'name email').lean()
		const titleOf = new Map(columns.map((column) => [column._id.toString(), column.title]))
		const archivedColumns = columns.filter((column) => column.archivedAt)
		const [tasks, counts] = await Promise.all([
			Task.find({ column: { $in: columns.map((column) => column._id) }, archivedAt: { $ne: null }, archivedWithColumn: { $ne: true } })
				.select('title column labels dueDate archivedAt archivedBy')
				.populate('archivedBy', 'name email')
				.sort({ archivedAt: -1 })
				.limit(ARCHIVE_LIMIT)
				.lean(),
			Task.aggregate([
				{ $match: { column: { $in: archivedColumns.map((column) => column._id) }, archivedWithColumn: true } },
				{ $group: { _id: '$column', count: { $sum: 1 } } },
			]).option(withArchived),
		])
		const countOf = new Map(counts.map((item) => [item._id.toString(), item.count]))
		return res.status(200).json({
			tasks: tasks.map((task) => ({ ...task, columnTitle: titleOf.get(task.column.toString()) || '' })),
			columns: archivedColumns
				.sort((a, b) => b.archivedAt - a.archivedAt)
				.map((column) => ({ ...column, taskCount: countOf.get(column._id.toString()) || 0 })),
		})
	} catch (error) {
		return respondError(res, error, 'Could not load the archive')
	}
}

/** POST /tasks/:id/archive: the card leaves its list; the cards below move up. */
export const archiveTask = async (req, res) => {
	const session = await mongoose.startSession()
	try {
		const access = await getCardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const { task, column, board } = access
		await session.withTransaction(async () => {
			const { modifiedCount } = await Task.updateOne(
				{ _id: task._id, archivedAt: null },
				{ $set: { archivedAt: new Date(), archivedBy: req.user._id, archivedWithColumn: false } },
				{ session },
			)
			if (!modifiedCount) throw fail(404, 'Task not found')
			await Task.updateMany({ column: column._id, position: { $gt: task.position }, archivedAt: null }, { $inc: { position: -1 } }, { session })
		})
		await recordTaskActivity({ taskId: task._id, boardId: board._id, userId: req.user._id, type: 'archived', message: `archived this card from ${column.title}` })
		await recordBoardActivity({ boardId: board._id, userId: req.user._id, action: 'archived', entityType: 'task', entityId: task._id, entityName: task.title, details: `archived ${task.title}` })
		emitBoardEvent(board._id.toString(), 'task:deleted', { taskId: task._id.toString() })
		return res.status(200).json({ taskId: task._id })
	} catch (error) {
		return respondError(res, error, 'Could not archive the card')
	} finally {
		await session.endSession()
	}
}

/** POST /tasks/:id/restore: back to the end of its list, or of the first list when its own is archived. */
export const restoreTask = async (req, res) => {
	try {
		if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Task not found' })
		const task = await Task.findOne({ _id: req.params.id, archivedAt: { $ne: null } })
		const ownColumn = task && await Column.findById(task.column).setOptions(withArchived)
		const access = ownColumn && await getBoardWithRole(ownColumn.board, req.user._id)
		if (!task || !access) return res.status(404).json({ message: 'Task not found' })
		const target = ownColumn.archivedAt
			? await Column.findOne({ board: access.board._id }).sort({ position: 1 })
			: ownColumn
		if (!target) return res.status(400).json({ message: 'Add a list to the board first' })
		const position = await Task.countDocuments({ column: target._id })
		if (position >= MAX_TASKS_PER_COLUMN) return res.status(400).json({ message: `A list can hold up to ${MAX_TASKS_PER_COLUMN} cards` })
		await Task.updateOne(
			{ _id: task._id },
			{ $set: { column: target._id, position, archivedAt: null, archivedBy: null, archivedWithColumn: false } },
		)
		await recordTaskActivity({ taskId: task._id, boardId: access.board._id, userId: req.user._id, type: 'restored', message: `restored this card to ${target.title}`, toColumn: target.title })
		await recordBoardActivity({ boardId: access.board._id, userId: req.user._id, action: 'restored', entityType: 'task', entityId: task._id, entityName: task.title, details: `restored ${task.title}` })
		emitBoardEvent(access.board._id.toString(), 'board:content-changed', { reason: 'card-restored' })
		return res.status(200).json({ taskId: task._id, columnId: target._id })
	} catch (error) {
		return respondError(res, error, 'Could not restore the card')
	}
}

// Lists belong to the board's admins, like creating and deleting them.
const managedColumn = async (req, { archived }) => {
	if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw fail(404, 'Column not found')
	const column = await Column.findOne({ _id: req.params.id, archivedAt: archived ? { $ne: null } : null })
	const access = column && await getBoardWithRole(column.board, req.user._id)
	if (!column || !access) throw fail(404, 'Column not found')
	if (!(await canManageBoard(access.board, req.user._id))) throw fail(403, 'Only board admins can archive lists')
	return { column, board: access.board }
}

/** POST /columns/:id/archive: the list and the cards in it go to the archive together. */
export const archiveColumn = async (req, res) => {
	const session = await mongoose.startSession()
	try {
		const { column, board } = await managedColumn(req, { archived: false })
		const now = new Date()
		await session.withTransaction(async () => {
			await Task.updateMany(
				{ column: column._id, archivedAt: null },
				{ $set: { archivedAt: now, archivedBy: req.user._id, archivedWithColumn: true } },
				{ session },
			)
			await Column.updateOne({ _id: column._id }, { $set: { archivedAt: now, archivedBy: req.user._id } }, { session })
			await Column.updateMany({ board: board._id, position: { $gt: column.position }, archivedAt: null }, { $inc: { position: -1 } }, { session })
		})
		await recordBoardActivity({ boardId: board._id, userId: req.user._id, action: 'archived', entityType: 'column', entityId: column._id, entityName: column.title, details: `archived the ${column.title} list` })
		emitBoardEvent(board._id.toString(), 'column:deleted', { columnId: column._id.toString() })
		return res.status(200).json({ columnId: column._id })
	} catch (error) {
		return respondError(res, error, 'Could not archive the list')
	} finally {
		await session.endSession()
	}
}

/** POST /columns/:id/restore: the list comes back at the end of the board with the cards archived with it. */
export const restoreColumn = async (req, res) => {
	const session = await mongoose.startSession()
	try {
		const { column, board } = await managedColumn(req, { archived: true })
		const position = await Column.countDocuments({ board: board._id })
		if (position >= MAX_COLUMNS_PER_BOARD) return res.status(400).json({ message: `A board can hold up to ${MAX_COLUMNS_PER_BOARD} lists` })
		await session.withTransaction(async () => {
			await Column.updateOne({ _id: column._id }, { $set: { archivedAt: null, archivedBy: null, position } }, { session })
			await Task.updateMany(
				{ column: column._id, archivedWithColumn: true },
				{ $set: { archivedAt: null, archivedBy: null, archivedWithColumn: false } },
				{ session },
			)
		})
		await recordBoardActivity({ boardId: board._id, userId: req.user._id, action: 'restored', entityType: 'column', entityId: column._id, entityName: column.title, details: `restored the ${column.title} list` })
		emitBoardEvent(board._id.toString(), 'board:content-changed', { reason: 'list-restored' })
		return res.status(200).json({ columnId: column._id })
	} catch (error) {
		return respondError(res, error, 'Could not restore the list')
	} finally {
		await session.endSession()
	}
}
