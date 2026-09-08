import express from 'express'
import {
	getAuthUser,
	googleSignin,
	googleSignup,
	login,
	logout,
	requestPasswordReset,
	resetPassword,
	setupProfile,
	signup,
	updateSettings,
} from '../controllers/auth.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { authLimiter, passwordResetLimiter } from '../middlewares/security.middleware.js'
import { validateBody } from '../middlewares/validation.middleware.js'
import {
	googleAuthSchema,
	loginSchema,
	passwordResetConfirmSchema,
	passwordResetRequestSchema,
	settingsSchema,
	signupSchema,
} from '../lib/validation.js'

const router = express.Router()

// Public routes
router.post('/signup', authLimiter, validateBody(signupSchema), signup)
router.post('/login', authLimiter, validateBody(loginSchema), login)
router.post('/password-reset/request', passwordResetLimiter, validateBody(passwordResetRequestSchema), requestPasswordReset)
router.post('/password-reset/confirm', passwordResetLimiter, validateBody(passwordResetConfirmSchema), resetPassword)
//Google
router.post('/google/signup', authLimiter, validateBody(googleAuthSchema), googleSignup)
router.post('/google/login', authLimiter, validateBody(googleAuthSchema), googleSignin)

// Protected routes
router.post('/logout', logout)
router.get('/get-user', authMiddleware, getAuthUser)
router.patch('/setup-profile', authMiddleware, setupProfile)
router.patch('/settings', authMiddleware, validateBody(settingsSchema), updateSettings)

export default router
