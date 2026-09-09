import express from 'express'
import {
	changePassword,
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
	verifyEmail,
} from '../controllers/auth.controller.js'
import {
	googleAuthSchema,
	loginSchema,
	passwordResetConfirmSchema,
	passwordResetRequestSchema,
	settingsSchema,
	signupSchema,
} from '../lib/validation.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import {
	authLimiter,
	passwordResetLimiter,
} from '../middlewares/security.middleware.js'
import { validateBody } from '../middlewares/validation.middleware.js'

const router = express.Router()

// Public routes
router.post('/signup', authLimiter, validateBody(signupSchema), signup)
router.post('/login', authLimiter, validateBody(loginSchema), login)
router.post('/verify-email', verifyEmail)
router.get('/password-reset/validate', (req, res) => {
	import('../controllers/auth.controller.js')
		.then(({ validatePasswordResetToken }) => validatePasswordResetToken(req, res))
		.catch((error) => {
			console.error('Password reset validation route error:', error)
			res.status(500).json({ message: 'Could not validate reset link' })
		})
})
router.post(
	'/password-reset/request',
	passwordResetLimiter,
	validateBody(passwordResetRequestSchema),
	requestPasswordReset,
)
router.post(
	'/password-reset/confirm',
	passwordResetLimiter,
	validateBody(passwordResetConfirmSchema),
	resetPassword,
)
//Google
router.post(
	'/google/signup',
	authLimiter,
	validateBody(googleAuthSchema),
	googleSignup,
)
router.post(
	'/google/login',
	authLimiter,
	validateBody(googleAuthSchema),
	googleSignin,
)

// Protected routes
router.post('/logout', logout)
router.get('/get-user', authMiddleware, getAuthUser)
router.patch('/setup-profile', authMiddleware, setupProfile)
router.patch(
	'/settings',
	authMiddleware,
	validateBody(settingsSchema),
	updateSettings,
)
router.patch('/change-password', authMiddleware, changePassword)

export default router
