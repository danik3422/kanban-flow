import express from 'express'
import {
	getNotifications,
	deleteNotification,
	markAllNotificationsRead,
	markNotificationRead,
} from '../controllers/notification.controller.js'
import { verifiedAuthMiddleware } from '../middlewares/auth.middleware.js'
import { validateObjectIdParam } from '../middlewares/board.middleware.js'

const router = express.Router()

router.param('id', validateObjectIdParam)

router.get('/', verifiedAuthMiddleware, getNotifications)
router.patch('/:id/read', verifiedAuthMiddleware, markNotificationRead)
router.delete('/:id', verifiedAuthMiddleware, deleteNotification)
router.patch('/read-all', verifiedAuthMiddleware, markAllNotificationsRead)

export default router