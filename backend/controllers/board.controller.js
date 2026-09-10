import mongoose from 'mongoose'
import crypto from 'node:crypto'

import { sendBoardInviteEmail } from '../lib/mailer.js'
import { emitBoardEvent, emitUserEvent } from '../lib/realtime.js'
import Board from '../models/board.model.js'
import BoardInvite from '../models/boardInvite.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'
import User from '../models/user.model.js'
import Notification from '../models/notification.model.js'
import TaskActivity from '../models/taskActivity.model.js'

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

	return {
		board,
		allowed: Boolean(membership),
	}
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

const notifyTaskAssignees = async ({ userIds, task, board }) => {
	const uniqueUserIds = [...new Set(userIds.map((userId) => userId.toString()))]
	await Promise.all(
		uniqueUserIds.map(async (userId) => {
			const notification = await Notification.create({
				user: userId,
				type: 'task_assigned',
				title: 'You were assigned a task',
				message: `You were assigned “${task.title}” in ${board.name}.`,
				board: board._id,
				task: task._id,
			})
			emitUserEvent(userId, 'notification:new', notification.toObject())
		}),
	)
}

export const createBoard = async (req, res) => {
	try {
		const { name } = req.body
		if (!name) {
			return res.status(400).json({ message: 'Board name is required' })
		}

		const newBoard = new Board({
			name,
			createdBy: req.user._id,
		})

		await newBoard.save()

		await BoardMember.create({
			board: newBoard._id,
			user: req.user._id,
			role: 'admin',
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
			return res.status(200).json({
				...membership.toObject(),
				ownershipTransferred: true,
				boardOwnerId: membership.user._id.toString(),
			})
		}
		membership.role = role
		await membership.save()
		return res.status(200).json(membership)
	} catch (error) {
		console.error('Board member role update failed:', error)
		return res.status(500).json({ message: 'Could not update member role' })
	}
}

export const getBoardInvites = async (req, res) => {
	try {
		const board = req.board
		if (!(await canManageBoard(board, req.user._id)))
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can view invites' })
		const invites = await BoardInvite.find({ board: board._id })
			.sort({ createdAt: -1 })
			.select('email expiresAt usedAt createdAt')
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
		await invite.deleteOne()
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

		const rawToken = crypto.randomBytes(32).toString('hex')
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		invite.tokenHash = tokenHash
		invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		await invite.save()

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
		const { name } = req.body

		if (!name || !name.trim()) {
			return res.status(400).json({ message: 'Board name is required' })
		}

		const trimmedName = name.trim()
		if (trimmedName.length > 100) {
			return res.status(400).json({ message: 'Board name is too long' })
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

		board.name = trimmedName
		await board.save()

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

		// Delete all tasks in these columns
		await Task.deleteMany({ column: { $in: columnIds } })

		// Delete columns, board members, and board
		await Column.deleteMany({ board: boardId })
		await BoardMember.deleteMany({ board: boardId })
		await BoardInvite.deleteMany({ board: boardId })
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

		const membership = await BoardMember.findOneAndDelete({
			board: board._id,
			user: userId,
		})

		if (!membership) {
			return res.status(404).json({ message: 'You are not a member of this board.' })
		}

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
		const tasks = await Task.find({ assignees: req.user._id })
			.populate({
				path: 'column',
				select: 'title board',
				populate: { path: 'board', select: 'name' },
			})
			.populate('assignees', 'name email avatar')
			.sort({ dueDate: 1, updatedAt: -1 })
			.lean()

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
		const board = req.board
		if (!(await canManageBoard(board, req.user._id)))
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can create invites' })
		const email = (req.body.email || '').trim().toLowerCase()
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
		}
		const rawToken = crypto.randomBytes(32).toString('hex')
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		await BoardInvite.create({
			board: board._id,
			email,
			tokenHash,
			createdBy: req.user._id,
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
		}).populate('board', 'name')

		if (!invite || !invite.board) {
			return res.status(400).json({ message: 'Invite expired or invalid' })
		}

		return res.status(200).json({
			boardId: invite.board._id.toString(),
			boardName: invite.board.name,
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

		const board = await Board.findById(invite.board).select('createdBy name')
		if (!board) {
			return res.status(404).json({ message: 'Board not found.' })
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

		invite.usedAt = new Date()
		await invite.save()
		await BoardMember.updateOne(
			{ board: invite.board, user: req.user._id },
			{ $setOnInsert: { role: 'member' } },
			{ upsert: true },
		)
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

		if (typeof title !== 'undefined') {
			if (!title || title.trim() === '') {
				return res.status(400).json({ message: 'Column title is required' })
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

		emitBoardEvent(column.board.toString(), 'column:updated', columnData)

		return res.status(200).json(columnData)
	} catch (error) {
		console.error('Error updating column:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const reorderColumn = async (req, res) => {
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

		const columnCount = await Column.countDocuments({ board: board._id })
		const nextPosition = Math.min(requestedPosition, Math.max(0, columnCount - 1))
		const originalPosition = column.position
		if (nextPosition < originalPosition) {
			await Column.updateMany(
				{ board: board._id, _id: { $ne: column._id }, position: { $gte: nextPosition, $lt: originalPosition } },
				{ $inc: { position: 1 } },
			)
		} else if (nextPosition > originalPosition) {
			await Column.updateMany(
				{ board: board._id, _id: { $ne: column._id }, position: { $gt: originalPosition, $lte: nextPosition } },
				{ $inc: { position: -1 } },
			)
		}
		column.position = nextPosition
		await column.save()

		const columns = await Column.find({ board: board._id })
			.sort({ position: 1, createdAt: 1 })
			.lean()
		emitBoardEvent(board._id.toString(), 'columns:reordered', { columns })
		return res.status(200).json(columns)
	} catch (error) {
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
		const hasAccess = await ensureBoardAccess(board._id, userId)
		if (!hasAccess) {
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

		emitBoardEvent(column.board.toString(), 'column:sort-updated', columnData)

		return res.status(200).json(columnData)
	} catch (error) {
		console.error('Error updating column sort:', error)
		return res.status(500).json({ message: 'Internal server error' })
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
		})

		await newTask.save()
		const savedTask = await Task.findById(newTask._id)
			.populate('assignees', 'name email avatar')
			.lean()
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
		} = req.body
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

		const { board, allowed } = await ensureBoardAccess(userId, task.column.board)
		if (!board || !allowed) {
			return res.status(403).json({ message: 'Access denied' })
		}

		const columnId = task.column._id
		const position = task.position
		const columnTitle = task.column.title

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
