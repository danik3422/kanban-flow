import express from 'express'

import { archiveColumn, archiveTask, getBoardArchive, restoreColumn, restoreTask } from '../../controllers/board/archive.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'

const router = express.Router()
validateObjectIdParams(router)

router.get('/boards/:id/archive', verifiedAuthMiddleware, getBoardArchive)
router.post('/tasks/:id/archive', verifiedAuthMiddleware, archiveTask)
router.post('/tasks/:id/restore', verifiedAuthMiddleware, restoreTask)
router.post('/columns/:id/archive', verifiedAuthMiddleware, archiveColumn)
router.post('/columns/:id/restore', verifiedAuthMiddleware, restoreColumn)

export default router
