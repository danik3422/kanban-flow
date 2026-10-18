import express from 'express'
import {
	addImageAttachment,
	addLinkAttachment,
	addTimeEntry,
	copyTask,
	createBoardLabel,
	deleteAttachment,
	deleteBoardLabel,
	deleteComment,
	deleteTimeEntry,
	getFeatures,
	getRunningTimer,
	getTaskTime,
	startTimer,
	stopTimer,
	toggleWatchTask,
	updateBoardLabel,
	updateComment,
	updateTimeEntry,
} from '../controllers/card.controller.js'
import {
	acceptBoardInvite,
	copyBoardInviteLink,
	copyBoard,
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
	getBackgroundPhotos,
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
	getBoardsOverview,
	getCalendarTasks,
	leaveBoard,
	removeBoard,
	removeBoardMember,
	resendBoardInvite,
	revokeBoardInvite,
	revokePublicBoardLink,
	updateBoard,
	updateBoardMemberRole,
	updateColumn,
	reorderColumn,
	updateColumnSort,
	reorderTasks,
	updateTask,
	copyColumn,
	moveColumnTasks,
	watchColumn,
} from '../controllers/board.controller.js'
import {
	addTaskComment,
	getTaskActivities,
} from '../controllers/taskActivity.controller.js'
import { verifiedAuthMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware.js'
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
	attachmentSchema,
	boardLabelSchema,
	boardLabelUpdateSchema,
	copyBoardSchema,
	copyTaskSchema,
	imageAttachmentSchema,
	timeEntrySchema,
	timeEntryUpdateSchema,
	updateBoardSchema,
	updateColumnSchema,
	updateTaskSchema,
	copyColumnSchema,
	moveColumnTasksSchema,
	watchColumnSchema,
} from '../lib/validation.js'

const router = express.Router()
const authMiddleware = verifiedAuthMiddleware

for (const param of ['id', 'memberId', 'inviteId']) {
	router.param(param, validateObjectIdParam)
}

// Boards
router.get('/boards', verifiedAuthMiddleware, getUserBoards)
router.get('/boards/overview', verifiedAuthMiddleware, getBoardsOverview)
router.get('/my-tasks', verifiedAuthMiddleware, getMyTasks)
router.get('/calendar', verifiedAuthMiddleware, getCalendarTasks)
router.get('/team', verifiedAuthMiddleware, getTeam)
router.get('/public/:token', optionalAuthMiddleware, getPublicBoard)
router.get('/backgrounds/photos', verifiedAuthMiddleware, getBackgroundPhotos)
router.post('/boards', verifiedAuthMiddleware, validateBody(createBoardSchema), createBoard)
router.get('/boards/:id', verifiedAuthMiddleware, boardMiddleware, getBoardById)
router.get('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, getPublicBoardLink)
router.post('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, createPublicBoardLink)
router.delete('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, revokePublicBoardLink)
router.get('/boards/:id/activity', verifiedAuthMiddleware, boardMiddleware, getBoardActivities)
router.patch('/boards/:id', verifiedAuthMiddleware, boardMiddleware, validateBody(updateBoardSchema), updateBoard)
router.delete('/boards/:id', verifiedAuthMiddleware, boardMiddleware, removeBoard)
router.post('/boards/:id/leave', verifiedAuthMiddleware, boardMiddleware, leaveBoard)
router.post('/boards/:id/copy', verifiedAuthMiddleware, boardMiddleware, validateBody(copyBoardSchema), copyBoard)

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
router.post('/boards/:id/invites/:inviteId/resend', verifiedAuthMiddleware, inviteLimiter, boardMiddleware, resendBoardInvite)
router.post(
	'/boards/:id/invites/:inviteId/copy',
	verifiedAuthMiddleware,
	boardMiddleware,
	copyBoardInviteLink,
)
router.get('/invites/:token/details', optionalAuthMiddleware, getBoardInviteDetails)
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
router.post('/columns/:id/copy', authMiddleware, columnMiddleware, validateBody(copyColumnSchema), copyColumn)
router.post('/columns/:id/move-tasks', authMiddleware, columnMiddleware, validateBody(moveColumnTasksSchema), moveColumnTasks)
router.post('/columns/:id/watch', authMiddleware, columnMiddleware, validateBody(watchColumnSchema), watchColumn)

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
router.post('/tasks/:id/timer/start', authMiddleware, startTimer)
router.post('/tasks/:id/timer/stop', authMiddleware, stopTimer)
router.get('/tasks/:id/time', authMiddleware, getTaskTime)
router.post('/tasks/:id/time', authMiddleware, validateBody(timeEntrySchema), addTimeEntry)
router.patch('/time/:entryId', authMiddleware, validateBody(timeEntryUpdateSchema), updateTimeEntry)
router.delete('/time/:entryId', authMiddleware, deleteTimeEntry)
router.get('/timer/running', authMiddleware, getRunningTimer)
router.patch('/tasks/:id/comments/:commentId', authMiddleware, validateBody(taskCommentSchema), updateComment)
router.delete('/tasks/:id/comments/:commentId', authMiddleware, deleteComment)
router.post('/tasks/:id/attachments', authMiddleware, validateBody(attachmentSchema), addLinkAttachment)
router.post('/tasks/:id/attachments/image', authMiddleware, validateBody(imageAttachmentSchema), addImageAttachment)
router.delete('/tasks/:id/attachments/:attachmentId', authMiddleware, deleteAttachment)
router.post('/tasks/:id/copy', authMiddleware, validateBody(copyTaskSchema), copyTask)
router.post('/tasks/:id/watch', authMiddleware, toggleWatchTask)
router.post('/boards/:id/labels', verifiedAuthMiddleware, validateBody(boardLabelSchema), createBoardLabel)
router.patch('/boards/:id/labels/:labelId', verifiedAuthMiddleware, validateBody(boardLabelUpdateSchema), updateBoardLabel)
router.delete('/boards/:id/labels/:labelId', verifiedAuthMiddleware, deleteBoardLabel)
router.get('/features', authMiddleware, getFeatures)

export default router
