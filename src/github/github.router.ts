import { Router, Request, Response } from 'express'
import { GithubService } from './github.service'
import { ProjectService } from '../project/project.service'
import { HttpStatus } from '../common/constants/http-status'

const router = Router()

async function resolveToken(projectId: unknown): Promise<string | null> {
  if (!projectId || typeof projectId !== 'string') return null
  return ProjectService.getProjectToken(projectId)
}

// GET /api/github/user?projectId=...
router.get('/user', async (req: Request, res: Response) => {
  try {
    const token = await resolveToken(req.query.projectId)
    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'projectId query parameter is required and must have a GitHub token configured' })
    }
    const user = await GithubService.getAuthenticatedUser(token)
    res.json(user)
  } catch (error: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message })
  }
})

// GET /api/github/repos?projectId=...
router.get('/repos', async (req: Request, res: Response) => {
  try {
    const token = await resolveToken(req.query.projectId)
    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'projectId query parameter is required and must have a GitHub token configured' })
    }
    const repos = await GithubService.getUserRepos(token)
    res.json(repos)
  } catch (error: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message })
  }
})

// GET /api/github/branches?repo_name=owner/repo&projectId=...
router.get('/branches', async (req: Request, res: Response) => {
  try {
    const { repo_name, projectId } = req.query
    if (!repo_name || typeof repo_name !== 'string') {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'repo_name query parameter is required' })
    }
    const token = await resolveToken(projectId)
    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'projectId query parameter is required and must have a GitHub token configured' })
    }
    const branches = await GithubService.getBranches(repo_name, token)
    res.json(branches)
  } catch (error: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message })
  }
})

// POST /api/github/branches
router.post('/branches', async (req: Request, res: Response) => {
  try {
    const { repo_name, new_branch, from_branch, projectId } = req.body
    if (!repo_name || !new_branch || !from_branch) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'repo_name, new_branch, and from_branch are required' })
    }
    const token = await resolveToken(projectId)
    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'projectId is required and must have a GitHub token configured' })
    }
    await GithubService.createBranch(repo_name, new_branch, from_branch, token)
    res.status(HttpStatus.CREATED).json({ message: `Branch ${new_branch} created successfully` })
  } catch (error: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message })
  }
})

// DELETE /api/github/branches?repo_name=owner/repo&branch_name=name&projectId=...
router.delete('/branches', async (req: Request, res: Response) => {
  try {
    const { repo_name, branch_name, projectId } = req.query
    if (!repo_name || typeof repo_name !== 'string') {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'repo_name query parameter is required' })
    }
    if (!branch_name || typeof branch_name !== 'string') {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'branch_name query parameter is required' })
    }
    const token = await resolveToken(projectId)
    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'projectId query parameter is required and must have a GitHub token configured' })
    }
    await GithubService.deleteBranch(repo_name, branch_name, token)
    res.json({ message: `Branch ${branch_name} deleted successfully` })
  } catch (error: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message })
  }
})

export default router
