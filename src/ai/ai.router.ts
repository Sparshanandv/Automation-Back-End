import { Router } from 'express'
import { generateQa, regenerateQa } from './ai.controller'

const router = Router()

router.post('/qa/generate/:featureId', generateQa)
router.post('/qa/regenerate/:featureId', regenerateQa)

export default router
