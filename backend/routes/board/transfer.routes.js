import express from 'express'

import { exportBoard, importBoard } from '../../controllers/board/transfer.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { copyLimiter } from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { importBoardSchema } from '../../validation/board.schemas.js'

// A whole board to a file and back. An import is parsed here, after sign-in, with room
// for a large board (app.js skips its small parser for this path).
const importBody = express.json({ limit: '10mb' })

const router = express.Router()
validateObjectIdParams(router)

router.post('/boards/import', verifiedAuthMiddleware, copyLimiter, importBody, validateBody(importBoardSchema), importBoard)
router.get('/boards/:id/export', verifiedAuthMiddleware, exportBoard)

export default router
