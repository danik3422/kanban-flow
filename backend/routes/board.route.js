import express from 'express'
import {
	addMemberToBoard,
	createBoard,
	createColumn,
	getUserBoards,
} from '../controllers/board.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { boardMiddleware } from '../middlewares/board.middleware.js'

const router = express.Router()

router.get('/boards', authMiddleware, getUserBoards)

router.post('/boards', authMiddleware, createBoard)
router.post('/boards/:id/members', authMiddleware, addMemberToBoard)
router.post(
	'/boards/:id/columns',
	authMiddleware,
	boardMiddleware,
	createColumn
)

export default router
