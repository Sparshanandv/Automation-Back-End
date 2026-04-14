import { Router } from 'express'
import { featureController } from './feature.controller'

const router = Router()

router.post('/',           featureController.create)
router.get('/',            featureController.listAll)
router.get('/:id',         featureController.getById)
router.patch('/:id/status',featureController.updateStatus)

export default router
