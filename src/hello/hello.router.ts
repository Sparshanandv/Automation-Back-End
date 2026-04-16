import { Router } from 'express'
import { getHello } from './hello.controller'

const router = Router()

router.get('/', getHello)

export default router
