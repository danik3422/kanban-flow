import express from 'express'

import { createCalendarLink, deleteCalendarLink, getCalendarLink, serveCalendar } from '../controllers/calendar.controller.js'
import { verifiedAuthMiddleware } from '../middlewares/auth.middleware.js'

// Everything under /api/calendar: the link settings (signed in) and the calendar file
// itself, which calendar apps fetch with the secret token instead of a session.
const router = express.Router()

router.get('/link', verifiedAuthMiddleware, getCalendarLink)
router.post('/link', verifiedAuthMiddleware, createCalendarLink)
router.delete('/link', verifiedAuthMiddleware, deleteCalendarLink)
router.get('/:token.ics', serveCalendar)

export default router
