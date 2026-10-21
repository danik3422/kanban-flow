import express from 'express'

import {
	addImageAttachment,
	addLinkAttachment,
	deleteAttachment,
} from '../../controllers/board/attachments.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { attachmentSchema, imageAttachmentSchema } from '../../validation/card.schemas.js'

// Card images and board background photos are the only large request bodies. app.js
// skips its 200 KB parser for these paths; each route parses them after sign-in.
const IMAGE_UPLOAD_PATHS = [/^\/api\/board\/tasks\/[^/]+\/attachments\/image$/, /^\/api\/board\/boards\/[^/]+\/background\/upload$/]
export const isImageUploadPath = (path) => IMAGE_UPLOAD_PATHS.some((pattern) => pattern.test(path))
const imageBody = express.json({ limit: '8mb' })

const router = express.Router()
validateObjectIdParams(router)

router.post('/tasks/:id/attachments', verifiedAuthMiddleware, validateBody(attachmentSchema), addLinkAttachment)
router.post('/tasks/:id/attachments/image', verifiedAuthMiddleware, imageBody, validateBody(imageAttachmentSchema), addImageAttachment)
router.delete('/tasks/:id/attachments/:attachmentId', verifiedAuthMiddleware, deleteAttachment)

export default router
