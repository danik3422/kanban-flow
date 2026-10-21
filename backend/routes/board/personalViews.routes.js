import express from 'express'

import { getCalendarTasks, getMyTasks, getTeam } from '../../controllers/board/personalViews.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'

const router = express.Router()

router.get('/my-tasks', verifiedAuthMiddleware, getMyTasks)
router.get('/calendar', verifiedAuthMiddleware, getCalendarTasks)
router.get('/team', verifiedAuthMiddleware, getTeam)

export default router
