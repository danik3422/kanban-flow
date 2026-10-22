import mongoose from 'mongoose'

import { emitBoardEvent, revokeUserBoardAccess } from '../../lib/realtime.js'
import Board from '../../models/board.model.js'
import BoardActivity from '../../models/boardActivity.model.js'
import BoardInvite from '../../models/boardInvite.model.js'
import BoardMember from '../../models/boardMember.model.js'
import BoardRule from '../../models/boardRule.model.js'
import Column from '../../models/column.model.js'
import Notification from '../../models/notification.model.js'
import Task from '../../models/task.model.js'
import TaskActivity from '../../models/taskActivity.model.js'
import TimeEntry from '../../models/timeEntry.model.js'
import User from '../../models/user.model.js'
import { ensureBoardAccess } from '../../services/boardAccess.service.js'
import { recordBoardActivity } from '../../services/boardActivity.service.js'
import { normalizeBackground, releaseUploadedBackground, reportUnsplashUse } from '../../services/boardBackgrounds.service.js'
import { finishedColumnIdsOf } from '../../services/finishedColumns.service.js'
import { boardLimitMessage, reachedBoardLimit } from '../../services/limits.service.js'

// Boards themselves: create, copy, open, change, delete, leave, and the board list.

const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

/** A template's lists, labels and example cards for a new board (validated by createBoardSchema). */
const addStarter = async (board, starter, session) => {
	const labels = [...new Map(starter.labels.map((label) => [label.name.toLowerCase(), label])).values()]
	const labelNames = new Set(labels.map((label) => label.name))
	board.labels = labels
	await board.save({ session })
	const columns = await Column.insertMany(starter.columns.map((column, position) => ({ board: board._id, title: column.title, position })), { session })
	const tasks = starter.columns.flatMap((column, index) => column.cards.map((card, position) => ({
		column: columns[index]._id,
		position,
		title: card.title,
		description: card.description ? card.description.split(/\n+/).map((line) => `<p>${escapeHtml(line)}</p>`).join('') : '',
		labels: (card.labels || []).filter((name) => labelNames.has(name)),
		checklist: (card.checklist || []).map((text) => ({ text, completed: false })),
		priority: card.priority || 'none',
	})))
	if (tasks.length) await Task.insertMany(tasks, { session })
}

export const createBoard = async (req, res) => {
	const session = await mongoose.startSession()
	try {
		const { name, visibility = 'private', background, starter } = req.body
		if (!name?.trim()) {
			return res.status(400).json({ message: 'Board name is required' })
		}
		let boardBackground = null
		try {
			boardBackground = background === undefined ? null : normalizeBackground(background)
		} catch (error) {
			return res.status(error.statusCode || 400).json({ message: error.message })
		}
		if (!['private', 'workspace', 'public'].includes(visibility)) {
			return res.status(400).json({ message: 'Invalid board visibility' })
		}
		if (await reachedBoardLimit(req.user._id)) {
			return res.status(400).json({ message: boardLimitMessage })
		}

		let newBoard
		let activity
		await session.withTransaction(async () => {
			newBoard = new Board({
				name: name.trim(),
				createdBy: req.user._id,
				visibility,
				background: boardBackground,
			})
			await newBoard.save({ session })
			if (starter) await addStarter(newBoard, starter, session)
			await BoardMember.create([{
				board: newBoard._id,
				user: req.user._id,
				role: 'admin',
			}], { session })
			activity = await recordBoardActivity({
				boardId: newBoard._id,
				userId: req.user._id,
				action: 'created',
				entityType: 'board',
				entityId: newBoard._id,
				entityName: newBoard.name,
				details: 'created this board',
				session,
				emit: false,
			})
		})
		emitBoardEvent(newBoard._id.toString(), 'activity:new', activity)
		if (boardBackground?.type === 'photo') reportUnsplashUse(background)

		res.status(201).json(newBoard)
	} catch (error) {
		console.error('Error creating board:', error)
		res.status(500).json({ message: 'Internal server error' })
	} finally {
		await session.endSession()
	}
}

const COPIED_CARD_FIELDS = 'title description dueDate labels checklist priority position'

/**
 * Copy a board (Trello's "Copy board"): its lists, optionally its cards (without
 * assignees, comments or time), background and description. The copy is private
 * and belongs to whoever copied it.
 */
