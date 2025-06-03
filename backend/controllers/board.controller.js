import Board from '../models/board.model.js'
import BoardMember from '../models/BoardMember.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'
import User from '../models/user.model.js'
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

import mongoose from 'mongoose'

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

		const membership = await BoardMember.find({ user: userId }).select('board')

		const boardIds = membership.map((member) => member.board)

		const boards = await Board.find({ _id: { $in: boardIds } })

		if (!boards || boards.length === 0) {
			return res.status(404).json({ message: 'No boards found for this user.' })
		}

		res.status(200).json(boards)
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
		const board = req.board._id
		const userId = req.user._id
		const { title, position = 0 } = req.body

		if (!title) {
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
		//Todo: add Position logic
		const newColumn = {
			title,
			board: board._id,
			position,
		}

		await newColumn.save()

		res.status(201).json(newColumn)
	} catch (error) {
		console.error('Error creating column:', error)
		res.status(500).json({ message: 'Internal server error' })
	}
}

export const createTask = async (req, res) => {
	try {
		const columnId = req.board
		const { title, description, assignees = [], position = 0 } = req.body

		const column = await Column.findById(columnId)

		if (!column) {
			return res.status(404).json({ message: 'Column not found' })
		}

		if (!title || title.trim() === '') {
			return res.status(400).json({ message: 'Task title is required' })
		}

		//Todo: add Position logic
		const newTask = new Task({
			title,
			description: description || '',
			column: column._id,
			position,
			assignees,
		})

		const savedTask = await newTask.save()
		return res.status(201).json(savedTask)
	} catch (error) {
		console.error('Error creating task:', error)
		res.status(500).json({ message: 'Internal server error' })
	}
}
