import express from 'express'

import {
	deleteAccount,
	getAuthUser,
	login,
	logout,
	setupProfile,
	signup,
	updateSettings,
} from '../../controllers/auth/account.controller.js'
import { authMiddleware, verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { authLimiter, loginAccountLimiter, loginEmailLimiter, passwordChangeLimiter } from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { deleteAccountSchema, loginSchema, settingsSchema, setupProfileSchema, signupSchema } from '../../validation/auth.schemas.js'

const router = express.Router()

router.post('/signup', authLimiter, validateBody(signupSchema), signup)
router.post('/login', authLimiter, validateBody(loginSchema), loginEmailLimiter, loginAccountLimiter, login)
router.post('/logout', logout)
router.get('/get-user', authMiddleware, getAuthUser)
router.patch('/setup-profile', verifiedAuthMiddleware, validateBody(setupProfileSchema), setupProfile)
// Preferences such as language must work before the email is verified,
// because the verification screen itself follows them.
router.patch('/settings', authMiddleware, validateBody(settingsSchema), updateSettings)
// Works before the email is verified too: anyone can leave.
router.delete('/account', authMiddleware, passwordChangeLimiter, validateBody(deleteAccountSchema), deleteAccount)

export default router
