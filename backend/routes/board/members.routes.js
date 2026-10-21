import express from 'express'

import {
	getBoardMembers,
	removeBoardMember,
	updateBoardMemberRole,
} from '../../controllers/board/members.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { boardMiddleware } from '../../middlewares/loadBoard.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { memberRoleSchema } from '../../validation/board.schemas.js'

const router = express.Router()
validateObjectIdParams(router)

router.get('/boards/:id/members', verifiedAuthMiddleware, boardMiddleware, getBoardMembers)
router.patch(
	'/boards/:id/members/:memberId',
	verifiedAuthMiddleware,
	boardMiddleware,
	validateBody(memberRoleSchema),
	updateBoardMemberRole,
)
router.delete('/boards/:id/members/:memberId', verifiedAuthMiddleware, boardMiddleware, removeBoardMember)

export default router
