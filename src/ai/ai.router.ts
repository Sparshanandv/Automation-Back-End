import { Router } from 'express'
import { generateQa } from './ai.controller'

const router = Router()

router.post('/qa/generate/:featureId', generateQa)

export default router
