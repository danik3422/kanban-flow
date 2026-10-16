import express from 'express'
import {
	acceptBoardInvite,
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
	getBoardContent,
	getBoardInvites,
	getBoardInviteLink,
	getBoardMembers,
	getColumnTasks,
	getMyTasks,
	getTeam,
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
	validateObjectIdParam,
} from '../middlewares/board.middleware.js'
import { inviteLimiter } from '../middlewares/security.middleware.js'
import { validateBody } from '../middlewares/validation.middleware.js'
import {
	columnPositionSchema,
	columnSortSchema,
	createBoardSchema,
	createColumnSchema,
	createInviteSchema,
	createTaskSchema,
	memberRoleSchema,
	reorderTasksSchema,
	taskCommentSchema,
	updateBoardSchema,
	updateColumnSchema,
	updateTaskSchema,
} from '../lib/validation.js'

const router = express.Router()
const authMiddleware = verifiedAuthMiddleware

for (const param of ['id', 'memberId', 'inviteId']) {
	router.param(param, validateObjectIdParam)
}

// Boards
router.get('/boards', verifiedAuthMiddleware, getUserBoards)
router.get('/my-tasks', verifiedAuthMiddleware, getMyTasks)
router.get('/team', verifiedAuthMiddleware, getTeam)
router.get('/public/:token', getPublicBoard)
router.post('/boards', verifiedAuthMiddleware, validateBody(createBoardSchema), createBoard)
router.get('/boards/:id', verifiedAuthMiddleware, boardMiddleware, getBoardById)
router.get('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, getPublicBoardLink)
router.post('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, createPublicBoardLink)
router.delete('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, revokePublicBoardLink)
router.get('/boards/:id/activity', verifiedAuthMiddleware, boardMiddleware, getBoardActivities)
router.patch('/boards/:id', verifiedAuthMiddleware, boardMiddleware, validateBody(updateBoardSchema), updateBoard)
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
	validateBody(memberRoleSchema),
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
	'/boards/:id/invites',
	verifiedAuthMiddleware,
	inviteLimiter,
	boardMiddleware,
	validateBody(createInviteSchema),
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
router.get('/boards/:id/content', authMiddleware, boardMiddleware, getBoardContent)
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
	validateBody(createColumnSchema),
	createColumn,
)
router.patch('/columns/:id', authMiddleware, columnMiddleware, validateBody(updateColumnSchema), updateColumn)
router.patch('/columns/:id/position', authMiddleware, columnMiddleware, validateBody(columnPositionSchema), reorderColumn)
router.patch('/columns/:id/sort', authMiddleware, columnMiddleware, validateBody(columnSortSchema), updateColumnSort)
router.patch('/boards/:id/tasks/reorder', authMiddleware, boardMiddleware, validateBody(reorderTasksSchema), reorderTasks)
router.delete('/columns/:id', authMiddleware, columnMiddleware, deleteColumn)

// Tasks
router.get(
	'/columns/:id/tasks',
	authMiddleware,
	columnMiddleware,
	getColumnTasks,
)
router.post('/columns/:id/task', authMiddleware, columnMiddleware, validateBody(createTaskSchema), createTask)
router.patch('/tasks/:id', authMiddleware, validateBody(updateTaskSchema), updateTask)
router.delete('/tasks/:id', authMiddleware, deleteTask)
router.get('/tasks/:id/activities', authMiddleware, getTaskActivities)
router.post('/tasks/:id/comments', authMiddleware, validateBody(taskCommentSchema), addTaskComment)
router.post('/tasks/:id/timer/start', authMiddleware, startTaskTimer)
router.post('/tasks/:id/timer/stop', authMiddleware, stopTaskTimer)

export default router
