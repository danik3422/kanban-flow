import express from 'express'

import {
	acceptBoardInvite,
	copyBoardInviteLink,
	createBoardInvite,
	getBoardInviteDetails,
	getBoardInviteLink,
	getBoardInvites,
	resendBoardInvite,
	revokeBoardInvite,
} from '../../controllers/board/invites.controller.js'
import { optionalAuthMiddleware, verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { boardMiddleware } from '../../middlewares/loadBoard.middleware.js'
import { inviteLimiter } from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { createInviteSchema } from '../../validation/board.schemas.js'

const router = express.Router()
validateObjectIdParams(router)

// Managing a board's invites
router.get('/boards/:id/invites', verifiedAuthMiddleware, boardMiddleware, getBoardInvites)
router.get('/boards/:id/invites/link', verifiedAuthMiddleware, boardMiddleware, getBoardInviteLink)
router.delete('/boards/:id/invites/:inviteId', verifiedAuthMiddleware, boardMiddleware, revokeBoardInvite)
router.post(
	'/boards/:id/invites',
	verifiedAuthMiddleware,
	inviteLimiter,
	boardMiddleware,
	validateBody(createInviteSchema),
	createBoardInvite,
)
router.post('/boards/:id/invites/:inviteId/resend', verifiedAuthMiddleware, inviteLimiter, boardMiddleware, resendBoardInvite)
router.post('/boards/:id/invites/:inviteId/copy', verifiedAuthMiddleware, boardMiddleware, copyBoardInviteLink)

// Opening and accepting an invite
router.get('/invites/:token/details', optionalAuthMiddleware, getBoardInviteDetails)
router.post('/invites/:token/accept', verifiedAuthMiddleware, acceptBoardInvite)

export default router
