import express from 'express'

import {
	copyTask,
	createTask,
	deleteTask,
	getColumnTasks,
	getFeatures,
	reorderTasks,
	toggleWatchTask,
	updateTask,
} from '../../controllers/board/cards.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { boardMiddleware, columnMiddleware } from '../../middlewares/loadBoard.middleware.js'
import { copyLimiter } from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { copyTaskSchema, createTaskSchema, reorderTasksSchema, updateTaskSchema } from '../../validation/card.schemas.js'

const router = express.Router()
validateObjectIdParams(router)

router.get('/columns/:id/tasks', verifiedAuthMiddleware, columnMiddleware, getColumnTasks)
router.post('/columns/:id/task', verifiedAuthMiddleware, columnMiddleware, validateBody(createTaskSchema), createTask)
router.patch('/boards/:id/tasks/reorder', verifiedAuthMiddleware, boardMiddleware, validateBody(reorderTasksSchema), reorderTasks)
router.patch('/tasks/:id', verifiedAuthMiddleware, validateBody(updateTaskSchema), updateTask)
router.delete('/tasks/:id', verifiedAuthMiddleware, deleteTask)
router.post('/tasks/:id/copy', verifiedAuthMiddleware, copyLimiter, validateBody(copyTaskSchema), copyTask)
router.post('/tasks/:id/watch', verifiedAuthMiddleware, toggleWatchTask)
// Which optional card features this server offers (image uploads).
router.get('/features', verifiedAuthMiddleware, getFeatures)

export default router
