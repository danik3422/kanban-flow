import express from 'express'

import { getBackgroundPhotos, uploadBoardBackground } from '../../controllers/board/backgrounds.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { boardMiddleware } from '../../middlewares/loadBoard.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { backgroundUploadSchema } from '../../validation/board.schemas.js'

// The photo is a large body: app.js skips its 200 KB parser for this path and the
// route reads it once the caller is signed in (see isImageUploadPath).
const imageBody = express.json({ limit: '8mb' })

const router = express.Router()
validateObjectIdParams(router)

router.get('/backgrounds/photos', verifiedAuthMiddleware, getBackgroundPhotos)
router.post('/boards/:id/background/upload', verifiedAuthMiddleware, boardMiddleware, imageBody, validateBody(backgroundUploadSchema), uploadBoardBackground)

export default router
