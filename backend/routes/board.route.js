import express from 'express'
import {
	addMemberToBoard,
	createBoard,
	createColumn,
	createTask,
	getUserBoards,
	removeBoard,
} from '../controllers/board.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { boardMiddleware } from '../middlewares/board.middleware.js'

const router = express.Router()

// Boards
router.get('/boards', authMiddleware, getUserBoards)
router.post('/boards', authMiddleware, createBoard)
router.delete('/boards/:id', authMiddleware, boardMiddleware, removeBoard)

// Members
router.post('/boards/:id/members', authMiddleware, addMemberToBoard)

// Columns
router.post(
	'/boards/:id/columns',
	authMiddleware,
	boardMiddleware,
	createColumn
)

// Tasks
router.post('/columns/:id/task', authMiddleware, boardMiddleware, createTask)

export default router
