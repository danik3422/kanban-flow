import express from 'express'

import { resendVerificationEmail, verifyEmail } from '../../controllers/auth/emailVerification.controller.js'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import {
	authLimiter,
	verificationEmailIpLimiter,
	verificationEmailLimiter,
} from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { resendVerificationSchema, verifyEmailSchema } from '../../validation/auth.schemas.js'

const router = express.Router()

// Signed in but not yet verified: these are the routes such an account can use.
router.post('/verify-email', authLimiter, authMiddleware, validateBody(verifyEmailSchema), verifyEmail)
router.post(
	'/verify-email/resend',
	authMiddleware,
	validateBody(resendVerificationSchema),
	verificationEmailIpLimiter,
	verificationEmailLimiter,
	resendVerificationEmail,
)

export default router
