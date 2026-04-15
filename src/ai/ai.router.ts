import { Router } from 'express'
import { generateQa, getQaResults, generatePlan, getPlan, regenerateQa, approveQa, executeFeature } from './ai.controller'

const router = Router()

router.post('/qa/generate/:featureId', generateQa)
router.get('/qa/results/:featureId', getQaResults)
router.post('/plan/generate/:featureId', generatePlan)
router.get('/plan/:featureId', getPlan)
router.post('/qa/regenerate/:featureId', regenerateQa)
router.post('/qa/approve/:featureId', approveQa)
router.post('/execute/:featureId', executeFeature)

export default router
