import { Response } from 'express'
import { AuthRequest } from '../common/middleware/auth.middleware'
import { ProjectService } from './project.service'
import { GithubService } from '../github/github.service'

export class ProjectController {
  static async listProjects(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const projects = await ProjectService.getProjects(userId)
      res.json(projects)
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list projects', error: error.message })
    }
  }

  static async getProject(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const { id } = req.params

      const project = await ProjectService.getProjectById(id, userId)
      if (!project) {
        res.status(404).json({ message: 'Project not found' })
        return
      }
      res.json(project)
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get project', error: error.message })
    }
  }

  static async createProject(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const { name, description } = req.body

      if (!name) {
        res.status(400).json({ message: 'Project name is required' })
        return
      }

      const project = await ProjectService.createProject(userId, name, description)
      res.status(201).json(project)
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to create project', error: error.message })
    }
  }

  static async addRepository(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const { id } = req.params
      const { repo_name, branch, purpose } = req.body

      if (!repo_name || !branch || !purpose) {
        res.status(400).json({ message: 'repo_name, branch, and purpose are required' })
        return
      }

      const project = await ProjectService.getProjectById(id, userId)
      if (!project) {
        res.status(404).json({ message: 'Project not found' })
        return
      }

      // Validate GitHub repo access
      const hasAccess = await GithubService.validateRepoAccess(repo_name)
      if (!hasAccess) {
        res.status(400).json({ message: `Cannot access GitHub repository: ${repo_name}. Ensure it is public or you have configured GITHUB_TOKEN properly.` })
        return
      }

      const repo = await ProjectService.addRepository(id, repo_name, branch, purpose)
      res.status(201).json(repo)
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to add repository', error: error.message })
    }
  }

  static async removeRepository(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const { id, repoId } = req.params

      const project = await ProjectService.getProjectById(id, userId)
      if (!project) {
        res.status(404).json({ message: 'Project not found' })
        return
      }

      const repo = await ProjectService.deleteRepository(id, repoId)
      if (!repo) {
        res.status(404).json({ message: 'Repository not found in this project' })
        return
      }

      res.json({ message: 'Repository removed successfully' })
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to remove repository', error: error.message })
    }
  }
}
