import express from 'express'

import {
	getAuthUser,
	login,
	logout,
	setupProfile,
	signup,
	updateSettings,
} from '../../controllers/auth/account.controller.js'
import { authMiddleware, verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { authLimiter, loginAccountLimiter, loginEmailLimiter } from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { loginSchema, settingsSchema, setupProfileSchema, signupSchema } from '../../validation/auth.schemas.js'

const router = express.Router()

router.post('/signup', authLimiter, validateBody(signupSchema), signup)
router.post('/login', authLimiter, validateBody(loginSchema), loginEmailLimiter, loginAccountLimiter, login)
router.post('/logout', logout)
router.get('/get-user', authMiddleware, getAuthUser)
router.patch('/setup-profile', verifiedAuthMiddleware, validateBody(setupProfileSchema), setupProfile)
// Preferences such as language must work before the email is verified,
// because the verification screen itself follows them.
router.patch('/settings', authMiddleware, validateBody(settingsSchema), updateSettings)

export default router
