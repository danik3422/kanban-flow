import express from 'express'

import {
	copyBoard,
	createBoard,
	getBoardActivities,
	getBoardById,
	getBoardsOverview,
	getUserBoards,
	leaveBoard,
	removeBoard,
	updateBoard,
} from '../../controllers/board/boards.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { boardMiddleware } from '../../middlewares/loadBoard.middleware.js'
import { copyLimiter } from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { copyBoardSchema, createBoardSchema, updateBoardSchema } from '../../validation/board.schemas.js'

const router = express.Router()
validateObjectIdParams(router)

router.get('/boards', verifiedAuthMiddleware, getUserBoards)
// Must stay above /boards/:id, or "overview" would be read as a board id.
router.get('/boards/overview', verifiedAuthMiddleware, getBoardsOverview)
router.post('/boards', verifiedAuthMiddleware, validateBody(createBoardSchema), createBoard)
router.get('/boards/:id', verifiedAuthMiddleware, boardMiddleware, getBoardById)
router.get('/boards/:id/activity', verifiedAuthMiddleware, boardMiddleware, getBoardActivities)
router.patch('/boards/:id', verifiedAuthMiddleware, boardMiddleware, validateBody(updateBoardSchema), updateBoard)
router.delete('/boards/:id', verifiedAuthMiddleware, boardMiddleware, removeBoard)
router.post('/boards/:id/leave', verifiedAuthMiddleware, boardMiddleware, leaveBoard)
router.post('/boards/:id/copy', verifiedAuthMiddleware, copyLimiter, boardMiddleware, validateBody(copyBoardSchema), copyBoard)

export default router
