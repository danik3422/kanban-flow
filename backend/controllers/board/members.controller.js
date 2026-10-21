import mongoose from 'mongoose'

import { emitBoardEvent, revokeUserBoardAccess } from '../../lib/realtime.js'
import BoardInvite from '../../models/boardInvite.model.js'
import BoardMember from '../../models/boardMember.model.js'
import Column from '../../models/column.model.js'
import Notification from '../../models/notification.model.js'
import Task from '../../models/task.model.js'
import { ensureBoardAccess } from '../../services/boardAccess.service.js'
import { recordBoardActivity } from '../../services/boardActivity.service.js'

// People on a board: the member list, role changes and removal.

export const getBoardMembers = async (req, res) => {
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

		const members = await BoardMember.find({ board: boardId })
			.populate('user', 'name email avatar provider jobTitle timezone')
			.lean()

		return res.status(200).json(members)
	} catch (error) {
		console.error('Error fetching board members:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const updateBoardMemberRole = async (req, res) => {
	try {
		const board = req.board
		const isOwner = board.createdBy.toString() === req.user._id.toString()
		const requesterMembership = !isOwner
			? await BoardMember.findOne({
					board: board._id,
					user: req.user._id,
					role: 'admin',
				})
			: null
		if (!isOwner && !requesterMembership)
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can edit member roles' })
		const role = req.body.role
		if (!['owner', 'admin', 'member'].includes(role))
			return res.status(400).json({ message: 'Invalid member role' })
		const membership = await BoardMember.findOne({
			_id: req.params.memberId,
			board: board._id,
		}).populate('user', 'name email avatar provider')
		// A membership whose account was deleted has no one left to change.
		if (!membership || !membership.user)
			return res.status(404).json({ message: 'Board member not found' })
		if (membership.user._id.toString() === board.createdBy.toString())
			return res
				.status(400)
				.json({ message: 'The board owner role cannot be changed' })
		// Admins manage members, not each other: only the owner changes an admin's role.
		if (!isOwner && membership.role === 'admin')
			return res
				.status(403)
				.json({ message: 'Only the board owner can change another admin' })
		if (role === 'owner') {
			if (!isOwner) {
				return res.status(403).json({
					message: 'Only the current owner can transfer ownership',
				})
			}
			const previousOwnerId = board.createdBy
			const session = await mongoose.startSession()
			let activity
			try {
				await session.withTransaction(async () => {
					board.createdBy = membership.user._id
					await board.save({ session })
					await BoardMember.updateOne(
						{ board: board._id, user: previousOwnerId },
						{ $set: { role: 'admin' } },
						{ session },
					)
					activity = await recordBoardActivity({
						boardId: board._id,
						userId: req.user._id,
						action: 'transferred ownership',
						entityType: 'member',
						entityId: membership.user._id,
						entityName: membership.user.name || membership.user.email,
						details: 'transferred board ownership',
						session,
						emit: false,
					})
				})
			} finally {
				await session.endSession()
			}
			emitBoardEvent(board._id.toString(), 'activity:new', activity)
			emitBoardEvent(board._id.toString(), 'board:updated', board.toObject())
			return res.status(200).json({
				...membership.toObject(),
				ownershipTransferred: true,
				boardOwnerId: membership.user._id.toString(),
			})
		}
		membership.role = role
		await membership.save()
		// Invites carry the inviter's authority; a demoted member's links must stop working.
		if (role === 'member') {
			await BoardInvite.deleteMany({ board: board._id, createdBy: membership.user._id, usedAt: null })
		}
		await recordBoardActivity({
			boardId: board._id,
			userId: req.user._id,
			action: 'changed role',
			entityType: 'member',
			entityId: membership.user._id,
			entityName: membership.user.name || membership.user.email,
			details: `changed member role to ${role}`,
		})
		return res.status(200).json(membership)
	} catch (error) {
		console.error('Board member role update failed:', error)
		return res.status(500).json({ message: 'Could not update member role' })
	}
}

export const removeBoardMember = async (req, res) => {
	try {
		const board = req.board
		const ownerId = req.user._id.toString()
		if (board.createdBy.toString() !== ownerId) {
			return res.status(403).json({ message: 'Only the board owner can remove members' })
		}
		if (!mongoose.Types.ObjectId.isValid(req.params.memberId)) {
			return res.status(400).json({ message: 'Invalid member ID' })
		}

		const membership = await BoardMember.findOne({
			_id: req.params.memberId,
			board: board._id,
		}).populate('user', 'name email')
		if (!membership) {
			return res.status(404).json({ message: 'Board member not found' })
		}
		if (membership.user._id.toString() === ownerId) {
			return res.status(400).json({ message: 'The board owner cannot be removed' })
		}

		const removedUserId = membership.user._id
		const session = await mongoose.startSession()
		let activity
		try {
			await session.withTransaction(async () => {
				const columnIds = await Column.find({ board: board._id }).distinct('_id').session(session)
				await BoardMember.deleteMany({ board: board._id, user: removedUserId }, { session })
				await Notification.deleteMany({ user: removedUserId, board: board._id }, { session })
				await Task.updateMany(
					{ column: { $in: columnIds } },
					{ $pull: { assignees: removedUserId } },
					{ session },
				)
				await BoardInvite.deleteMany({
					board: board._id,
					email: membership.user.email.toLowerCase(),
					usedAt: null,
				}, { session })
				await BoardInvite.deleteMany({ board: board._id, email: '', usedAt: null }, { session })
				activity = await recordBoardActivity({
					boardId: board._id,
					userId: req.user._id,
					action: 'removed member',
					entityType: 'member',
					entityId: removedUserId,
					entityName: membership.user.name || membership.user.email,
					details: `removed ${membership.user.email} from this room`,
					session,
					emit: false,
				})
			})
		} finally {
			await session.endSession()
		}
		emitBoardEvent(board._id.toString(), 'activity:new', activity)
		revokeUserBoardAccess(removedUserId, board._id, { reason: 'removed-from-board' })

		return res.status(200).json({
			message: 'Member removed from the board',
			memberId: membership._id,
			userId: removedUserId,
		})
	} catch (error) {
		console.error('Board member removal failed:', error)
		return res.status(500).json({ message: 'Could not remove board member' })
	}
}
