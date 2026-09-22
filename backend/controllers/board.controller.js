import mongoose from 'mongoose'
import crypto from 'node:crypto'

import { env } from '../config/env.js'
import { sendBoardInviteEmail } from '../lib/mailer.js'
import {
	emitBoardEvent,
	emitUserEvent,
	revokeUserBoardAccess,
} from '../lib/realtime.js'
import Board from '../models/board.model.js'
import BoardInvite from '../models/boardInvite.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'
import User from '../models/user.model.js'
import Notification from '../models/notification.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import BoardActivity from '../models/boardActivity.model.js'
import { recordBoardActivity } from '../lib/boardActivity.js'

const recordTaskActivity = async ({ taskId, boardId, userId, type, message = '', fromColumn = '', toColumn = '', durationMinutes = 0 }) =>
	TaskActivity.create({
		task: taskId,
		board: boardId,
		user: userId,
		type,
		message,
		fromColumn,
		toColumn,
		durationMinutes,
	})

const ensureBoardAccess = async (userId, boardId) => {
	const board = await Board.findById(boardId)
	if (!board) {
		return { board: null, allowed: false }
	}

	if (board.createdBy.toString() === userId.toString()) {
		return { board, allowed: true }
	}

	const membership = await BoardMember.findOne({
		board: boardId,
		user: userId,
	})

	return { board, allowed: Boolean(membership) }
}

const ensureBoardEditAccess = async (userId, boardId) => {
	const board = await Board.findById(boardId)
	if (!board) return { board: null, allowed: false }
	if (board.createdBy.toString() === userId.toString()) return { board, allowed: true }
	const membership = await BoardMember.exists({ board: boardId, user: userId })
	return { board, allowed: Boolean(membership) }
}

const canManageBoard = async (board, userId) => {
	if (board.createdBy.toString() === userId.toString()) return true
	return Boolean(
		await BoardMember.exists({
			board: board._id,
			user: userId,
			role: 'admin',
		}),
	)
}

const notifyTaskAssignees = async ({ userIds, task, board, type = 'task_assigned', title, message }) => {
	const uniqueUserIds = [...new Set(userIds.map((userId) => userId.toString()))]
	await Promise.all(
		uniqueUserIds.map(async (userId) => {
			const notification = await Notification.create({
				user: userId,
				type,
				title: title || 'You were assigned a task',
				message: message || `You were assigned “${task.title}” in ${board.name}.`,
				board: board._id,
				task: task._id,
			})
			emitUserEvent(userId, 'notification:new', notification.toObject())
		}),
	)
}