export const copyBoard = async (req, res) => {
	const session = await mongoose.startSession()
	try {
		const source = req.board
		const { name, keepCards } = req.body
		// Only people on the board can copy it.
		const { allowed } = await ensureBoardAccess(req.user._id, source)
		if (!allowed) return res.status(404).json({ message: 'Board not found' })
		if (await reachedBoardLimit(req.user._id)) return res.status(400).json({ message: boardLimitMessage })
		const columns = await Column.find({ board: source._id }).sort({ position: 1 }).lean()
		const tasks = keepCards ? await Task.find({ column: { $in: columns.map((column) => column._id) } }).select(`${COPIED_CARD_FIELDS} column`).lean() : []
		let copy
		await session.withTransaction(async () => {
			;[copy] = await Board.create([{
				name: name.trim(),
				description: source.description || '',
				createdBy: req.user._id,
				visibility: 'private',
				background: source.background || null,
			}], { session })
			await BoardMember.create([{ board: copy._id, user: req.user._id, role: 'admin' }], { session })
			const newColumns = await Column.insertMany(columns.map((column) => ({
				board: copy._id,
				title: column.title,
				position: column.position,
				color: column.color,
				sortBy: column.sortBy,
			})), { session })
			const columnMap = new Map(columns.map((column, index) => [column._id.toString(), newColumns[index]._id]))
			if (tasks.length) {
				await Task.insertMany(tasks.map((task) => ({
					title: task.title,
					description: task.description,
					dueDate: task.dueDate,
					labels: task.labels,
					checklist: (task.checklist || []).map(({ text, completed }) => ({ text, completed })),
					priority: task.priority,
					position: task.position,
					column: columnMap.get(task.column.toString()),
				})), { session })
			}
			await recordBoardActivity({
				boardId: copy._id,
				userId: req.user._id,
				action: 'created',
				entityType: 'board',
				entityId: copy._id,
				entityName: copy.name,
				details: `copied this board from ${source.name}`,
				session,
				emit: false,
			})
		})
		return res.status(201).json({ ...copy.toObject(), access: 'owned', role: 'owner' })
	} catch (error) {
		console.error('Board copy failed:', error)
		return res.status(500).json({ message: 'Could not copy the board' })
	} finally {
		await session.endSession()
	}
}

