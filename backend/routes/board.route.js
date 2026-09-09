import express from 'express'
import {
	acceptBoardInvite,
	addMemberToBoard,
	copyBoardInviteLink,
	createBoard,
	createBoardInvite,
	createColumn,
	createTask,
	deleteColumn,
	deleteTask,
	getBoardById,
	getBoardInviteDetails,
	getBoardColumns,
	getBoardInvites,
	getBoardMembers,
	getColumnTasks,
	getMyTasks,
	getUserBoards,
	leaveBoard,
	removeBoard,
	revokeBoardInvite,
	updateBoard,
	updateBoardMemberRole,
	updateColumn,
	reorderColumn,
	updateColumnSort,
	updateTask,
} from '../controllers/board.controller.js'
import {
	addTaskComment,
	getTaskActivities,
	startTaskTimer,
	stopTaskTimer,
} from '../controllers/taskActivity.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import {
	boardMiddleware,
	columnMiddleware,
} from '../middlewares/board.middleware.js'

const router = express.Router()

// Boards
router.get('/boards', authMiddleware, getUserBoards)
router.get('/my-tasks', authMiddleware, getMyTasks)
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
router.patch('/columns/:id', authMiddleware, columnMiddleware, updateColumn)
router.patch('/columns/:id/position', authMiddleware, columnMiddleware, reorderColumn)
router.patch('/columns/:id/sort', authMiddleware, columnMiddleware, updateColumnSort)
router.delete('/columns/:id', authMiddleware, columnMiddleware, deleteColumn)

// Tasks
router.get(
	'/columns/:id/tasks',
	authMiddleware,
	columnMiddleware,
	getColumnTasks,
)
router.post('/columns/:id/task', authMiddleware, columnMiddleware, createTask)
router.patch('/tasks/:id', authMiddleware, updateTask)
router.delete('/tasks/:id', authMiddleware, deleteTask)
router.get('/tasks/:id/activities', authMiddleware, getTaskActivities)
router.post('/tasks/:id/comments', authMiddleware, addTaskComment)
router.post('/tasks/:id/timer/start', authMiddleware, startTaskTimer)
router.post('/tasks/:id/timer/stop', authMiddleware, stopTaskTimer)

export default router
