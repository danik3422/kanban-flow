import express from 'express'
import {
	changePassword,
	createPasskeyRegistrationOptions,
	createPasskeyAuthenticationOptions,
	connectSocialAccount,
	setSocialPassword,
	getAuthUser,
	socialSignup,
	socialSignin,
	login,
	logout,
	removePasskey,
	requestPasswordReset,
	resetPassword,
	resendVerificationEmail,
	setupProfile,
	verifyPasskeyRegistration,
	authenticateWithPasskey,
	signup,
	updateSettings,
	verifyEmail,
} from '../controllers/auth.controller.js'
import {
	socialAuthSchema,
	loginSchema,
	passwordResetConfirmSchema,
	passwordResetRequestSchema,
	resendVerificationSchema,
	changePasswordSchema,
	connectSocialSchema,
	setSocialPasswordSchema,
	setupProfileSchema,
	settingsSchema,
	signupSchema,
} from '../lib/validation.js'
import { authMiddleware, verifiedAuthMiddleware } from '../middlewares/auth.middleware.js'
import {
	authLimiter,
	passwordResetLimiter,
	passwordChangeLimiter,
	verificationEmailIpLimiter,
	verificationEmailLimiter,
} from '../middlewares/security.middleware.js'
import { validateBody } from '../middlewares/validation.middleware.js'

const router = express.Router()

// Public routes
router.post('/signup', authLimiter, validateBody(signupSchema), signup)
router.post('/login', authLimiter, validateBody(loginSchema), login)

// Protected routes for email verification (require authentication)
router.post('/verify-email', authMiddleware, verifyEmail)
router.post(
	'/verify-email/resend',
	authMiddleware,
	validateBody(resendVerificationSchema),
	verificationEmailIpLimiter,
	verificationEmailLimiter,
	resendVerificationEmail,
)
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
	router.post('/social/connect', verifiedAuthMiddleware, authLimiter, validateBody(connectSocialSchema), connectSocialAccount)
	router.post('/social/set-password', verifiedAuthMiddleware, authLimiter, validateBody(setSocialPasswordSchema), setSocialPassword)
router.get('/get-user', authMiddleware, getAuthUser)
router.patch(
	'/setup-profile',
	verifiedAuthMiddleware,
	validateBody(setupProfileSchema),
	setupProfile,
)
router.patch(
	'/settings',
	verifiedAuthMiddleware,
	validateBody(settingsSchema),
	updateSettings,
)
router.patch(
	'/change-password',
	verifiedAuthMiddleware,
	passwordChangeLimiter,
	validateBody(changePasswordSchema),
	changePassword,
)
router.post('/passkeys/options', verifiedAuthMiddleware, createPasskeyRegistrationOptions)
router.post('/passkeys/verify', verifiedAuthMiddleware, verifyPasskeyRegistration)
router.delete('/passkeys/:credentialId', verifiedAuthMiddleware, authLimiter, removePasskey)
router.post('/passkeys/auth-options', authLimiter, createPasskeyAuthenticationOptions)
router.post('/passkeys/authenticate', authLimiter, authenticateWithPasskey)

export default router
