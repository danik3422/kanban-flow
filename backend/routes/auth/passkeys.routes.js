import express from 'express'

import {
	authenticateWithPasskey,
	createPasskeyAuthenticationOptions,
	createPasskeyRegistrationOptions,
	removePasskey,
	renamePasskey,
	verifyPasskeyRegistration,
} from '../../controllers/auth/passkeys.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { authLimiter, passwordChangeLimiter } from '../../middlewares/rateLimit.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import {
	passkeyAuthenticateSchema,
	passkeyAuthOptionsSchema,
	removePasskeySchema,
	renamePasskeySchema,
	verifyPasskeySchema,
} from '../../validation/auth.schemas.js'

const router = express.Router()

// Adding and managing passkeys (signed in)
router.post('/passkeys/options', verifiedAuthMiddleware, authLimiter, createPasskeyRegistrationOptions)
router.post('/passkeys/verify', verifiedAuthMiddleware, authLimiter, validateBody(verifyPasskeySchema), verifyPasskeyRegistration)
router.patch('/passkeys/:credentialId', verifiedAuthMiddleware, validateBody(renamePasskeySchema), renamePasskey)
router.delete('/passkeys/:credentialId', verifiedAuthMiddleware, passwordChangeLimiter, validateBody(removePasskeySchema), removePasskey)

// Signing in with a passkey (public)
router.post('/passkeys/auth-options', authLimiter, validateBody(passkeyAuthOptionsSchema), createPasskeyAuthenticationOptions)
router.post('/passkeys/authenticate', authLimiter, validateBody(passkeyAuthenticateSchema), authenticateWithPasskey)

export default router
