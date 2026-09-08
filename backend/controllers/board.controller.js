import mongoose from 'mongoose'
import crypto from 'node:crypto'

import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'
import User from '../models/user.model.js'
import { emitBoardEvent } from '../lib/realtime.js'
import { sendBoardInviteEmail } from '../lib/mailer.js'
import BoardInvite from '../models/boardInvite.model.js'

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

export const getBoardInvites = async (req, res) => {
	try {
		const board = req.board
		if (board.createdBy.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only the board owner can view invites' })
		const invites = await BoardInvite.find({ board: board._id }).sort({ createdAt: -1 }).select('email expiresAt usedAt createdAt').lean()
		return res.status(200).json(invites.map((invite) => ({ ...invite, status: invite.usedAt ? 'accepted' : invite.expiresAt <= new Date() ? 'expired' : 'pending' })))
	} catch (error) {
		console.error('Board invites fetch failed:', error)
		return res.status(500).json({ message: 'Could not load board invites' })
	}
}

export const revokeBoardInvite = async (req, res) => {
	try {
		const board = req.board
		if (board.createdBy.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only the board owner can revoke invites' })
		const invite = await BoardInvite.findOne({ _id: req.params.inviteId, board: board._id, usedAt: null })
		if (!invite) return res.status(404).json({ message: 'Pending invite not found' })
		await invite.deleteOne()
		return res.status(200).json({ message: 'Invite revoked' })
	} catch (error) {
		console.error('Board invite revoke failed:', error)
		return res.status(500).json({ message: 'Could not revoke board invite' })
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

		const { board, allowed } = await ensureBoardAccess(req.user._id, column.board)
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
		await Board.deleteOne({ _id: boardId })

		return res
			.status(200)
			.json({ message: 'Board and related data deleted successfully' })
	} catch (error) {
		console.error('Error removing board:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}

export const getUserBoards = async (req, res) => {
	try {
		const userId = req.user._id
		if (!userId) {
			return res.status(400).json({ message: 'User ID is required' })
		}

		const membership = await BoardMember.find({ user: userId }).select('board role').lean()

		const boardIds = membership.map((member) => member.board)

		const boards = await Board.find({ _id: { $in: boardIds } }).lean()

		if (!boards || boards.length === 0) {
			return res.status(404).json({ message: 'No boards found for this user.' })
		}

		const membershipByBoard = new Map(
			membership.map((member) => [member.board.toString(), member])
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

export const addMemberToBoard = async (req, res) => {
	try {
		const boardId = req.params.id
		const { email, role = 'member' } = req.body
		const requesterId = req.user._id

		const board = await Board.findById(boardId)
		if (!board) {
			return res.status(404).json({ message: 'Board not found.' })
		}

		if (board.createdBy.toString() !== requesterId.toString()) {
			return res.status(403).json({
				message: 'Access denied: Only the board creator can add members.',
			})
		}

		const userToAdd = await User.findOne({ email })

		if (!userToAdd) {
			return res
				.status(404)
				.json({ message: 'User with this email not found.' })
		}
		if (userToAdd._id.toString() === requesterId.toString()) {
			return res.status(400).json({ message: 'You cannot add yourself to the board' })
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
			await sendBoardInviteEmail({ email: userToAdd.email, boardName: board.name, boardUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/workspaces/${board._id}` })
		} catch (mailError) {
			emailSent = false
			console.warn('Board invite email was not sent:', mailError.message)
		}

		return res
			.status(201)
			.json({ message: emailSent ? 'User added and invite email sent' : 'User added, but invite email could not be sent', member: newMember, emailSent })
	} catch (error) {
		console.error('Error adding member to board:', error)
		res.status(500).json({ message: 'Internal server error' })
	}
}

export const createBoardInvite = async (req, res) => {
	try {
		const board = req.board
		if (board.createdBy.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only the board owner can create invites' })
		const email = (req.body.email || '').trim().toLowerCase()
		if (email && email === req.user.email.toLowerCase()) return res.status(400).json({ message: 'You cannot invite yourself' })
		if (email) {
			const invitedUser = await User.findOne({ email }).select('_id')
			if (invitedUser) {
				const existingMember = await BoardMember.exists({ board: board._id, user: invitedUser._id })
				if (existingMember) return res.status(400).json({ message: 'This user is already a member of the board' })
			}
			const activeInvite = await BoardInvite.exists({ board: board._id, email, usedAt: null, expiresAt: { $gt: new Date() } })
			if (activeInvite) return res.status(400).json({ message: 'An active invite already exists for this email' })
		}
		const rawToken = crypto.randomBytes(32).toString('hex')
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		await BoardInvite.create({ board: board._id, email, tokenHash, createdBy: req.user._id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
		const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${rawToken}`
		let emailSent = false
		if (email) {
			try { await sendBoardInviteEmail({ email, boardName: board.name, boardUrl: inviteUrl }); emailSent = true } catch (error) { console.warn('Invite email was not sent:', error.message) }
		}
		return res.status(201).json({ inviteUrl, emailSent, expiresInDays: 7 })
	} catch (error) {
		console.error('Board invite creation failed:', error)
		return res.status(500).json({ message: 'Could not create board invite' })
	}
}

export const acceptBoardInvite = async (req, res) => {
	try {
		const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex')
		const userEmail = req.user.email.toLowerCase()
		const invite = await BoardInvite.findOneAndUpdate(
			{ tokenHash, usedAt: null, expiresAt: { $gt: new Date() }, $or: [{ email: '' }, { email: userEmail }] },
			{ $set: { usedAt: new Date() } },
			{ new: true }
		)
		if (!invite) return res.status(400).json({ message: 'Invite is invalid, expired, or already used' })
		await BoardMember.updateOne({ board: invite.board, user: req.user._id }, { $setOnInsert: { role: 'member' } }, { upsert: true })
		return res.status(200).json({ boardId: invite.board.toString(), message: 'Invite accepted' })
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

export const createTask = async (req, res) => {
	try {
		const columnId = req.column._id
		const { title, description, assignees = [], labels = [], checklist = [], position = 0 } = req.body

		const column = await Column.findById(columnId)
		if (!column) {
			return res.status(404).json({ message: 'Column not found' })
		}

		const { board, allowed } = await ensureBoardAccess(req.user._id, column.board)
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
		const savedTask = await Task.findById(newTask._id).populate('assignees', 'name email avatar').lean()
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
		if (!board || !allowed) return res.status(403).json({ message: 'Access denied' })

		const { title, description, dueDate, assignees, labels, checklist, position, column: targetColumnId } = req.body
		const originalColumnId = task.column._id
		const originalPosition = task.position
		let targetColumn = task.column
		if (targetColumnId && targetColumnId.toString() !== task.column._id.toString()) {
			targetColumn = await Column.findById(targetColumnId)
			if (!targetColumn || targetColumn.board.toString() !== task.column.board.toString()) {
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
			const movedWithinColumn = originalColumnId.toString() === targetColumn._id.toString()
			if (movedWithinColumn && nextPosition < originalPosition) {
				await Task.updateMany({ column: originalColumnId, _id: { $ne: task._id }, position: { $gte: nextPosition, $lt: originalPosition } }, { $inc: { position: 1 } })
			} else if (movedWithinColumn && nextPosition > originalPosition) {
				await Task.updateMany({ column: originalColumnId, _id: { $ne: task._id }, position: { $gt: originalPosition, $lte: nextPosition } }, { $inc: { position: -1 } })
			} else if (!movedWithinColumn) {
				await Task.updateMany({ column: originalColumnId, _id: { $ne: task._id }, position: { $gt: originalPosition } }, { $inc: { position: -1 } })
				await Task.updateMany({ column: targetColumn._id, position: { $gte: nextPosition } }, { $inc: { position: 1 } })
			}
			task.position = nextPosition
		}
		await task.save()
		const updatedTask = await Task.findById(task._id).populate('assignees', 'name email avatar').lean()
		emitBoardEvent(boardId, 'task:updated', updatedTask)
		return res.status(200).json(updatedTask)
	} catch (error) {
		console.error('Error updating task:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}
