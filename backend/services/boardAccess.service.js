import mongoose from 'mongoose'

import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'

// Who may see or change a board, a card or a task. Every board route goes through one of these.

// Accepts a loaded board (from boardMiddleware) to avoid fetching it a second time.
const resolveBoard = (boardOrId) =>
	boardOrId?.createdBy ? boardOrId : Board.findById(boardOrId)

/** Owners and members may open a board: `{ board, allowed }`. */
export const ensureBoardAccess = async (userId, boardOrId) => {
	const board = await resolveBoard(boardOrId)
	if (!board) return { board: null, allowed: false }
	if (board.createdBy.toString() === userId.toString()) return { board, allowed: true }
	const membership = await BoardMember.exists({ board: board._id, user: userId })
	return { board, allowed: Boolean(membership) }
}

/** Owners and admins manage invites, links and lists. */
export const canManageBoard = async (board, userId) => {
	if (board.createdBy.toString() === userId.toString()) return true
	return Boolean(
		await BoardMember.exists({
			board: board._id,
			user: userId,
			role: 'admin',
		}),
	)
}

/** True when every assignee is a valid id of someone on the board. */
export const validateBoardAssignees = async (board, assignees) => {
	if (!Array.isArray(assignees)) return false
	if (assignees.some((userId) => !userId || !mongoose.Types.ObjectId.isValid(userId))) {
		return false
	}
	const uniqueAssigneeIds = [...new Set(assignees.map((userId) => userId.toString()))]
	const memberIds = await BoardMember.find({
		board: board._id,
		user: { $in: uniqueAssigneeIds },
	}).distinct('user')
	const allowedIds = new Set([
		board.createdBy.toString(),
		...memberIds.map((userId) => userId.toString()),
	])
	return uniqueAssigneeIds.every((userId) => allowedIds.has(userId))
}

/** 'owner', 'admin', 'member', or null when the person is not on the board. */
export const getBoardRole = async (board, userId) => {
	if (board.createdBy.toString() === userId.toString()) return 'owner'
	const membership = await BoardMember.findOne({ board: board._id, user: userId }).select('role').lean()
	return membership?.role || null
}

/** The card, its board and the person's role there; null when they may not see it. */
export const getCardAccess = async (taskId, userId) => {
	if (!mongoose.Types.ObjectId.isValid(taskId)) return null
	const task = await Task.findById(taskId)
	if (!task) return null
	const column = await Column.findById(task.column).select('board title')
	if (!column) return null
	const board = await Board.findById(column.board)
	if (!board) return null
	const role = await getBoardRole(board, userId)
	if (!role) return null
	return { task, column, board, role, isManager: role === 'owner' || role === 'admin' }
}

/** The board and the person's role there; null when they may not see it. */
export const getBoardWithRole = async (boardId, userId) => {
	if (!mongoose.Types.ObjectId.isValid(boardId)) return null
	const board = await Board.findById(boardId)
	if (!board) return null
	const role = await getBoardRole(board, userId)
	return role ? { board, role } : null
}

/** The task (with its column populated) and its board; null when the person may not see it. */
export const getAccessibleTask = async (taskId, userId) => {
	if (!mongoose.Types.ObjectId.isValid(taskId)) return null
	const task = await Task.findById(taskId).populate('column', 'board')
	// A task whose column is gone has no board left to check access against.
	if (!task?.column) return null
	const board = await Board.findById(task.column.board).select('createdBy name')
	if (!board) return null
	const isOwner = board.createdBy.toString() === userId.toString()
	const isMember = await BoardMember.exists({ board: board._id, user: userId })
	if (!isOwner && !isMember) return null
	return { task, board }
}

/** Ids (as strings) of every board the person owns or is a member of. */
export const getAccessibleBoardIds = async (userId) => {
	const [ownedBoardIds, memberBoardIds] = await Promise.all([
		Board.find({ createdBy: userId }).distinct('_id'),
		BoardMember.find({ user: userId }).distinct('board'),
	])
	return [...new Set([
		...ownedBoardIds.map((id) => id.toString()),
		...memberBoardIds.map((id) => id.toString()),
	])]
}
