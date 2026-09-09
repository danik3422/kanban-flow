import express from 'express'
import {
	getNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from '../controllers/notification.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'

const router = express.Router()

router.get('/', authMiddleware, getNotifications)
router.patch('/:id/read', authMiddleware, markNotificationRead)
router.patch('/read-all', authMiddleware, markAllNotificationsRead)

export default router