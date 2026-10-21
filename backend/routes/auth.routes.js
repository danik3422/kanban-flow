import express from 'express'

import accountRoutes from './auth/account.routes.js'
import emailVerificationRoutes from './auth/emailVerification.routes.js'
import passkeyRoutes from './auth/passkeys.routes.js'
import passwordRoutes from './auth/password.routes.js'
import sessionRoutes from './auth/sessions.routes.js'
import socialRoutes from './auth/social.routes.js'

// Everything under /api/auth.
const router = express.Router()

router.use(accountRoutes)
router.use(emailVerificationRoutes)
router.use(passwordRoutes)
router.use(socialRoutes)
router.use(sessionRoutes)
router.use(passkeyRoutes)

export default router
