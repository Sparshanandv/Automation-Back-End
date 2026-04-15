import { Router } from 'express'
import { generateQa, regenerateQa, approveQa } from './ai.controller'

const router = Router()

router.post('/qa/generate/:featureId', generateQa)
router.post('/qa/regenerate/:featureId', regenerateQa)
router.post('/qa/approve/:featureId', approveQa)

export default router
