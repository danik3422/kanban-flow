import express from 'express'
import {
	acceptBoardInvite,
	addMemberToBoard,
	copyBoardInviteLink,
	createBoard,
	createBoardInvite,
	createColumn,
	createTask,
	getBoardById,
	getBoardInviteDetails,
	getBoardColumns,
	getBoardInvites,
	getBoardMembers,
	getColumnTasks,
	getUserBoards,
	leaveBoard,
	removeBoard,
	revokeBoardInvite,
	updateBoard,
	updateBoardMemberRole,
	updateTask,
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
router.patch('/boards/:id', authMiddleware, boardMiddleware, updateBoard)
router.delete('/boards/:id', authMiddleware, boardMiddleware, removeBoard)
router.post('/boards/:id/leave', authMiddleware, boardMiddleware, leaveBoard)

// Members
router.get(
	'/boards/:id/members',
	authMiddleware,
	boardMiddleware,
	getBoardMembers,
)
router.patch(
	'/boards/:id/members/:memberId',
	authMiddleware,
	boardMiddleware,
	updateBoardMemberRole,
)
router.get(
	'/boards/:id/invites',
	authMiddleware,
	boardMiddleware,
	getBoardInvites,
)
router.delete(
	'/boards/:id/invites/:inviteId',
	authMiddleware,
	boardMiddleware,
	revokeBoardInvite,
)
router.post(
	'/boards/:id/members',
	authMiddleware,
	boardMiddleware,
	addMemberToBoard,
)
router.post(
	'/boards/:id/invites',
	authMiddleware,
	boardMiddleware,
	createBoardInvite,
)
router.post(
	'/boards/:id/invites/:inviteId/copy',
	authMiddleware,
	boardMiddleware,
	copyBoardInviteLink,
)
router.get('/invites/:token/details', getBoardInviteDetails)
router.post('/invites/:token/accept', authMiddleware, acceptBoardInvite)

// Columns
router.get(
	'/boards/:id/columns',
	authMiddleware,
	boardMiddleware,
	getBoardColumns,
)
router.post(
	'/boards/:id/columns',
	authMiddleware,
	boardMiddleware,
	createColumn,
)

// Tasks
router.get(
	'/columns/:id/tasks',
	authMiddleware,
	columnMiddleware,
	getColumnTasks,
)
router.post('/columns/:id/task', authMiddleware, columnMiddleware, createTask)
router.patch('/tasks/:id', authMiddleware, updateTask)

export default router
