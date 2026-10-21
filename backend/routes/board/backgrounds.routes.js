import express from 'express'

import { getBackgroundPhotos } from '../../controllers/board/backgrounds.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'

const router = express.Router()

router.get('/backgrounds/photos', verifiedAuthMiddleware, getBackgroundPhotos)

export default router
