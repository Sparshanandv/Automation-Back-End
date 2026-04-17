import { Router } from 'express'
import { authMiddleware } from '../common/middleware/auth.middleware'
import { getMessageHandler, createMessageHandler } from './message.controller'

const router = Router()

router.get('/:key', getMessageHandler)
router.post('/', authMiddleware, createMessageHandler)

export default router