export const getBoardById = async (req, res) => {
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

		return res.status(200).json(board)
	} catch (error) {
		console.error('Error fetching board by id:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const updateBoard = async (req, res) => {
	try {
		const board = req.board
		const userId = req.user._id
		const { name, visibility, background, description } = req.body
		let nextBackground
		try {
			nextBackground = background === undefined ? undefined : normalizeBackground(background, { current: board.background })
		} catch (error) {
			return res.status(error.statusCode || 400).json({ message: error.message })
		}

		if (name !== undefined && (!name || !name.trim())) {
			return res.status(400).json({ message: 'Board name is required' })
		}

		const trimmedName = name === undefined ? board.name : name.trim()
		if (trimmedName.length > 100) {
			return res.status(400).json({ message: 'Board name is too long' })
		}
		if (visibility !== undefined && !['private', 'workspace', 'public'].includes(visibility)) {
			return res.status(400).json({ message: 'Invalid board visibility' })
		}

		const isOwner = board.createdBy.toString() === userId.toString()
		const isAdmin = !isOwner
			? await BoardMember.exists({
					board: board._id,
					user: userId,
					role: 'admin',
				})
			: true

		if (!isOwner && !isAdmin) {
			return res.status(403).json({
				message: 'Only the board owner or admin can rename the board',
			})
		}

		const previousName = board.name
		const previousVisibility = board.visibility
		const previousBackground = board.background ? board.background.toObject?.() || board.background : null
		board.name = trimmedName
		const descriptionChanged = description !== undefined && description.trim() !== (board.description || '')
		if (description !== undefined) board.description = description.trim()
		if (nextBackground !== undefined) {
			board.background = nextBackground
			if (nextBackground?.type === 'photo') reportUnsplashUse(background)
		}
		if (visibility !== undefined) {
			board.visibility = visibility
			if (previousVisibility !== visibility) {
				board.visibilityVersion = Number(board.visibilityVersion || 0) + 1
			}
			if (previousVisibility === 'public' && visibility !== 'public') {
				board.publicTokenHash = ''
				board.publicTokenVersion = Number(board.publicTokenVersion || 0) + 1
			}
		}
		await board.save()
		if (previousName !== trimmedName) {
			await recordBoardActivity({
				boardId: board._id,
				userId,
				action: 'renamed',
				entityType: 'board',
				entityId: board._id,
				entityName: trimmedName,
				details: `renamed this board from ${previousName} to ${trimmedName}`,
			})
		}
		if (descriptionChanged) {
			await recordBoardActivity({
				boardId: board._id,
				userId,
				action: 'updated',
				entityType: 'board',
				entityId: board._id,
				entityName: trimmedName,
				details: 'updated the board description',
			})
		}
		if (visibility !== undefined && previousVisibility !== visibility) {
			const expiredLinkDetails =
				previousVisibility === 'public' && visibility !== 'public'
					? 'Automatically expired active invite links and the public view link'
					: 'Automatically expired active invite links'
			await recordBoardActivity({
				boardId: board._id,
				userId,
				action: 'changed visibility',
				entityType: 'board',
				entityId: board._id,
				entityName: trimmedName,
				details: `changed room visibility from ${previousVisibility} to ${visibility}. ${expiredLinkDetails}`,
			})
		}
		emitBoardEvent(board._id.toString(), 'board:updated', board.toObject())
		if (previousBackground?.url && previousBackground.url !== board.background?.url) releaseUploadedBackground(previousBackground)

		return res.status(200).json(board)
	} catch (error) {
		console.error('Error updating board:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const removeBoard = async (req, res) => {
	try {
		const userId = req.user._id
		const boardId = req.board._id

		if (!mongoose.Types.ObjectId.isValid(boardId)) {
			return res.status(400).json({ message: 'Invalid Board ID' })
		}

		const board = await Board.findById(boardId)
		if (!board) {
			return res.status(404).json({ message: 'Board not found' })
		}

		if (board.createdBy.toString() !== userId.toString()) {
			return res.status(403).json({
				message: 'Access denied: Only the board creator can delete the board.',
			})
		}

		const memberIds = await BoardMember.find({ board: boardId }).distinct('user')
		const session = await mongoose.startSession()
		try {
			// Delete everything in one transaction so a failure never leaves orphans.
			await session.withTransaction(async () => {
				// Archived lists and cards go too.
				const columnIds = await Column.find({ board: boardId }).setOptions({ withArchived: true }).distinct('_id').session(session)
				const taskIds = await Task.find({ column: { $in: columnIds } }).setOptions({ withArchived: true }).distinct('_id').session(session)
				await TaskActivity.deleteMany({ board: boardId }, { session })
				await TimeEntry.deleteMany({ task: { $in: taskIds } }, { session })
				await Notification.deleteMany({
					$or: [{ board: boardId }, { task: { $in: taskIds } }],
				}, { session })
				await Task.deleteMany({ column: { $in: columnIds } }, { session })
				await Column.deleteMany({ board: boardId }, { session })
				await BoardMember.deleteMany({ board: boardId }, { session })
				await BoardInvite.deleteMany({ board: boardId }, { session })
				await BoardActivity.deleteMany({ board: boardId }, { session })
				await BoardRule.deleteMany({ board: boardId }, { session })
				await Board.deleteOne({ _id: boardId }, { session })
			})
		} finally {
			await session.endSession()
		}

		for (const memberId of memberIds) {
			if (memberId.toString() === userId.toString()) continue
			revokeUserBoardAccess(memberId, boardId, { reason: 'board-deleted', boardName: board.name })
		}
		releaseUploadedBackground(board.background)

		return res
			.status(200)
			.json({ message: 'Board and related data deleted successfully' })
	} catch (error) {
		console.error('Error removing board:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const leaveBoard = async (req, res) => {
	try {
		const board = req.board
		const userId = req.user._id

		if (board.createdBy.toString() === userId.toString()) {
			return res.status(403).json({
				message: 'The board owner cannot leave the board. Delete it instead.',
			})
		}

		const membership = await BoardMember.findOne({
			board: board._id,
			user: userId,
		})

		if (!membership) {
			return res.status(404).json({ message: 'You are not a member of this board.' })
		}
		const session = await mongoose.startSession()
		let activity
		try {
			await session.withTransaction(async () => {
				const columnIds = await Column.find({ board: board._id }).setOptions({ withArchived: true }).distinct('_id').session(session)
				await BoardMember.deleteMany({ board: board._id, user: userId }, { session })
				await Notification.deleteMany({ user: userId, board: board._id }, { session })
				await BoardInvite.deleteMany({ board: board._id, createdBy: userId, usedAt: null }, { session })
				await Task.updateMany(
					{ column: { $in: columnIds } },
					{ $pull: { assignees: userId } },
					{ session },
				)
				activity = await recordBoardActivity({
					boardId: board._id,
					userId,
					action: 'left',
					entityType: 'member',
					entityId: userId,
					entityName: req.user.name || req.user.email,
					details: 'left this board',
					session,
					emit: false,
				})
			})
		} finally {
			await session.endSession()
		}
		emitBoardEvent(board._id.toString(), 'activity:new', activity)
		revokeUserBoardAccess(userId, board._id, {
			reason: 'left-board',
		})

		return res.status(200).json({ message: 'You left the board successfully' })
	} catch (error) {
		console.error('Leaving board failed:', error)
		return res.status(500).json({ message: 'Could not leave the board' })
	}
}

export const getUserBoards = async (req, res) => {
	try {
		const userId = req.user._id
		if (!userId) {
			return res.status(400).json({ message: 'User ID is required' })
		}

		const membership = await BoardMember.find({ user: userId })
			.select('board role')
			.lean()

		const boards = await Board.find({
			$or: [
				{ createdBy: userId },
				{ _id: { $in: membership.map((member) => member.board) } },
			],
		}).lean()

		if (!boards || boards.length === 0) return res.status(200).json([])

		const membershipByBoard = new Map(
			membership.map((member) => [member.board.toString(), member]),
		)
		const boardsWithAccess = boards.map((board) => {
			const member = membershipByBoard.get(board._id.toString())
			const isOwner = board.createdBy.toString() === userId.toString()
			return {
				...board,
				access: isOwner ? 'owned' : 'invited',
				role: isOwner ? 'owner' : member?.role || 'member',
			}
		})

		res.status(200).json(boardsWithAccess)
	} catch (error) {
		console.error('Error fetching user boards:', error)
		res.status(500).json({ message: 'Internal server error' })
	}
}

// Summary numbers for the board list: tasks, open overdue and open mine, members and last activity.
// A handful of grouped queries cover every accessible board at once.
export const getBoardsOverview = async (req, res) => {
	try {
		const userId = req.user._id
		const memberBoardIds = await BoardMember.find({ user: userId }).distinct('board')
		const boardIds = await Board.find({
			$or: [{ createdBy: userId }, { _id: { $in: memberBoardIds } }],
		}).distinct('_id')
		if (!boardIds.length) return res.status(200).json([])

		const columns = await Column.find({ board: { $in: boardIds } }).select('_id board position').lean()
		const boardOfColumn = new Map(columns.map((column) => [column._id.toString(), column.board.toString()]))
		const finishedColumnIds = finishedColumnIdsOf(columns)
		const startOfToday = new Date()
		startOfToday.setHours(0, 0, 0, 0)

		const [taskGroups, memberGroups, activityGroups] = await Promise.all([
			Task.aggregate([
				{ $match: { column: { $in: columns.map((column) => column._id) } } },
				{
					$group: {
						_id: '$column',
						taskCount: { $sum: 1 },
						overdueCount: { $sum: { $cond: [{ $and: [{ $ne: ['$dueDate', null] }, { $lt: ['$dueDate', startOfToday] }] }, 1, 0] } },
						myTaskCount: { $sum: { $cond: [{ $in: [userId, { $ifNull: ['$assignees', []] }] }, 1, 0] } },
					},
				},
			]),
			BoardMember.aggregate([
				{ $match: { board: { $in: boardIds } } },
				{ $sort: { createdAt: 1 } },
				{ $group: { _id: '$board', memberCount: { $sum: 1 }, users: { $push: '$user' } } },
				{ $project: { memberCount: 1, users: { $slice: ['$users', 4] } } },
			]),
			BoardActivity.aggregate([
				{ $match: { board: { $in: boardIds } } },
				{ $group: { _id: '$board', lastActivityAt: { $max: '$createdAt' } } },
			]),
		])

		const userIds = [...new Set(memberGroups.flatMap((group) => group.users.map((id) => id.toString())))]
		const users = await User.find({ _id: { $in: userIds } }).select('name avatar').lean()
		const userById = new Map(users.map((user) => [user._id.toString(), { _id: user._id, name: user.name || '', avatar: user.avatar || '' }]))

		const summary = new Map(boardIds.map((id) => [id.toString(), {
			boardId: id,
			taskCount: 0,
			overdueCount: 0,
			myTaskCount: 0,
			memberCount: 0,
			members: [],
			lastActivityAt: null,
		}]))
		for (const group of taskGroups) {
			const entry = summary.get(boardOfColumn.get(group._id.toString()))
			if (!entry) continue
			entry.taskCount += group.taskCount
			if (finishedColumnIds.has(group._id.toString())) continue
			entry.overdueCount += group.overdueCount
			entry.myTaskCount += group.myTaskCount
		}
		for (const group of memberGroups) {
			const entry = summary.get(group._id.toString())
			if (!entry) continue
			entry.memberCount = group.memberCount
			entry.members = group.users.map((id) => userById.get(id.toString())).filter(Boolean)
		}
		for (const group of activityGroups) {
			const entry = summary.get(group._id.toString())
			if (entry) entry.lastActivityAt = group.lastActivityAt
		}
		return res.status(200).json([...summary.values()])
	} catch (error) {
		console.error('Error building boards overview:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const getBoardActivities = async (req, res) => {
	try {
		const { board, allowed } = await ensureBoardAccess(req.user._id, req.board)
		if (!board) return res.status(404).json({ message: 'Board not found' })
		if (!allowed) return res.status(403).json({ message: 'Access denied' })

		const activities = await BoardActivity.find({ board: req.board._id })
			.populate('user', 'name email avatar')
			.sort({ createdAt: -1 })
			.limit(200)
			.lean()
		return res.status(200).json(activities)
	} catch (error) {
		console.error('Board activity fetch failed:', error)
		return res.status(500).json({ message: 'Could not load board activity' })
	}
}
