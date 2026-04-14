import { Router } from 'express'
import { GithubController } from './github.controller'


const router = Router()

// Commit files (dummy)
router.post('/commit', GithubController.commitFiles)
// Push code (dummy)
router.post('/push', GithubController.pushCode)
// Create PR (dummy)
router.post('/pr', GithubController.createPullRequest)
// Assign reviewers (dummy)
router.post('/assign-reviewers', GithubController.assignReviewers)

export default router
