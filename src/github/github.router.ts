import { Router, Request, Response } from 'express'
import { GithubService } from './github.service'
import { HttpStatus } from '../common/constants/http-status'

const router = Router()

// GET /api/github/branches?repo_name=owner/repo
router.get('/branches', async (req: Request, res: Response) => {
  try {
    const { repo_name } = req.query
    if (!repo_name || typeof repo_name !== 'string') {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'repo_name query parameter is required' })
    }
    const branches = await GithubService.getBranches(repo_name)
    res.json(branches)
  } catch (error: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message })
  }
})

// POST /api/github/branches
router.post('/branches', async (req: Request, res: Response) => {
  try {
    const { repo_name, new_branch, from_branch } = req.body
    if (!repo_name || !new_branch || !from_branch) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'repo_name, new_branch, and from_branch are required' })
    }
    await GithubService.createBranch(repo_name, new_branch, from_branch)
    res.status(HttpStatus.CREATED).json({ message: `Branch ${new_branch} created successfully` })
  } catch (error: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message })
  }
})

// DELETE /api/github/branches?repo_name=owner/repo&branch_name=name
router.delete('/branches', async (req: Request, res: Response) => {
  try {
    const { repo_name, branch_name } = req.query
    if (!repo_name || typeof repo_name !== 'string') {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'repo_name query parameter is required' })
    }
    if (!branch_name || typeof branch_name !== 'string') {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'branch_name query parameter is required' })
    }
    await GithubService.deleteBranch(repo_name, branch_name)
    res.json({ message: `Branch ${branch_name} deleted successfully` })
  } catch (error: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message })
  }
})

export default router
