import express from 'express'

import {
	addTimeEntry,
	deleteTimeEntry,
	getRunningTimer,
	getTaskTime,
	startTimer,
	stopTimer,
	updateTimeEntry,
} from '../../controllers/board/timeTracking.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { timeEntrySchema, timeEntryUpdateSchema } from '../../validation/card.schemas.js'

const router = express.Router()
validateObjectIdParams(router)

router.post('/tasks/:id/timer/start', verifiedAuthMiddleware, startTimer)
router.post('/tasks/:id/timer/stop', verifiedAuthMiddleware, stopTimer)
router.get('/tasks/:id/time', verifiedAuthMiddleware, getTaskTime)
router.post('/tasks/:id/time', verifiedAuthMiddleware, validateBody(timeEntrySchema), addTimeEntry)
router.patch('/time/:entryId', verifiedAuthMiddleware, validateBody(timeEntryUpdateSchema), updateTimeEntry)
router.delete('/time/:entryId', verifiedAuthMiddleware, deleteTimeEntry)
router.get('/timer/running', verifiedAuthMiddleware, getRunningTimer)

export default router
