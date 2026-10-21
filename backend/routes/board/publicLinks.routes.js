import express from 'express'

import {
	createPublicBoardLink,
	getPublicBoard,
	getPublicBoardLink,
	revokePublicBoardLink,
} from '../../controllers/board/publicLinks.controller.js'
import { optionalAuthMiddleware, verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { boardMiddleware } from '../../middlewares/loadBoard.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'

const router = express.Router()
validateObjectIdParams(router)

// Anyone with the link may look, signed in or not.
router.get('/public/:token', optionalAuthMiddleware, getPublicBoard)
router.get('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, getPublicBoardLink)
router.post('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, createPublicBoardLink)
router.delete('/boards/:id/public-link', verifiedAuthMiddleware, boardMiddleware, revokePublicBoardLink)

export default router
