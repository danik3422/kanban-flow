import express from 'express'

import {
	addTaskComment,
	deleteComment,
	getTaskActivities,
	updateComment,
} from '../../controllers/board/comments.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { taskCommentSchema } from '../../validation/card.schemas.js'

const router = express.Router()
validateObjectIdParams(router)

router.get('/tasks/:id/activities', verifiedAuthMiddleware, getTaskActivities)
router.post('/tasks/:id/comments', verifiedAuthMiddleware, validateBody(taskCommentSchema), addTaskComment)
router.patch('/tasks/:id/comments/:commentId', verifiedAuthMiddleware, validateBody(taskCommentSchema), updateComment)
router.delete('/tasks/:id/comments/:commentId', verifiedAuthMiddleware, deleteComment)

export default router
