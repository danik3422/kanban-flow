import express from 'express'

import {
	connectSocialAccount,
	disconnectSocialAccount,
	setSocialPassword,
	socialSignin,
	socialSignup,
} from '../../controllers/auth/social.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { authLimiter } from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import {
	connectSocialSchema,
	disconnectSocialSchema,
	setSocialPasswordSchema,
	socialAuthSchema,
} from '../../validation/auth.schemas.js'

const router = express.Router()

router.post('/social/login', authLimiter, validateBody(socialAuthSchema), socialSignin)
router.post('/social/signup', authLimiter, validateBody(socialAuthSchema), socialSignup)
router.post('/social/connect', verifiedAuthMiddleware, authLimiter, validateBody(connectSocialSchema), connectSocialAccount)
router.delete('/social/:provider', verifiedAuthMiddleware, authLimiter, validateBody(disconnectSocialSchema), disconnectSocialAccount)
router.post('/social/set-password', verifiedAuthMiddleware, authLimiter, validateBody(setSocialPasswordSchema), setSocialPassword)

export default router
