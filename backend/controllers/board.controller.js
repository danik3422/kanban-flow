import mongoose from 'mongoose'

import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'
import User from '../models/user.model.js'
import { emitBoardEvent } from '../lib/realtime.js'

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

		return res
			.status(201)
			.json({ message: 'User added successfully', member: newMember })
	} catch (error) {
		console.error('Error adding member to board:', error)
		res.status(500).json({ message: 'Internal server error' })
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
		const { title, description, assignees = [], position = 0 } = req.body

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

		const { title, description, assignees, position, column: targetColumnId } = req.body
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
		if (assignees !== undefined) task.assignees = assignees
		if (position !== undefined) task.position = position
		await task.save()
		const updatedTask = await Task.findById(task._id).populate('assignees', 'name email avatar').lean()
		emitBoardEvent(boardId, 'task:updated', updatedTask)
		return res.status(200).json(updatedTask)
	} catch (error) {
		console.error('Error updating task:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}
