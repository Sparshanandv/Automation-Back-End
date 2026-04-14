import { Router, Request, Response } from 'express'
import { GithubService } from './github.service'

const router = Router()

// GET /api/github/branches?repo_name=owner/repo
router.get('/branches', async (req: Request, res: Response) => {
  try {
    const { repo_name } = req.query
    if (!repo_name || typeof repo_name !== 'string') {
      return res.status(400).json({ message: 'repo_name query parameter is required' })
    }
    const branches = await GithubService.getBranches(repo_name)
    res.json(branches)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/github/branches
router.post('/branches', async (req: Request, res: Response) => {
  try {
    const { repo_name, new_branch, from_branch } = req.body
    if (!repo_name || !new_branch || !from_branch) {
      return res.status(400).json({ message: 'repo_name, new_branch, and from_branch are required' })
    }
    await GithubService.createBranch(repo_name, new_branch, from_branch)
    res.status(201).json({ message: `Branch ${new_branch} created successfully` })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// DELETE /api/github/branches?repo_name=owner/repo&branch_name=name
router.delete('/branches', async (req: Request, res: Response) => {
  try {
    const { repo_name, branch_name } = req.query
    if (!repo_name || typeof repo_name !== 'string') {
      return res.status(400).json({ message: 'repo_name query parameter is required' })
    }
    if (!branch_name || typeof branch_name !== 'string') {
      return res.status(400).json({ message: 'branch_name query parameter is required' })
    }
    await GithubService.deleteBranch(repo_name, branch_name)
    res.json({ message: `Branch ${branch_name} deleted successfully` })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

export default router
