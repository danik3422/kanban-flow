import express from 'express'

import {
	changePassword,
	requestPasswordReset,
	resetPassword,
	validatePasswordResetToken,
} from '../../controllers/auth/password.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import {
	passwordChangeLimiter,
	passwordResetEmailLimiter,
	passwordResetLimiter,
	passwordResetRequestLimiter,
} from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import {
	changePasswordSchema,
	passwordResetConfirmSchema,
	passwordResetRequestSchema,
} from '../../validation/auth.schemas.js'

const router = express.Router()

router.get('/password-reset/validate', validatePasswordResetToken)
router.post(
	'/password-reset/request',
	passwordResetRequestLimiter,
	validateBody(passwordResetRequestSchema),
	passwordResetEmailLimiter,
	requestPasswordReset,
)
router.post('/password-reset/confirm', passwordResetLimiter, validateBody(passwordResetConfirmSchema), resetPassword)
router.patch(
	'/change-password',
	verifiedAuthMiddleware,
	passwordChangeLimiter,
	validateBody(changePasswordSchema),
	changePassword,
)

export default router
