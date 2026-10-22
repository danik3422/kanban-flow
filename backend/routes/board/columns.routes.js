import express from 'express'

import {
	copyColumn,
	createColumn,
	deleteColumn,
	getBoardColumns,
	getBoardContent,
	moveColumnTasks,
	reorderColumn,
	updateColumn,
	updateColumnSort,
	watchColumn,
} from '../../controllers/board/columns.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { boardMiddleware, columnMiddleware } from '../../middlewares/loadBoard.middleware.js'
import { copyLimiter } from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import {
	columnPositionSchema,
	columnSortSchema,
	copyColumnSchema,
	createColumnSchema,
	moveColumnTasksSchema,
	updateColumnSchema,
	watchColumnSchema,
} from '../../validation/board.schemas.js'

const router = express.Router()
validateObjectIdParams(router)

router.get('/boards/:id/content', verifiedAuthMiddleware, boardMiddleware, getBoardContent)
router.get('/boards/:id/columns', verifiedAuthMiddleware, boardMiddleware, getBoardColumns)
router.post('/boards/:id/columns', verifiedAuthMiddleware, boardMiddleware, validateBody(createColumnSchema), createColumn)
router.patch('/columns/:id', verifiedAuthMiddleware, columnMiddleware, validateBody(updateColumnSchema), updateColumn)
router.patch('/columns/:id/position', verifiedAuthMiddleware, columnMiddleware, validateBody(columnPositionSchema), reorderColumn)
router.patch('/columns/:id/sort', verifiedAuthMiddleware, columnMiddleware, validateBody(columnSortSchema), updateColumnSort)
router.delete('/columns/:id', verifiedAuthMiddleware, deleteColumn)
router.post('/columns/:id/copy', verifiedAuthMiddleware, copyLimiter, columnMiddleware, validateBody(copyColumnSchema), copyColumn)
router.post('/columns/:id/move-tasks', verifiedAuthMiddleware, columnMiddleware, validateBody(moveColumnTasksSchema), moveColumnTasks)
router.post('/columns/:id/watch', verifiedAuthMiddleware, columnMiddleware, validateBody(watchColumnSchema), watchColumn)

export default router
