import { Router } from 'express'
import { generateQa, executeFeature } from './ai.controller'

const router = Router()

router.post('/qa/generate/:featureId', generateQa)
router.post('/execute/:featureId', executeFeature)

export default router
