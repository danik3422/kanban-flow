import express from 'express'
import {
	changePassword,
	connectSocialAccount,
	getAuthUser,
	socialSignup,
	socialSignin,
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
	socialAuthSchema,
	loginSchema,
	passwordResetConfirmSchema,
	passwordResetRequestSchema,
	changePasswordSchema,
	connectSocialSchema,
	setupProfileSchema,
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
router.post(
	'/social/login',
	authLimiter,
	validateBody(socialAuthSchema),
	socialSignin,
)
router.post('/social/signup', authLimiter, validateBody(socialAuthSchema), socialSignup)

// Protected routes
router.post('/logout', logout)
router.post('/social/connect', authMiddleware, validateBody(connectSocialSchema), connectSocialAccount)
router.get('/get-user', authMiddleware, getAuthUser)
router.patch(
	'/setup-profile',
	authMiddleware,
	validateBody(setupProfileSchema),
	setupProfile,
)
router.patch(
	'/settings',
	authMiddleware,
	validateBody(settingsSchema),
	updateSettings,
)
router.patch(
	'/change-password',
	authMiddleware,
	validateBody(changePasswordSchema),
	changePassword,
)

export default router
