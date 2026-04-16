import { Router } from 'express'
import { ProjectController } from './project.controller'
import { uploadMiddleware } from '../common/middleware/upload.middleware'

const router = Router()

router.get('/', ProjectController.listProjects)
router.post('/', ProjectController.createProject)
router.get('/:id', ProjectController.getProject)
router.post('/:id/repos', ProjectController.addRepository)
router.delete('/:id/repos/:repoId', ProjectController.removeRepository)
router.delete('/:id', ProjectController.deleteProject)
router.put('/:id/repos/:repoId/readme', uploadMiddleware, ProjectController.updateReadmeInRepo)

export default router
