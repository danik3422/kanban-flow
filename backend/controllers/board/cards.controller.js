import mongoose from 'mongoose'

import { emitBoardEvent } from '../../lib/realtime.js'
import Column from '../../models/column.model.js'
import Notification from '../../models/notification.model.js'
import Task from '../../models/task.model.js'
import TaskActivity from '../../models/taskActivity.model.js'
import TimeEntry from '../../models/timeEntry.model.js'
import { ensureBoardAccess, getCardAccess, validateBoardAssignees } from '../../services/boardAccess.service.js'
import { recordBoardActivity } from '../../services/boardActivity.service.js'
import { normalizeBackground } from '../../services/boardBackgrounds.service.js'
import { normalizeRepeat, todayKeyIn } from '../../services/recurrence.service.js'
import { startNextInSeries, takeBackNextInSeries } from '../../services/repeatingCards.service.js'
import { boardCardLimitMessage, exceedsBoardCardLimit, MAX_TASKS_PER_COLUMN } from '../../services/limits.service.js'
import {
	describeTaskContent,
	emitTask,
	notifyListWatchers,
	notifyTaskAssignees,
	populatedTask,
	recordTaskActivity,
} from '../../services/taskEvents.service.js'

// Cards: create, change, move, delete, copy and watch.

export const getColumnTasks = async (req, res) => {
	try {
		const columnId = req.params.id
		if (!mongoose.Types.ObjectId.isValid(columnId)) {
			return res.status(400).json({ message: 'Invalid column ID' })
		}

		const column = await Column.findById(columnId)
		if (!column) {
			return res.status(404).json({ message: 'Column not found' })
		}

		const { board, allowed } = await ensureBoardAccess(
			req.user._id,
			column.board,
		)
		if (!board) {
			return res.status(404).json({ message: 'Board not found' })
		}
		if (!allowed) {
			return res.status(403).json({ message: 'Access denied' })
		}

		const tasks = await Task.find({ column: columnId })
			.populate('assignees', 'name email avatar')
			.sort({ position: 1, createdAt: 1 })
			.lean()

		return res.status(200).json(tasks)
	} catch (error) {
		console.error('Error fetching column tasks:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const reorderTasks = async (req, res) => {
	let session
	try {
		const { columns } = req.body
		if (!Array.isArray(columns) || columns.length === 0) {
			return res.status(400).json({ message: 'Task order is required' })
		}
		if (columns.some((item) => !item || !Array.isArray(item.taskIds))) {
			return res.status(400).json({ message: 'Task order must contain task arrays' })
		}

		const board = req.board
		const { allowed } = await ensureBoardAccess(req.user._id, board)
		if (!allowed) return res.status(403).json({ message: 'Access denied' })

		const columnIds = columns.map((item) => item?.columnId)
		const taskIds = columns.flatMap((item) => item.taskIds || [])
		session = await mongoose.startSession()
		await session.withTransaction(async () => {
			if (columnIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
				const error = new Error('Invalid column ID')
				error.statusCode = 400
				throw error
			}
			const boardColumns = await Column.find({ board: board._id, _id: { $in: columnIds } }).session(session)
			if (boardColumns.length !== columns.length) {
				const error = new Error('Invalid board column')
				error.statusCode = 400
				throw error
			}
			if (taskIds.some((id) => !mongoose.Types.ObjectId.isValid(id)) || new Set(taskIds).size !== taskIds.length) {
				const error = new Error('Invalid task order')
				error.statusCode = 400
				throw error
			}
			const tasks = await Task.find({ column: { $in: columnIds } }).select('_id column').session(session)
			const orderedIds = new Set(taskIds)
			if (tasks.length !== taskIds.length || !tasks.every((task) => orderedIds.has(task._id.toString()))) {
				const error = new Error('Task order does not match the board')
				error.statusCode = 400
				throw error
			}

			const operations = []
			for (const column of columns) {
				column.taskIds.forEach((taskId, position) => {
					operations.push({
						updateOne: {
							filter: { _id: taskId },
							update: { $set: { column: column.columnId, position } },
						},
					})
				})
			}
			if (operations.length) await Task.bulkWrite(operations, { session })
			await Column.updateMany(
				{ board: board._id, _id: { $in: columnIds } },
				{ $set: { sortBy: 'custom' } },
				{ session },
			)
		})
		await session.endSession()

		for (const columnId of columnIds) {
			const reorderedTasks = await Task.find({ column: columnId })
				.populate('assignees', 'name email avatar')
				.sort({ position: 1, createdAt: 1 })
				.lean()
			emitBoardEvent(board._id.toString(), 'column:tasks-reordered', {
				columnId,
				tasks: reorderedTasks,
			})
			emitBoardEvent(board._id.toString(), 'column:sort-updated', {
				_id: columnId,
				sortBy: 'custom',
			})
		}
		return res.status(200).json({ message: 'Task order updated' })
	} catch (error) {
		if (session) await session.endSession().catch(() => {})
		console.error('Error reordering tasks:', error)
		return res.status(error.statusCode || 500).json({
			message: error.statusCode ? error.message : 'Could not reorder tasks',
		})
	}
}

export const createTask = async (req, res) => {
	try {
		const columnId = req.column._id
		const {
			title,
			description,
			assignees = [],
			labels = [],
			checklist = [],
			dueDate = null,
			priority = 'none',
			clientId,
		} = req.body

		const column = await Column.findById(columnId)
		if (!column) {
			return res.status(404).json({ message: 'Column not found' })
		}

		const { board, allowed } = await ensureBoardAccess(
			req.user._id,
			column.board,
		)
		if (!board) {
			return res.status(404).json({ message: 'Board not found' })
		}
		if (!allowed) {
			return res.status(403).json({ message: 'Access denied' })
		}
		if (!await validateBoardAssignees(board, assignees)) {
			return res.status(400).json({ message: 'All assignees must be active board members' })
		}

		if (!title || title.trim() === '') {
			return res.status(400).json({ message: 'Task title is required' })
		}
		// The same card sent again (the first answer was lost on a bad connection).
		if (clientId) {
			const existing = await Task.findOne({ clientId }).setOptions({ withArchived: true }).select('_id column')
			if (existing) return res.status(200).json(await populatedTask(existing._id))
		}

		const taskCount = await Task.countDocuments({ column: column._id })
		if (taskCount >= MAX_TASKS_PER_COLUMN) {
			return res.status(400).json({ message: `A column can hold up to ${MAX_TASKS_PER_COLUMN} tasks` })
		}
		if (await exceedsBoardCardLimit(board._id)) {
			return res.status(400).json({ message: boardCardLimitMessage })
		}
		const newTask = new Task({
			title: title.trim(),
			description: description || '',
			dueDate: dueDate || null,
			column: column._id,
			position: taskCount,
			assignees,
			labels,
			checklist,
			priority: ['none', 'low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'none',
			...(clientId && { clientId }),
		})

		await newTask.save()
		const savedTask = await Task.findById(newTask._id)
			.populate('assignees', 'name email avatar')
			.lean()
		await recordBoardActivity({
			boardId: column.board,
			userId: req.user._id,
			action: 'created',
			entityType: 'task',
			entityId: savedTask._id,
			entityName: savedTask.title,
			details: `created the task in ${column.title}`,
		})
		await recordTaskActivity({
			taskId: savedTask._id,
			boardId: column.board,
			userId: req.user._id,
			type: 'created',
			message: `added this card to ${column.title}`,
		})
		await notifyTaskAssignees({
			userIds: assignees,
			task: savedTask,
			board,
			actorId: req.user._id,
		})
		await notifyListWatchers({ column, task: savedTask, board, actorId: req.user._id })
		emitBoardEvent(column.board.toString(), 'task:created', savedTask)
		return res.status(201).json(savedTask)
	} catch (error) {
		console.error('Error creating task:', error)
		res.status(500).json({ message: 'Internal server error' })
	}
}

export const updateTask = async (req, res) => {
	try {
		const task = await Task.findById(req.params.id).populate('column', 'board')
		if (!task) return res.status(404).json({ message: 'Task not found' })
		const boardId = task.column.board.toString()
		const { board, allowed } = await ensureBoardAccess(req.user._id, boardId)
		if (!board || !allowed)
			return res.status(403).json({ message: 'Access denied' })

		const {
			title,
			description,
			dueDate,
			assignees,
			labels,
			checklist,
			position,
			column: targetColumnId,
			priority,
			startDate,
			completed,
			estimateMinutes,
			cover,
			repeat,
		} = req.body
		if (assignees !== undefined && !await validateBoardAssignees(board, assignees)) {
			return res.status(400).json({ message: 'All assignees must be active board members' })
		}
		const originalColumnId = task.column._id
		const originalColumn = await Column.findById(originalColumnId).select('title')
		const originalPosition = task.position
		const originalAssigneeIds = task.assignees.map((assignee) => assignee.toString())
		let targetColumn = task.column
		if (
			targetColumnId &&
			targetColumnId.toString() !== task.column._id.toString()
		) {
			targetColumn = await Column.findById(targetColumnId)
			if (
				!targetColumn ||
				targetColumn.board.toString() !== task.column.board.toString()
			) {
				return res.status(400).json({ message: 'Invalid target column' })
			}
			task.column = targetColumn._id
		}
		const contentBefore = describeTaskContent(task)
		if (title !== undefined) task.title = title.trim()
		if (description !== undefined) task.description = description
		const originalDueTime = task.dueDate ? new Date(task.dueDate).getTime() : null
		if (dueDate !== undefined) task.dueDate = dueDate || null
		const dueChanged = dueDate !== undefined && (task.dueDate ? new Date(task.dueDate).getTime() : null) !== originalDueTime
		// A new due date earns a new reminder.
		if (dueChanged) task.dueReminderSentAt = null
		if (assignees !== undefined) task.assignees = assignees
		if (labels !== undefined) task.labels = labels
		if (checklist !== undefined) task.checklist = checklist
		if (priority !== undefined) task.priority = priority
		if (startDate !== undefined) task.startDate = startDate || null
		if (estimateMinutes !== undefined) task.estimateMinutes = estimateMinutes
		if (repeat !== undefined) task.repeat = normalizeRepeat(repeat, task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : null, todayKeyIn(req.user.timezone))
		if (cover !== undefined) {
			try {
				// An image already attached to this card can be its cover too.
				const attached = cover?.type === 'photo' && /^attachment-/.test(cover.id || '')
					? task.attachments.find((item) => item.kind === 'image' && `attachment-${item._id}` === cover.id)
					: null
				task.cover = cover === null
					? null
					: cover.type === 'color'
						? cover
						: attached
							? { type: 'photo', id: cover.id, url: attached.url, thumb: attached.url, size: cover.size }
							: { ...normalizeBackground({ ...cover, type: 'photo' }), size: cover.size }
			} catch (error) {
				return res.status(400).json({ message: 'Choose a cover from the list.' })
			}
		}
		const completedChanged = completed !== undefined && Boolean(completed) !== Boolean(task.completed)
		if (completedChanged) {
			task.completed = Boolean(completed)
			task.completedAt = completed ? new Date() : null
		}
		const moved = originalColumnId.toString() !== targetColumn._id.toString()
		// A column change without an explicit slot appends the card to the target column.
		const requestedPosition = position !== undefined
			? position
			: moved
				? await Task.countDocuments({ column: targetColumn._id })
				: undefined
		const repositioned = requestedPosition !== undefined

		const session = await mongoose.startSession()
		try {
			await session.withTransaction(async () => {
				if (repositioned) {
					if (moved) {
						const targetCount = await Task.countDocuments({ column: targetColumn._id }).session(session)
						if (targetCount >= MAX_TASKS_PER_COLUMN) {
							const error = new Error(`A column can hold up to ${MAX_TASKS_PER_COLUMN} tasks`)
							error.statusCode = 400
							throw error
						}
						const nextPosition = Math.min(Math.max(0, requestedPosition), targetCount)
						await Task.updateMany(
							{ column: originalColumnId, _id: { $ne: task._id }, position: { $gt: originalPosition } },
							{ $inc: { position: -1 } },
							{ session },
						)
						await Task.updateMany(
							{ column: targetColumn._id, position: { $gte: nextPosition } },
							{ $inc: { position: 1 } },
							{ session },
						)
						task.position = nextPosition
					} else {
						const lastPosition = Math.max(0, await Task.countDocuments({ column: originalColumnId }).session(session) - 1)
						const nextPosition = Math.min(Math.max(0, requestedPosition), lastPosition)
						if (nextPosition < originalPosition) {
							await Task.updateMany(
								{ column: originalColumnId, _id: { $ne: task._id }, position: { $gte: nextPosition, $lt: originalPosition } },
								{ $inc: { position: 1 } },
								{ session },
							)
						} else if (nextPosition > originalPosition) {
							await Task.updateMany(
								{ column: originalColumnId, _id: { $ne: task._id }, position: { $gt: originalPosition, $lte: nextPosition } },
								{ $inc: { position: -1 } },
								{ session },
							)
						}
						task.position = nextPosition
					}
				}
				await task.save({ session })
			})
		} finally {
			await session.endSession()
		}
		// A repeating card brings the next one when completed, and takes it back when un-completed.
		let nextInSeries = null
		if (completedChanged && task.completed && task.repeat?.frequency && !task.repeatedTo) nextInSeries = await startNextInSeries(task, boardId, req.user)
		else if (completedChanged && !task.completed && task.repeatedTo) await takeBackNextInSeries(task, boardId)
		const updatedTask = await Task.findById(task._id)
			.populate('assignees', 'name email avatar')
			.lean()
		if (repositioned) {
			const affectedColumnIds = [originalColumnId.toString()]
			if (!affectedColumnIds.includes(targetColumn._id.toString())) {
				affectedColumnIds.push(targetColumn._id.toString())
			}
			for (const affectedColumnId of affectedColumnIds) {
				const reorderedTasks = await Task.find({ column: affectedColumnId })
					.populate('assignees', 'name email avatar')
					.sort({ position: 1, createdAt: 1 })
					.lean()
				emitBoardEvent(boardId, 'column:tasks-reordered', {
					columnId: affectedColumnId,
					tasks: reorderedTasks,
				})
			}
		}
		const contentAfter = describeTaskContent(task)
		const changedFields = Object.keys(contentAfter).filter((field) => contentAfter[field] !== contentBefore[field])
		// Plain reorders and saves without edits are not news; keep the feeds readable.
		if (moved || changedFields.length) await recordBoardActivity({
			boardId,
			userId: req.user._id,
			action: moved ? 'moved' : 'updated',
			entityType: 'task',
			entityId: task._id,
			entityName: updatedTask.title,
			details: moved
				? `moved ${updatedTask.title} from ${originalColumn?.title || 'previous column'} to ${targetColumn.title || 'new column'}`
				: `updated ${changedFields.join(', ')} of ${updatedTask.title}`,
		})
		if (moved || changedFields.length) await recordTaskActivity({
			taskId: task._id,
			boardId,
			userId: req.user._id,
			type: moved ? 'moved' : 'updated',
			message: moved
				? `moved this card from ${originalColumn?.title || 'previous column'} to ${targetColumn.title || 'new column'}`
				: `updated the ${changedFields.join(', ')}`,
			fromColumn: originalColumn?.title || '',
			toColumn: targetColumn.title || '',
			fields: moved ? undefined : changedFields,
		})
		if (completedChanged) {
			await recordTaskActivity({
				taskId: task._id,
				boardId,
				userId: req.user._id,
				type: task.completed ? 'completed' : 'reopened',
				message: task.completed ? 'marked this card complete' : 'marked this card incomplete',
			})
		}
		const newlyAssignedIds = (assignees === undefined ? [] : assignees)
			.map((assignee) => assignee.toString())
			.filter((assigneeId) => !originalAssigneeIds.includes(assigneeId))
		if (newlyAssignedIds.length) {
			await notifyTaskAssignees({
				userIds: newlyAssignedIds,
				task: updatedTask,
				board,
				actorId: req.user._id,
			})
		}
		// People taken off the card, and everyone still on it when its due date changes.
		const removedAssigneeIds = assignees === undefined ? [] : originalAssigneeIds
			.filter((assigneeId) => !assignees.map((assignee) => assignee.toString()).includes(assigneeId))
		if (removedAssigneeIds.length) {
			await notifyTaskAssignees({
				userIds: removedAssigneeIds,
				task: updatedTask,
				board,
				actorId: req.user._id,
				type: 'task_unassigned',
				title: 'Removed from a card',
				message: `You were removed from “${updatedTask.title}”.`,
			})
		}
		if (dueChanged && updatedTask.dueDate) {
			const keptAssigneeIds = updatedTask.assignees.map((assignee) => (assignee._id || assignee).toString())
				.filter((assigneeId) => !newlyAssignedIds.includes(assigneeId))
			if (keptAssigneeIds.length) {
				await notifyTaskAssignees({
					userIds: keptAssigneeIds,
					task: updatedTask,
					board,
					actorId: req.user._id,
					type: 'task_due_changed',
					title: 'Due date changed',
					message: `“${updatedTask.title}” has a new due date.`,
					details: { dueDate: updatedTask.dueDate },
				})
			}
		}
		if (moved && Array.isArray(assignees ?? task.assignees)) {
			// Assignees and watchers hear that the card moved.
			const nextAssigneeIds = [...new Set([...(assignees ?? task.assignees), ...(task.watchers || [])].map((assignee) => assignee.toString()))]
			const notificationTargets = nextAssigneeIds.filter((assigneeId) => assigneeId !== req.user._id.toString())
			if (notificationTargets.length) {
				await notifyTaskAssignees({
					userIds: notificationTargets,
					task: updatedTask,
					board,
					actorId: req.user._id,
					type: 'task_moved',
					title: 'Task moved',
					message: `“${updatedTask.title}” moved from ${originalColumn?.title || 'previous column'} to ${targetColumn.title || 'new column'}.`,
					details: { fromColumn: originalColumn?.title, toColumn: targetColumn.title },
				})
			}
		}
		if (moved) await notifyListWatchers({ column: targetColumn, task: updatedTask, board, actorId: req.user._id, fromColumn: originalColumn?.title })
		emitBoardEvent(boardId, 'task:updated', updatedTask)
		return res.status(200).json(nextInSeries ? { ...updatedTask, nextInSeries } : updatedTask)
	} catch (error) {
		if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
		console.error('Error updating task:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const deleteTask = async (req, res) => {
	try {
		const taskId = req.params.id
		const userId = req.user._id

		if (!mongoose.Types.ObjectId.isValid(taskId)) {
			return res.status(400).json({ message: 'Invalid task ID' })
		}

		// Archived cards can be deleted for good from the archive, even when their list is archived too.
		const task = await Task.findById(taskId).setOptions({ withArchived: true })
		const column = task && await Column.findById(task.column).setOptions({ withArchived: true }).select('board title')
		if (!task || !column) {
			return res.status(404).json({ message: 'Task not found' })
		}

		const { board, allowed } = await ensureBoardAccess(userId, column.board)
		if (!board || !allowed) {
			return res.status(403).json({ message: 'Access denied' })
		}

		const columnId = column._id
		const position = task.position
		const columnTitle = column.title
		const session = await mongoose.startSession()
		let activity
		try {
			await session.withTransaction(async () => {
				// Only the request that actually removes the card may shift its neighbours,
				// otherwise a double delete moves the rest of the column up twice.
				const { deletedCount } = await Task.deleteOne({ _id: taskId }, { session })
				if (!deletedCount) {
					const error = new Error('Task not found')
					error.statusCode = 404
					throw error
				}
				// An archived card already left the order when it was archived.
				if (!task.archivedAt) {
					await Task.updateMany(
						{ column: columnId, position: { $gt: position }, archivedAt: null },
						{ $inc: { position: -1 } },
						{ session },
					)
				}
				await TaskActivity.deleteMany({ task: taskId }, { session })
				await TimeEntry.deleteMany({ task: taskId }, { session })
				await Notification.deleteMany({ task: taskId }, { session })
				await TaskActivity.create([{
					task: taskId,
					board: board._id,
					user: userId,
					type: 'deleted',
					message: `removed this card from ${columnTitle}`,
				}], { session })
				activity = await recordBoardActivity({
					boardId: board._id,
					userId,
					action: 'deleted',
					entityType: 'task',
					entityId: task._id,
					entityName: task.title,
					details: `deleted ${task.title} from ${columnTitle}`,
					session,
					emit: false,
				})
			})
		} finally {
			await session.endSession()
		}

		emitBoardEvent(board._id.toString(), 'activity:new', activity)
		emitBoardEvent(board._id.toString(), 'task:deleted', { taskId })

		return res.status(200).json({ message: 'Task deleted successfully' })
	} catch (error) {
		if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
		console.error('Error deleting task:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

/** Copy a card into any list of the same board, right after the original by default. */
export const copyTask = async (req, res) => {
	const session = await mongoose.startSession()
	try {
		const access = await getCardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const { task, board } = access
		const targetColumn = req.body.column ? await Column.findById(req.body.column).select('board title') : access.column
		if (!targetColumn || targetColumn.board.toString() !== board._id.toString()) return res.status(400).json({ message: 'Invalid target column' })
		if (await exceedsBoardCardLimit(board._id)) return res.status(400).json({ message: boardCardLimitMessage })
		const sameColumn = targetColumn._id.toString() === task.column.toString()
		const keep = req.body.keep || {}
		let copy
		await session.withTransaction(async () => {
			const position = sameColumn ? task.position + 1 : await Task.countDocuments({ column: targetColumn._id }).session(session)
			await Task.updateMany({ column: targetColumn._id, position: { $gte: position } }, { $inc: { position: 1 } }, { session })
			;[copy] = await Task.create([{
				title: req.body.title.trim(),
				description: task.description,
				column: targetColumn._id,
				position,
				priority: task.priority,
				labels: keep.labels === false ? [] : task.labels,
				checklist: keep.checklist === false ? [] : task.checklist.map(({ text, completed }) => ({ text, completed })),
				assignees: keep.members === false ? [] : task.assignees,
				attachments: keep.attachments === false ? [] : task.attachments.map(({ kind, url, name, addedBy }) => ({ kind, url, name, addedBy })),
				dueDate: keep.dates === false ? null : task.dueDate,
				startDate: keep.dates === false ? null : task.startDate,
				estimateMinutes: task.estimateMinutes,
				cover: task.cover,
			}], { session })
			await TaskActivity.create([{ task: copy._id, board: board._id, user: req.user._id, type: 'copied', message: task.title }], { session })
		})
		emitBoardEvent(board._id.toString(), 'board:content-changed', {})
		return res.status(201).json(await populatedTask(copy._id))
	} catch (error) {
		console.error('Card copy failed:', error)
		return res.status(500).json({ message: 'Could not copy the card' })
	} finally {
		await session.endSession()
	}
}

export const toggleWatchTask = async (req, res) => {
	try {
		const access = await getCardAccess(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Task not found' })
		const watching = access.task.watchers.some((id) => id.toString() === req.user._id.toString())
		await Task.updateOne({ _id: access.task._id }, watching ? { $pull: { watchers: req.user._id } } : { $addToSet: { watchers: req.user._id } })
		const task = await emitTask(access.board._id, access.task._id)
		return res.status(200).json({ watching: !watching, task })
	} catch (error) {
		console.error('Watch toggle failed:', error)
		return res.status(500).json({ message: 'Could not change watching' })
	}
}

export const getFeatures = (req, res) => res.status(200).json({ uploads: true })
