import express from 'express'

import {
	getSessions,
	reauthenticate,
	revokeSession,
	signOutOtherSessions,
} from '../../controllers/auth/sessions.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { passwordChangeLimiter, sessionLimiter } from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { reauthenticateSchema } from '../../validation/auth.schemas.js'

const router = express.Router()

router.get('/sessions', verifiedAuthMiddleware, getSessions)
router.delete('/sessions/:id', verifiedAuthMiddleware, sessionLimiter, revokeSession)
router.post('/sessions/sign-out-others', verifiedAuthMiddleware, sessionLimiter, signOutOtherSessions)
router.post('/reauthenticate', verifiedAuthMiddleware, passwordChangeLimiter, validateBody(reauthenticateSchema), reauthenticate)

export default router
