import express from 'express'

import {
	deleteNotification,
	getNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from '../controllers/notifications.controller.js'
import { verifiedAuthMiddleware } from '../middlewares/auth.middleware.js'
import { validateObjectIdParams } from '../middlewares/validateObjectId.middleware.js'

// Everything under /api/notifications.
const router = express.Router()
validateObjectIdParams(router, ['id'])

router.get('/', verifiedAuthMiddleware, getNotifications)
router.patch('/:id/read', verifiedAuthMiddleware, markNotificationRead)
router.delete('/:id', verifiedAuthMiddleware, deleteNotification)
router.patch('/read-all', verifiedAuthMiddleware, markAllNotificationsRead)

export default router
