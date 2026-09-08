import express from 'express'
import {
	addMemberToBoard,
	createBoard,
	createColumn,
	createTask,
	getBoardById,
	getBoardColumns,
	getBoardMembers,
	getColumnTasks,
	getUserBoards,
	removeBoard,
} from '../controllers/board.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import {
	boardMiddleware,
	columnMiddleware,
} from '../middlewares/board.middleware.js'

const router = express.Router()

// Boards
router.get('/boards', authMiddleware, getUserBoards)
router.post('/boards', authMiddleware, createBoard)
router.get('/boards/:id', authMiddleware, boardMiddleware, getBoardById)
router.delete('/boards/:id', authMiddleware, boardMiddleware, removeBoard)

// Members
router.get('/boards/:id/members', authMiddleware, boardMiddleware, getBoardMembers)
router.post('/boards/:id/members', authMiddleware, boardMiddleware, addMemberToBoard)

// Columns
router.get('/boards/:id/columns', authMiddleware, boardMiddleware, getBoardColumns)
router.post(
	'/boards/:id/columns',
	authMiddleware,
	boardMiddleware,
	createColumn
)

// Tasks
router.get('/columns/:id/tasks', authMiddleware, columnMiddleware, getColumnTasks)
router.post('/columns/:id/task', authMiddleware, columnMiddleware, createTask)

export default router
