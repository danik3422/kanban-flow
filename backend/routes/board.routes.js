import express from 'express'

import attachmentRoutes from './board/attachments.routes.js'
import backgroundRoutes from './board/backgrounds.routes.js'
import boardRoutes from './board/boards.routes.js'
import cardRoutes from './board/cards.routes.js'
import columnRoutes from './board/columns.routes.js'
import commentRoutes from './board/comments.routes.js'
import inviteRoutes from './board/invites.routes.js'
import labelRoutes from './board/labels.routes.js'
import memberRoutes from './board/members.routes.js'
import personalViewRoutes from './board/personalViews.routes.js'
import publicLinkRoutes from './board/publicLinks.routes.js'
import timeTrackingRoutes from './board/timeTracking.routes.js'

// Everything under /api/board. Every route needs a verified account, except the
// public board page and invite details, which also work signed out.
const router = express.Router()

router.use(boardRoutes)
router.use(personalViewRoutes)
router.use(publicLinkRoutes)
router.use(backgroundRoutes)
router.use(memberRoutes)
router.use(inviteRoutes)
router.use(columnRoutes)
router.use(cardRoutes)
router.use(commentRoutes)
router.use(timeTrackingRoutes)
router.use(attachmentRoutes)
router.use(labelRoutes)

export default router
