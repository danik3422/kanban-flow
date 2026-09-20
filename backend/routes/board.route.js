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
	getPublicBoardLink,
	createPublicBoardLink,
	getPublicBoard,
	getBoardActivities,
	getBoardInviteDetails,
	getBoardColumns,
	getBoardInvites,
	getBoardInviteLink,
	getBoardMembers,
	getColumnTasks,
	getMyTasks,
	getUserBoards,
	leaveBoard,
	removeBoard,
	removeBoardMember,
	revokeBoardInvite,
	revokePublicBoardLink,
	updateBoard,
	updateBoardMemberRole,
	updateColumn,
	reorderColumn,
	updateColumnSort,
	reorderTasks,
	updateTask,
} from '../controllers/board.controller.js'
import {
	addTaskComment,
	getTaskActivities,
	startTaskTimer,
	stopTaskTimer,
} from '../controllers/taskActivity.controller.js'
import { verifiedAuthMiddleware } from '../middlewares/auth.middleware.js'
import {
	boardMiddleware,
	columnMiddleware,
} from '../middlewares/board.middleware.js'

const router = express.Router()
const authMiddleware = verifiedAuthMiddleware

// Boards
	router.get('/boards', verifiedAuthMiddleware, getUserBoards)
	router.get('/my-tasks', verifiedAuthMiddleware, getMyTasks)
router.get('/public/:token', getPublicBoard)
router.post('/boards', verifiedAuthMiddleware, createBoard)
router.get('/boards/:id', verifiedAuthMiddleware, boardMiddleware, getBoardById)
router.get('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, getPublicBoardLink)
router.post('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, createPublicBoardLink)
router.delete('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, revokePublicBoardLink)
router.get('/boards/:id/activity', verifiedAuthMiddleware, boardMiddleware, getBoardActivities)
router.patch('/boards/:id', verifiedAuthMiddleware, boardMiddleware, updateBoard)
router.delete('/boards/:id', verifiedAuthMiddleware, boardMiddleware, removeBoard)
router.post('/boards/:id/leave', verifiedAuthMiddleware, boardMiddleware, leaveBoard)

// Members
router.get(
	'/boards/:id/members',
	verifiedAuthMiddleware,
	boardMiddleware,
	getBoardMembers,
)
router.patch(
	'/boards/:id/members/:memberId',
	verifiedAuthMiddleware,
	boardMiddleware,
	updateBoardMemberRole,
)
router.delete(
	'/boards/:id/members/:memberId',
	verifiedAuthMiddleware,
	boardMiddleware,
	removeBoardMember,
)
router.get(
	'/boards/:id/invites',
	verifiedAuthMiddleware,
	boardMiddleware,
	getBoardInvites,
)
router.get('/boards/:id/invites/link', authMiddleware, boardMiddleware, getBoardInviteLink)
router.delete(
	'/boards/:id/invites/:inviteId',
	verifiedAuthMiddleware,
	boardMiddleware,
	revokeBoardInvite,
)
router.post(
	'/boards/:id/members',
	verifiedAuthMiddleware,
	boardMiddleware,
	addMemberToBoard,
)
router.post(
	'/boards/:id/invites',
	verifiedAuthMiddleware,
	boardMiddleware,
	createBoardInvite,
)
router.post(
	'/boards/:id/invites/:inviteId/copy',
	verifiedAuthMiddleware,
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
router.patch('/boards/:id/tasks/reorder', authMiddleware, boardMiddleware, reorderTasks)
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
