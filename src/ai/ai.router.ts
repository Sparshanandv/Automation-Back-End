import { Router } from 'express'
import { generateQa, getQaResults, generatePlan, getPlan } from './ai.controller'

const router = Router()

router.post('/qa/generate/:featureId', generateQa)
router.get('/qa/results/:featureId', getQaResults)
router.post('/plan/generate/:featureId', generatePlan)
router.get('/plan/:featureId', getPlan)

export default router
