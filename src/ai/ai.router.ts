import { Router } from 'express'
import {
  generateQa,
  getQaResults,
  generatePlan,
  getPlanController,
  approvePlanController,
  rejectPlanController,
  regenerateQa,
  approveQa,
  executeFeature,
  getCodeGeneration
} from './ai.controller'

const router = Router()

// QA Routes
router.post('/qa/generate/:featureId', generateQa)
router.get('/qa/results/:featureId', getQaResults)
router.post('/qa/regenerate/:featureId', regenerateQa)
router.post('/qa/approve/:featureId', approveQa)

// Plan Routes
router.post('/plan/generate/:featureId', generatePlan)
router.get('/plan/:featureId', getPlanController)
router.post('/plan/approve/:featureId', approvePlanController)
router.post('/plan/reject/:featureId', rejectPlanController)

// Execution Routes
router.post('/execute/:featureId', executeFeature)
router.get('/execute/:featureId', getCodeGeneration)

export default router
