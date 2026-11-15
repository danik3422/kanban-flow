import mongoose from 'mongoose'

import { emitBoardEvent, revokeUserBoardAccess } from '../lib/realtime.js'
import Board from '../models/board.model.js'
import BoardActivity from '../models/boardActivity.model.js'
import BoardInvite from '../models/boardInvite.model.js'
import BoardMember from '../models/boardMember.model.js'
import BoardRule from '../models/boardRule.model.js'
import Column from '../models/column.model.js'
import Notification from '../models/notification.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import TimeEntry from '../models/timeEntry.model.js'
import { recordBoardActivity } from './boardActivity.service.js'
import { releaseUploadedBackground } from './boardBackgrounds.service.js'
import { cardImageUrls, releaseCardImages } from './cardFiles.service.js'

// Deleting a board and taking a person off one, shared by the board screens and by
// deleting an account.

/** Deletes a board with everything on it (archived lists and cards too) and its files. */
export const deleteBoardForGood = async (board, actorId) => {
	const boardId = board._id
	const memberIds = await BoardMember.find({ board: boardId }).distinct('user')
	const boardColumnIds = await Column.find({ board: boardId }).setOptions({ withArchived: true }).distinct('_id')
	const images = await cardImageUrls({ column: { $in: boardColumnIds } })
	// One transaction, so a failure never leaves orphans.
	await mongoose.connection.transaction(async (session) => {
		const columnIds = await Column.find({ board: boardId }).setOptions({ withArchived: true }).distinct('_id').session(session)
		const taskIds = await Task.find({ column: { $in: columnIds } }).setOptions({ withArchived: true }).distinct('_id').session(session)
		await TaskActivity.deleteMany({ board: boardId }, { session })
		await TimeEntry.deleteMany({ task: { $in: taskIds } }, { session })
		await Notification.deleteMany({ $or: [{ board: boardId }, { task: { $in: taskIds } }] }, { session })
		await Task.deleteMany({ column: { $in: columnIds } }, { session })
		await Column.deleteMany({ board: boardId }, { session })
		await BoardMember.deleteMany({ board: boardId }, { session })
		await BoardInvite.deleteMany({ board: boardId }, { session })
		await BoardActivity.deleteMany({ board: boardId }, { session })
		await BoardRule.deleteMany({ board: boardId }, { session })
		await Board.deleteOne({ _id: boardId }, { session })
	})
	for (const memberId of memberIds) {
		if (memberId.toString() === actorId.toString()) continue
		revokeUserBoardAccess(memberId, boardId, { reason: 'board-deleted', boardName: board.name })
	}
	releaseUploadedBackground(board.background)
	void releaseCardImages(images)
}

/**
 * Takes a person off a board they do not own: membership, their notifications from it,
 * invites they made, and their place on cards and lists (assignee, watcher).
 */
export const removePersonFromBoard = async (board, user, { action = 'left', details = 'left this board', reason = 'left-board' } = {}) => {
	const userId = user._id
	let activity
	await mongoose.connection.transaction(async (session) => {
		const columnIds = await Column.find({ board: board._id }).setOptions({ withArchived: true }).distinct('_id').session(session)
		await BoardMember.deleteMany({ board: board._id, user: userId }, { session })
		await Notification.deleteMany({ user: userId, board: board._id }, { session })
		await BoardInvite.deleteMany({ board: board._id, createdBy: userId, usedAt: null }, { session })
		await Task.updateMany({ column: { $in: columnIds } }, { $pull: { assignees: userId, watchers: userId } }, { session })
		await Column.updateMany({ board: board._id }, { $pull: { watchers: userId } }, { session })
		activity = await recordBoardActivity({
			boardId: board._id,
			userId,
			action,
			entityType: 'member',
			entityId: userId,
			entityName: user.name || user.email,
			details,
			session,
			emit: false,
		})
	})
	emitBoardEvent(board._id.toString(), 'activity:new', activity)
	revokeUserBoardAccess(userId, board._id, { reason })
}
