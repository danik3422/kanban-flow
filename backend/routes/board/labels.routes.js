import express from 'express'

import { createBoardLabel, deleteBoardLabel, updateBoardLabel } from '../../controllers/board/labels.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { boardLabelSchema, boardLabelUpdateSchema } from '../../validation/card.schemas.js'

const router = express.Router()
validateObjectIdParams(router)

router.post('/boards/:id/labels', verifiedAuthMiddleware, validateBody(boardLabelSchema), createBoardLabel)
router.patch('/boards/:id/labels/:labelId', verifiedAuthMiddleware, validateBody(boardLabelUpdateSchema), updateBoardLabel)
router.delete('/boards/:id/labels/:labelId', verifiedAuthMiddleware, deleteBoardLabel)

export default router
