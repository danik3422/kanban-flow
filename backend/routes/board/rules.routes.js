import express from 'express'

import { createRule, deleteRule, listRules, runRule, toggleRule, updateRule } from '../../controllers/board/rules.controller.js'
import { verifiedAuthMiddleware } from '../../middlewares/auth.middleware.js'
import { validateBody } from '../../middlewares/validateBody.middleware.js'
import { validateObjectIdParams } from '../../middlewares/validateObjectId.middleware.js'
import { ruleSchema, ruleToggleSchema } from '../../validation/automation.schemas.js'

const router = express.Router()
validateObjectIdParams(router, ['id', 'ruleId'])

router.get('/boards/:id/rules', verifiedAuthMiddleware, listRules)
router.post('/boards/:id/rules', verifiedAuthMiddleware, validateBody(ruleSchema), createRule)
router.put('/boards/:id/rules/:ruleId', verifiedAuthMiddleware, validateBody(ruleSchema), updateRule)
router.patch('/boards/:id/rules/:ruleId', verifiedAuthMiddleware, validateBody(ruleToggleSchema), toggleRule)
router.delete('/boards/:id/rules/:ruleId', verifiedAuthMiddleware, deleteRule)
router.post('/boards/:id/rules/:ruleId/run', verifiedAuthMiddleware, runRule)

export default router