const validateBoardAssignees = async (board, assignees) => {
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

export const createBoard = async (req, res) => {
	try {
		const { name, visibility = 'private' } = req.body
		if (!name) {
			return res.status(400).json({ message: 'Board name is required' })
		}
		if (!['private', 'workspace', 'public'].includes(visibility)) {
			return res.status(400).json({ message: 'Invalid board visibility' })
		}

		const newBoard = new Board({
			name,
			createdBy: req.user._id,
			visibility,
		})

		await newBoard.save()

		await BoardMember.create({
			board: newBoard._id,
			user: req.user._id,
			role: 'admin',
		})
		await recordBoardActivity({
			boardId: newBoard._id,
			userId: req.user._id,
			action: 'created',
			entityType: 'board',
			entityId: newBoard._id,
			entityName: newBoard.name,
			details: 'created this board',
		})

		res.status(201).json(newBoard)
	} catch (error) {
		console.error('Error creating board:', error)
		res.status(500).json({ message: 'Internal server error' })
	}
}

export const getBoardById = async (req, res) => {
	try {
		const boardId = req.params.id
		if (!mongoose.Types.ObjectId.isValid(boardId)) {
			return res.status(400).json({ message: 'Invalid board ID' })
		}

		const { board, allowed } = await ensureBoardAccess(req.user._id, boardId)
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

export const createPublicBoardLink = async (req, res) => {
	try {
		const board = await Board.findById(req.board._id).select('+publicTokenHash')
		if (board.visibility !== 'public') {
			return res.status(400).json({ message: 'Only public rooms can have a public link' })
		}
		if (!(await canManageBoard(board, req.user._id))) {
			return res.status(403).json({ message: 'Only the board owner or an admin can create a public link' })
		}
		const publicTokenVersion = Number(board.publicTokenVersion || 0)
		const existingToken = crypto
			.createHmac('sha256', env.jwtSecret)
			.update(`${board._id.toString()}:${publicTokenVersion}`)
			.digest('hex')
		const existingTokenHash = crypto.createHash('sha256').update(existingToken).digest('hex')
		if (board.publicTokenHash !== existingTokenHash) {
			board.publicTokenVersion = publicTokenVersion + 1
			const rawToken = crypto
				.createHmac('sha256', env.jwtSecret)
				.update(`${board._id.toString()}:${board.publicTokenVersion}`)
				.digest('hex')
			board.publicTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
			const updatedBoard = await Board.findOneAndUpdate(
				{ _id: board._id, visibility: 'public', publicTokenVersion },
				{
					$set: { publicTokenHash: board.publicTokenHash },
					$inc: { publicTokenVersion: 1 },
				},
				{ returnDocument: 'after' },
			)
			if (!updatedBoard) {
				return res.status(409).json({ message: 'Public link changed. Please try again.' })
			}
			return res.status(200).json({ publicUrl: `${env.frontendUrl}/public/${rawToken}` })
		}
		return res.status(200).json({ publicUrl: `${env.frontendUrl}/public/${existingToken}` })
	} catch (error) {
		console.error('Public board link creation failed:', error)
		return res.status(500).json({ message: 'Could not create public board link' })
	}
}

export const getPublicBoardLink = async (req, res) => {
	try {
		const board = await Board.findById(req.board._id).select('+publicTokenHash')
		if (board.visibility !== 'public') return res.status(404).json({ message: 'Public link is unavailable' })
		if (!(await canManageBoard(board, req.user._id))) {
			return res.status(403).json({ message: 'Only the board owner or an admin can view the public link' })
		}
		const rawToken = crypto
			.createHmac('sha256', env.jwtSecret)
			.update(`${board._id.toString()}:${Number(board.publicTokenVersion || 0)}`)
			.digest('hex')
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		if (!board.publicTokenHash || board.publicTokenHash !== tokenHash) {
			return res.status(404).json({ message: 'Public link has not been created' })
		}
		return res.status(200).json({ publicUrl: `${env.frontendUrl}/public/${rawToken}` })
	} catch (error) {
		console.error('Public board link lookup failed:', error)
		return res.status(500).json({ message: 'Could not load public view link' })
	}
}

export const revokePublicBoardLink = async (req, res) => {
	try {
		const board = await Board.findById(req.board._id).select('+publicTokenHash')
		if (!(await canManageBoard(board, req.user._id))) {
			return res.status(403).json({ message: 'Only the board owner or an admin can revoke the public link' })
		}
		await Board.updateOne(
			{ _id: board._id },
			{
				$set: { publicTokenHash: '' },
				$inc: { publicTokenVersion: 1 },
			},
		)
		return res.status(204).send()
	} catch (error) {
		console.error('Public board link revoke failed:', error)
		return res.status(500).json({ message: 'Could not revoke public view link' })
	}
}

export const getPublicBoard = async (req, res) => {
	try {
		const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex')
		const board = await Board.findOne({ visibility: 'public', publicTokenHash: tokenHash }).select('name visibility createdAt').lean()
		if (!board) return res.status(404).json({ message: 'Public room link is invalid or expired' })
		const columns = await Column.find({ board: board._id })
			.select('title position sortBy pinned createdAt')
			.sort({ position: 1, createdAt: 1 })
			.lean()
		const tasks = await Task.find({ column: { $in: columns.map((column) => column._id) } })
			.select('title description dueDate column position labels checklist priority trackedSeconds')
			.sort({ position: 1, createdAt: 1 })
			.lean()
		return res.status(200).json({ board, columns: columns.map((column) => ({
			...column,
			tasks: tasks.filter((task) => task.column.toString() === column._id.toString()),
		})) })
	} catch (error) {
		console.error('Public board fetch failed:', error)
		return res.status(500).json({ message: 'Could not load public room' })
	}
}

export const getBoardActivities = async (req, res) => {
	try {
		const { board, allowed } = await ensureBoardAccess(req.user._id, req.board._id)
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

export const getBoardMembers = async (req, res) => {
	try {
		const boardId = req.params.id
		if (!mongoose.Types.ObjectId.isValid(boardId)) {
			return res.status(400).json({ message: 'Invalid board ID' })
		}

		const { board, allowed } = await ensureBoardAccess(req.user._id, boardId)
		if (!board) {
			return res.status(404).json({ message: 'Board not found' })
		}
		if (!allowed) {
			return res.status(403).json({ message: 'Access denied' })
		}

		const members = await BoardMember.find({ board: boardId })
			.populate('user', 'name email avatar provider')
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
		if (!membership)
			return res.status(404).json({ message: 'Board member not found' })
		if (membership.user._id.toString() === board.createdBy.toString())
			return res
				.status(400)
				.json({ message: 'The board owner role cannot be changed' })
		if (role === 'owner') {
			if (!isOwner) {
				return res.status(403).json({
					message: 'Only the current owner can transfer ownership',
				})
			}
			const previousOwnerId = board.createdBy
			board.createdBy = membership.user._id
			await board.save()
			await BoardMember.updateOne(
				{ board: board._id, user: previousOwnerId },
				{ $set: { role: 'admin' } },
			)
			await recordBoardActivity({
				boardId: board._id,
				userId: req.user._id,
				action: 'transferred ownership',
				entityType: 'member',
				entityId: membership.user._id,
				entityName: membership.user.name || membership.user.email,
				details: 'transferred board ownership',
			})
			return res.status(200).json({
				...membership.toObject(),
				ownershipTransferred: true,
				boardOwnerId: membership.user._id.toString(),
			})
		}
		membership.role = role
		await membership.save()
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

export const getBoardInvites = async (req, res) => {
	try {
		const board = req.board
		if (!(await canManageBoard(board, req.user._id)))
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can view invites' })
		const invites = await BoardInvite.find({
			board: board._id,
			$or: [
				{ email: { $ne: '' } },
				{ email: '', visibilityVersion: Number(board.visibilityVersion || 0) },
			],
		})
			.sort({ createdAt: -1 })
			.select('email role expiresAt usedAt acceptedBy createdAt createdBy')
			.populate('acceptedBy', 'name email')
			.populate('createdBy', 'name email')
			.lean()
		return res
			.status(200)
			.json(
				invites.map((invite) => ({
					...invite,
					status: invite.usedAt
						? 'accepted'
						: invite.expiresAt <= new Date()
							? 'expired'
							: 'pending',
				})),
			)
	} catch (error) {
		console.error('Board invites fetch failed:', error)
		return res.status(500).json({ message: 'Could not load board invites' })
	}
}

export const getBoardInviteLink = async (req, res) => {
	try {
		const board = req.board
		if (!(await canManageBoard(board, req.user._id))) {
			return res.status(403).json({ message: 'Only the board owner or an admin can view the invite link' })
		}
		const invite = await BoardInvite.findOne({
			board: board._id,
			createdBy: req.user._id,
			email: '',
			usedAt: null,
			expiresAt: { $gt: new Date() },
			visibilityVersion: Number(board.visibilityVersion || 0),
		}).select('role createdBy createdAt expiresAt tokenVersion tokenHash')
		if (!invite) return res.status(404).json({ message: 'Invite link has not been created' })
		const rawToken = crypto
			.createHmac('sha256', env.jwtSecret)
			.update(`invite:${board._id.toString()}:${req.user._id.toString()}:${Number(invite.tokenVersion || 0)}`)
			.digest('hex')
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		if (invite.tokenHash !== tokenHash) return res.status(404).json({ message: 'Invite link has been revoked' })
		return res.status(200).json({
			inviteId: invite._id,
			inviteUrl: `${env.frontendUrl}/invite/${rawToken}`,
			role: invite.role,
			createdBy: invite.createdBy,
			createdAt: invite.createdAt,
			expiresAt: invite.expiresAt,
		})
	} catch (error) {
		console.error('Board invite link lookup failed:', error)
		return res.status(500).json({ message: 'Could not load board invite link' })
	}
}

export const revokeBoardInvite = async (req, res) => {
	try {
		const board = req.board
		if (!(await canManageBoard(board, req.user._id)))
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can revoke invites' })
		const invite = await BoardInvite.findOne({
			_id: req.params.inviteId,
			board: board._id,
			usedAt: null,
		})
		if (!invite)
			return res.status(404).json({ message: 'Pending invite not found' })
		if (invite.createdBy.toString() !== req.user._id.toString())
			return res.status(403).json({ message: 'Only the creator can revoke this invite' })
		await invite.deleteOne()
		await recordBoardActivity({
			boardId: board._id,
			userId: req.user._id,
			action: 'revoked invite',
			entityType: 'invite',
			entityId: invite._id,
			entityName: invite.email || 'Anyone with the link',
			details: 'revoked a board invite',
		})
		return res.status(200).json({ message: 'Invite revoked' })
	} catch (error) {
		console.error('Board invite revoke failed:', error)
		return res.status(500).json({ message: 'Could not revoke board invite' })
	}
}

export const copyBoardInviteLink = async (req, res) => {
	try {
		const board = req.board
		if (!(await canManageBoard(board, req.user._id)))
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can copy invites' })

		const invite = await BoardInvite.findOne({
			_id: req.params.inviteId,
			board: board._id,
			usedAt: null,
			expiresAt: { $gt: new Date() },
		})

		if (!invite) {
			return res.status(404).json({ message: 'Pending invite not found' })
		}
		if (!invite.email && invite.createdBy.toString() !== req.user._id.toString())
			return res.status(403).json({ message: 'Only the creator can copy this invite link' })

		let rawToken = crypto.randomBytes(32).toString('hex')
		if (!invite.email) {
			invite.tokenVersion = Number(invite.tokenVersion || 0) + 1
			rawToken = crypto
				.createHmac('sha256', env.jwtSecret)
				.update(`invite:${board._id.toString()}:${req.user._id.toString()}:${invite.tokenVersion}`)
				.digest('hex')
		}
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		invite.tokenHash = tokenHash
		invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		await invite.save()
		await recordBoardActivity({
			boardId: board._id,
			userId: req.user._id,
			action: 'copied invite link',
			entityType: 'invite',
			entityId: invite._id,
			entityName: invite.email || 'Anyone with the link',
			details: 'copied a board invite link',
		})

		const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${rawToken}`
		return res.status(200).json({ inviteUrl, expiresInDays: 7 })
	} catch (error) {
		console.error('Board invite copy failed:', error)
		return res.status(500).json({ message: 'Could not copy board invite link' })
	}
}

export const getBoardColumns = async (req, res) => {
	try {
		const boardId = req.params.id
		if (!mongoose.Types.ObjectId.isValid(boardId)) {
			return res.status(400).json({ message: 'Invalid board ID' })
		}

		const { board, allowed } = await ensureBoardAccess(req.user._id, boardId)
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

export const updateBoard = async (req, res) => {
	try {
		const board = req.board
		const userId = req.user._id
		const { name, visibility } = req.body

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
		board.name = trimmedName
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

		// Get all columns linked to this board
		const columns = await Column.find({ board: boardId })
		const columnIds = columns.map((col) => col._id)
		const taskIds = await Task.find({ column: { $in: columnIds } }).distinct('_id')

		// Delete all board-scoped records before deleting their referenced entities.
		await TaskActivity.deleteMany({ board: boardId })
		await Notification.deleteMany({
			$or: [{ board: boardId }, { task: { $in: taskIds } }],
		})
		await Task.deleteMany({ column: { $in: columnIds } })

		// Delete columns, board members, and board
		await Column.deleteMany({ board: boardId })
		await BoardMember.deleteMany({ board: boardId })
		await BoardInvite.deleteMany({ board: boardId })
		await BoardActivity.deleteMany({ board: boardId })
		await Board.deleteOne({ _id: boardId })

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
		await BoardMember.deleteMany({ board: board._id, user: userId })
		await recordBoardActivity({
			boardId: board._id,
			userId,
			action: 'left',
			entityType: 'member',
			entityId: userId,
			entityName: req.user.name || req.user.email,
			details: 'left this board',
		})
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

		const boardIds = membership.map((member) => member.board)

			const boards = await Board.find({ _id: { $in: boardIds } }).lean()

		if (!boards || boards.length === 0) {
			return res.status(404).json({ message: 'No boards found for this user.' })
		}

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

export const getMyTasks = async (req, res) => {
	try {
		const search = (req.query.search || req.query.q || '').trim().toLowerCase()
		const priority = (req.query.priority || 'all').toString()
		const board = (req.query.board || 'all').toString()
		const [ownedBoardIds, memberships] = await Promise.all([
			Board.find({ createdBy: req.user._id }).distinct('_id'),
			BoardMember.find({ user: req.user._id }).select('board').lean(),
		])
		const accessibleBoardIds = [
			...new Set([
				...ownedBoardIds.map((boardId) => boardId.toString()),
				...memberships.map((membership) => membership.board.toString()),
			]),
		]
		const accessibleColumnIds = await Column.find({ board: { $in: accessibleBoardIds } }).distinct('_id')

		let tasks = await Task.find({
			assignees: req.user._id,
			column: { $in: accessibleColumnIds },
		})
			.populate({
				path: 'column',
				select: 'title board',
				populate: { path: 'board', select: 'name' },
			})
			.populate('assignees', 'name email avatar')
			.sort({ dueDate: 1, updatedAt: -1 })
			.lean()

		if (priority !== 'all') {
			tasks = tasks.filter((task) => (task.priority || 'none') === priority)
		}

		if (board !== 'all') {
			tasks = tasks.filter((task) => {
				const boardId = task.column?.board?._id?.toString?.() || task.column?.board?.toString?.()
				return boardId === board
			})
		}

		if (search) {
			tasks = tasks.filter((task) => {
				const title = (task.title || '').toLowerCase()
				const description = (task.description || '').toLowerCase()
				const boardName = (task.column?.board?.name || '').toLowerCase()
				const columnName = (task.column?.title || '').toLowerCase()
				const labels = (task.labels || []).map((label) => String(label).toLowerCase())
				return [title, description, boardName, columnName, ...labels].some((value) => value.includes(search))
			})
		}

		return res.status(200).json(tasks)
	} catch (error) {
		console.error('My tasks fetch failed:', error)
		return res.status(500).json({ message: 'Could not load your tasks' })
	}
}

export const addMemberToBoard = async (req, res) => {
	try {
		const boardId = req.params.id
		const { email, role = 'member' } = req.body
		const requesterId = req.user._id

		const board = await Board.findById(boardId)
		if (!board) {
			return res.status(404).json({ message: 'Board not found.' })
		}

		if (!(await canManageBoard(board, requesterId))) {
			return res.status(403).json({
				message: 'Access denied: Only the board owner or an admin can add members.',
			})
		}

		const userToAdd = await User.findOne({ email })

		if (!userToAdd) {
			return res
				.status(404)
				.json({ message: 'User with this email not found.' })
		}
		if (userToAdd._id.toString() === requesterId.toString()) {
			return res
				.status(400)
				.json({ message: 'You cannot add yourself to the board' })
		}

		const existingMember = await BoardMember.findOne({
			board: boardId,
			user: userToAdd._id,
		})

		if (existingMember) {
			return res
				.status(400)
				.json({ message: 'User is already a member of this board.' })
		}

		const newMember = new BoardMember({
			board: boardId,
			user: userToAdd._id,
			role,
		})

		await newMember.save()
		await recordBoardActivity({
			boardId: board._id,
			userId: requesterId,
			action: 'added member',
			entityType: 'member',
			entityId: userToAdd._id,
			entityName: userToAdd.name || userToAdd.email,
			details: `added ${userToAdd.email} to this board`,
		})
		let emailSent = true
		try {
			await sendBoardInviteEmail({
				email: userToAdd.email,
				boardName: board.name,
				boardUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/workspaces/${board._id}`,
			})
		} catch (mailError) {
			emailSent = false
			console.warn('Board invite email was not sent:', mailError.message)
		}

		return res
			.status(201)
			.json({
				message: emailSent
					? 'User added and invite email sent'
					: 'User added, but invite email could not be sent',
				member: newMember,
				emailSent,
			})
	} catch (error) {
		console.error('Error adding member to board:', error)
		res.status(500).json({ message: 'Internal server error' })
	}
}

export const createBoardInvite = async (req, res) => {
	try {
		const board = await Board.findById(req.board._id)
		if (!(await canManageBoard(board, req.user._id)))
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can create invites' })
		const email = (req.body.email || '').trim().toLowerCase()
		const role = req.body.role || 'member'
		if (!['admin', 'member'].includes(role)) {
			return res.status(400).json({ message: 'Invalid invite role' })
		}
		if (email && email === req.user.email.toLowerCase())
			return res.status(400).json({ message: 'You cannot invite yourself' })
		if (email) {
			const invitedUser = await User.findOne({ email }).select('_id')
			if (invitedUser) {
				const existingMember = await BoardMember.exists({
					board: board._id,
					user: invitedUser._id,
				})
				if (existingMember)
					return res
						.status(400)
						.json({ message: 'This user is already a member of the board' })
			}
			const activeInvite = await BoardInvite.exists({
				board: board._id,
				email,
				usedAt: null,
				expiresAt: { $gt: new Date() },
			})
			if (activeInvite)
				return res
					.status(400)
					.json({ message: 'An active invite already exists for this email' })
		} else {
			const existingNextVersion = Number(board.inviteTokenVersion || 0)
			const activeLinkInvite = await BoardInvite.findOne({
				board: board._id,
				createdBy: req.user._id,
				email: '',
				usedAt: null,
				expiresAt: { $gt: new Date() },
				visibilityVersion: Number(board.visibilityVersion || 0),
			})
			if (activeLinkInvite) {
				const existingToken = crypto
					.createHmac('sha256', env.jwtSecret)
					.update(`invite:${board._id.toString()}:${req.user._id.toString()}:${Number(activeLinkInvite.tokenVersion || 0)}`)
					.digest('hex')
				const existingTokenHash = crypto.createHash('sha256').update(existingToken).digest('hex')
				if (activeLinkInvite.tokenHash === existingTokenHash) {
					return res.status(201).json({
						inviteUrl: `${env.frontendUrl}/invite/${existingToken}`,
						emailSent: false,
						expiresInDays: 7,
					})
				}
				await activeLinkInvite.deleteOne()
			}
			const nextTokenVersion = existingNextVersion + 1
			const updatedBoard = await Board.findOneAndUpdate(
				{ _id: board._id },
				{ $set: { inviteTokenVersion: nextTokenVersion } },
				{ new: true },
			)
			if (!updatedBoard) {
				return res.status(409).json({ message: 'Invite link changed. Please try again.' })
			}
			board.inviteTokenVersion = nextTokenVersion
		}
		let rawToken = crypto.randomBytes(32).toString('hex')
		let tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		let tokenVersion = 0
		if (!email) {
			tokenVersion = Number(board.inviteTokenVersion || 0)
			rawToken = crypto
				.createHmac('sha256', env.jwtSecret)
				.update(`invite:${board._id.toString()}:${req.user._id.toString()}:${tokenVersion}`)
				.digest('hex')
			tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		}
		const invite = await BoardInvite.create({
			board: board._id,
			email,
			role,
			tokenHash,
			tokenVersion,
			createdBy: req.user._id,
			visibilityVersion: Number(board.visibilityVersion || 0),
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		})
		await recordBoardActivity({
			boardId: board._id,
			userId: req.user._id,
			action: 'created invite',
			entityType: 'invite',
			entityId: invite._id,
			entityName: email || 'Anyone with the link',
			details: email ? `invited ${email}` : 'created a share link invite',
		})
		const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${rawToken}`
		let emailSent = false
		if (email) {
			try {
				await sendBoardInviteEmail({
					email,
					boardName: board.name,
					boardUrl: inviteUrl,
				})
				emailSent = true
			} catch (error) {
				console.warn('Invite email was not sent:', error.message)
			}
		}
		return res.status(201).json({ inviteUrl, emailSent, expiresInDays: 7 })
	} catch (error) {
		console.error('Board invite creation failed:', error)
		return res.status(500).json({ message: 'Could not create board invite' })
	}
}

export const getBoardInviteDetails = async (req, res) => {
	try {
		const tokenHash = crypto
			.createHash('sha256')
			.update(req.params.token)
			.digest('hex')

		const invite = await BoardInvite.findOne({
			tokenHash,
			usedAt: null,
			expiresAt: { $gt: new Date() },
		}).populate('board', 'name visibilityVersion').populate('createdBy', 'name email')

		if (!invite || !invite.board) {
			return res.status(400).json({ message: 'Invite expired or invalid' })
		}
		if (!invite.email && Number(invite.visibilityVersion || 0) !== Number(invite.board.visibilityVersion || 0)) {
			return res.status(400).json({ message: 'Invite expired or invalid' })
		}

		return res.status(200).json({
			boardId: invite.board._id.toString(),
			boardName: invite.board.name,
			invitedBy: invite.createdBy,
			role: invite.role,
		})
	} catch (error) {
		console.error('Board invite details lookup failed:', error)
		return res.status(500).json({ message: 'Could not load invite details' })
	}
}

export const acceptBoardInvite = async (req, res) => {
	try {
		const tokenHash = crypto
			.createHash('sha256')
			.update(req.params.token)
			.digest('hex')
		const userEmail = req.user.email.toLowerCase()
		const invite = await BoardInvite.findOne({
			tokenHash,
			usedAt: null,
			expiresAt: { $gt: new Date() },
			$or: [{ email: '' }, { email: userEmail }],
		})

		if (!invite)
			return res.status(400).json({ message: 'Invite expired or invalid' })

		const board = await Board.findById(invite.board).select('createdBy name visibilityVersion')
		if (!board) {
			return res.status(404).json({ message: 'Board not found.' })
		}
		if (!invite.email && Number(invite.visibilityVersion || 0) !== Number(board.visibilityVersion || 0)) {
			return res.status(400).json({ message: 'Invite expired or invalid' })
		}

		if (board.createdBy.toString() === req.user._id.toString()) {
			return res.status(400).json({
				message: 'You cannot invite yourself to this board.',
			})
		}

		const alreadyMember = await BoardMember.exists({
			board: invite.board,
			user: req.user._id,
		})
		if (alreadyMember) {
			return res.status(400).json({
				message: 'You are already a member of this board.',
			})
		}

		const claimFilter = {
			_id: invite._id,
			usedAt: null,
			expiresAt: { $gt: new Date() },
		}
		if (!invite.email) claimFilter.visibilityVersion = Number(board.visibilityVersion || 0)
		const claimedInvite = await BoardInvite.findOneAndUpdate(
					claimFilter,
					{ $set: { usedAt: new Date(), acceptedBy: req.user._id } },
					{ returnDocument: 'after' },
				)
				if (!claimedInvite) {
					return res.status(400).json({ message: 'Invite expired or invalid' })
				}
		await BoardMember.updateOne(
			{ board: invite.board, user: req.user._id },
			{ $setOnInsert: { role: invite.role || 'member' } },
			{ upsert: true },
		)
		await recordBoardActivity({
			boardId: invite.board,
			userId: req.user._id,
			action: 'joined',
			entityType: 'member',
			entityId: req.user._id,
			entityName: req.user.name || req.user.email,
			details: `joined this board from an invite created by ${invite.createdBy?.name || invite.createdBy?.email || 'a board admin'}`,
		})
		return res
			.status(200)
			.json({ boardId: invite.board.toString(), message: 'Invite accepted' })
	} catch (error) {
		console.error('Board invite acceptance failed:', error)
		return res.status(500).json({ message: 'Could not accept board invite' })
	}
}

export const createColumn = async (req, res) => {
	try {
		const board = req.board
		const userId = req.user._id
		const { title, position = 0 } = req.body

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

		const newColumn = new Column({
			title: title.trim(),
			board: board._id,
			position,
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
		const { title, pinned } = req.body

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
		const { allowed } = await ensureBoardEditAccess(userId, board._id)
		if (!allowed) {
			return res.status(403).json({ message: 'Access denied' })
		}

		// Validate sortBy value
		const validSortValues = [
			'date-newest',
			'date-oldest',
			'name-alpha',
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
		const { allowed } = await ensureBoardEditAccess(req.user._id, board._id)
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
			if (tasks.length !== taskIds.length || !tasks.every((task) => taskIds.includes(task._id.toString()))) {
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
			position = 0,
			priority = 'none',
		} = req.body

		const column = await Column.findById(columnId)
		if (!column) {
			return res.status(404).json({ message: 'Column not found' })
		}

		const { board, allowed } = await ensureBoardEditAccess(
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

		const newTask = new Task({
			title: title.trim(),
			description: description || '',
			column: column._id,
			position,
			assignees,
			labels,
			checklist,
			priority: ['none', 'low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'none',
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
		})
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
		const { board, allowed } = await ensureBoardEditAccess(req.user._id, boardId)
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
		if (title !== undefined) task.title = title.trim()
		if (description !== undefined) task.description = description
		if (dueDate !== undefined) task.dueDate = dueDate || null
		if (assignees !== undefined) task.assignees = assignees
		if (labels !== undefined) task.labels = labels
		if (checklist !== undefined) task.checklist = checklist
		if (position !== undefined) task.position = position
		if (priority !== undefined) {
			task.priority = ['none', 'low', 'medium', 'high', 'urgent'].includes(priority)
				? priority
				: 'none'
		}

		if (position !== undefined) {
			const nextPosition = Math.max(0, position)
			const movedWithinColumn =
				originalColumnId.toString() === targetColumn._id.toString()
			if (movedWithinColumn && nextPosition < originalPosition) {
				await Task.updateMany(
					{
						column: originalColumnId,
						_id: { $ne: task._id },
						position: { $gte: nextPosition, $lt: originalPosition },
					},
					{ $inc: { position: 1 } },
				)
			} else if (movedWithinColumn && nextPosition > originalPosition) {
				await Task.updateMany(
					{
						column: originalColumnId,
						_id: { $ne: task._id },
						position: { $gt: originalPosition, $lte: nextPosition },
					},
					{ $inc: { position: -1 } },
				)
			} else if (!movedWithinColumn) {
				await Task.updateMany(
					{
						column: originalColumnId,
						_id: { $ne: task._id },
						position: { $gt: originalPosition },
					},
					{ $inc: { position: -1 } },
				)
				await Task.updateMany(
					{ column: targetColumn._id, position: { $gte: nextPosition } },
					{ $inc: { position: 1 } },
				)
			}
			task.position = nextPosition
		}
		await task.save()
		const updatedTask = await Task.findById(task._id)
			.populate('assignees', 'name email avatar')
			.lean()
		if (position !== undefined) {
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
		const moved = originalColumnId.toString() !== targetColumn._id.toString()
		await recordBoardActivity({
			boardId,
			userId: req.user._id,
			action: moved ? 'moved' : 'updated',
			entityType: 'task',
			entityId: task._id,
			entityName: updatedTask.title,
			details: moved
				? `moved ${updatedTask.title} from ${originalColumn?.title || 'previous column'} to ${targetColumn.title || 'new column'}`
				: `updated ${updatedTask.title}`,
		})
		await recordTaskActivity({
			taskId: task._id,
			boardId,
			userId: req.user._id,
			type: moved ? 'moved' : 'updated',
			message: moved
				? `moved this card from ${originalColumn?.title || 'previous column'} to ${targetColumn.title || 'new column'}`
				: 'updated this card',
			fromColumn: originalColumn?.title || '',
			toColumn: targetColumn.title || '',
		})
		const newlyAssignedIds = (assignees === undefined ? [] : assignees)
			.map((assignee) => assignee.toString())
			.filter((assigneeId) => !originalAssigneeIds.includes(assigneeId))
		if (newlyAssignedIds.length) {
			await notifyTaskAssignees({
				userIds: newlyAssignedIds,
				task: updatedTask,
				board,
			})
		}
		if (moved && Array.isArray(assignees ?? task.assignees)) {
			const nextAssigneeIds = [...new Set((assignees ?? task.assignees).map((assignee) => assignee.toString()))]
			const notificationTargets = nextAssigneeIds.filter((assigneeId) => assigneeId !== req.user._id.toString())
			if (notificationTargets.length) {
				await notifyTaskAssignees({
					userIds: notificationTargets,
					task: updatedTask,
					board,
					type: 'task_moved',
					title: 'Task moved',
					message: `“${updatedTask.title}” moved from ${originalColumn?.title || 'previous column'} to ${targetColumn.title || 'new column'}.`,
				})
			}
		}
		emitBoardEvent(boardId, 'task:updated', updatedTask)
		return res.status(200).json(updatedTask)
	} catch (error) {
		console.error('Error updating task:', error)
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
				message: 'Access denied: Only board admins can delete columns.',
			})
		}
		await recordBoardActivity({
			boardId: board._id,
			userId,
			action: 'deleted',
			entityType: 'column',
			entityId: column._id,
			entityName: column.title,
			details: `deleted the ${column.title} column and its tasks`,
		})

		// Delete all tasks in this column
		const taskIds = await Task.find({ column: columnId }).distinct('_id')
		await Task.deleteMany({ column: columnId })
		await TaskActivity.deleteMany({ task: { $in: taskIds } })
		await Notification.deleteMany({ task: { $in: taskIds } })

		// Delete the column
		await Column.deleteOne({ _id: columnId })

		// Adjust positions of remaining columns
		await Column.updateMany(
			{ board: column.board, position: { $gt: column.position } },
			{ $inc: { position: -1 } },
		)

		emitBoardEvent(column.board.toString(), 'column:deleted', { columnId })

		return res.status(200).json({ message: 'Column deleted successfully' })
	} catch (error) {
		console.error('Error deleting column:', error)
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

		const task = await Task.findById(taskId).populate('column', 'board title')
		if (!task) {
			return res.status(404).json({ message: 'Task not found' })
		}

		const { board, allowed } = await ensureBoardEditAccess(userId, task.column.board)
		if (!board || !allowed) {
			return res.status(403).json({ message: 'Access denied' })
		}

		const columnId = task.column._id
		const position = task.position
		const columnTitle = task.column.title
		await recordBoardActivity({
			boardId: board._id,
			userId,
			action: 'deleted',
			entityType: 'task',
			entityId: task._id,
			entityName: task.title,
			details: `deleted ${task.title} from ${columnTitle}`,
		})

		// Delete all activities related to this task
		await TaskActivity.deleteMany({ task: taskId })

		// Delete the task
		await Task.deleteOne({ _id: taskId })

		// Adjust positions of remaining tasks in the same column
		await Task.updateMany(
			{ column: columnId, position: { $gt: position } },
			{ $inc: { position: -1 } },
		)

		await recordTaskActivity({
			taskId,
			boardId: board._id,
			userId,
			type: 'deleted',
			message: `removed this card from ${columnTitle}`,
		})

		emitBoardEvent(board._id.toString(), 'task:deleted', { taskId })

		return res.status(200).json({ message: 'Task deleted successfully' })
	} catch (error) {
		console.error('Error deleting task:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}
