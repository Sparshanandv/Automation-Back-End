import { Router } from 'express'
import { ProjectController } from './project.controller'

const router = Router()

router.get('/', ProjectController.listProjects)
router.post('/', ProjectController.createProject)
router.get('/:id', ProjectController.getProject)
router.post('/:id/repos', ProjectController.addRepository)
router.delete('/:id/repos/:repoId', ProjectController.removeRepository)

export default router
