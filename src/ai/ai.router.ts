import { Router } from 'express'
import { generateQa, getQaResults, getQaTestCases, generatePlan, getPlan, regenerateQa, approveQa } from './ai.controller'

const router = Router()

router.post('/qa/generate/:featureId', generateQa)
router.get('/qa/results/:featureId', getQaResults)
router.get('/qa/:featureId', getQaTestCases)
router.post('/plan/generate/:featureId', generatePlan)
router.get('/plan/:featureId', getPlan)
router.post('/qa/regenerate/:featureId', regenerateQa)
router.post('/qa/approve/:featureId', approveQa)

export default router
