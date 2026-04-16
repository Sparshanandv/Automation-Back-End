import path from 'path'
import { Response } from 'express'
import { AuthRequest } from '../common/middleware/auth.middleware'
import { ProjectService } from './project.service'
import { GithubService } from '../github/github.service'
import { HttpStatus } from '../common/constants/http-status'

export class ProjectController {
  static async listProjects(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const projects = await ProjectService.getProjects(userId)
      res.json(projects)
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to list projects', error: error.message })
    }
  }

  static async getProject(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const { id } = req.params

      const project = await ProjectService.getProjectById(id, userId)
      if (!project) {
        res.status(HttpStatus.NOT_FOUND).json({ message: 'Project not found' })
        return
      }

      const token = project.githubToken as string | undefined

      // Verify each repository against GitHub (skip if no token configured)
      const validRepos = []
      for (const repo of project.repos) {
        if (token) {
          const hasAccess = await GithubService.validateRepoAccess(repo.repo_name, token)
          if (hasAccess) {
            validRepos.push(repo)
          } else {
            await ProjectService.deleteRepository(id, repo._id.toString())
          }
        } else {
          validRepos.push(repo)
        }
      }
      project.repos = validRepos

      res.json(project)
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to get project', error: error.message })
    }
  }

  static async createProject(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const email = req.user?.email as string
      const { name, description, githubToken } = req.body

      if (!name) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Project name is required' })
        return
      }

      const project = await ProjectService.createProject(userId, name, description, githubToken, email)
      res.status(HttpStatus.CREATED).json(project)
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create project', error: error.message })
    }
  }

  static async addRepository(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const { id } = req.params
      const { repo_name, branch, purpose, createNew, description, isPrivate } = req.body

      if (!repo_name || !branch || !purpose) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'repo_name, branch, and purpose are required' })
        return
      }

      const project = await ProjectService.getProjectById(id, userId)
      if (!project) {
        res.status(HttpStatus.NOT_FOUND).json({ message: 'Project not found' })
        return
      }

      const token = project.githubToken as string | undefined
      if (!token) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'This project has no GitHub token configured. Please update the project with a valid GitHub token.' })
        return
      }

      let finalRepoName = repo_name

      if (createNew) {
        try {
          finalRepoName = await GithubService.createRepository(token, repo_name, description || '', !!isPrivate, branch)
        } catch (githubErr: any) {
          res.status(HttpStatus.BAD_REQUEST).json({ message: githubErr.message || 'Failed to create new repository on GitHub.' })
          return
        }
      } else {
        const isLinked = await ProjectService.isRepositoryLinked(repo_name)
        if (isLinked) {
          res.status(HttpStatus.BAD_REQUEST).json({ message: 'Repository already linked to another project.' })
          return
        }

        const hasAccess = await GithubService.validateRepoAccess(repo_name, token)
        if (!hasAccess) {
          res.status(HttpStatus.BAD_REQUEST).json({ message: `Cannot access GitHub repository: ${repo_name}. Ensure it exists and the token has access.` })
          return
        }
      }

      const baseDir = process.env.LOCAL_REPO_PATH || ''
      const projectNameSafe = project.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      const repoNameOnly = finalRepoName.split('/').pop() || finalRepoName
      const localPath = path.join(baseDir, projectNameSafe, repoNameOnly)

      const repo = await ProjectService.addRepository(id, finalRepoName, branch, purpose, localPath)

      // Clone in background — never block the response
      GithubService.cloneRepository(finalRepoName, localPath, token).catch((err) => {
        console.error(`[git clone] Failed to clone ${finalRepoName} to ${localPath}:`, err.message)
      })

      res.status(HttpStatus.CREATED).json(repo)
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to add repository', error: error.message })
    }
  }

  static async removeRepository(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const { id, repoId } = req.params

      const project = await ProjectService.getProjectById(id, userId)
      if (!project) {
        res.status(HttpStatus.NOT_FOUND).json({ message: 'Project not found' })
        return
      }

      const repo = project.repos.find(r => r._id.toString() === repoId)
      if (!repo) {
        res.status(HttpStatus.NOT_FOUND).json({ message: 'Repository not found in this project' })
        return
      }

      // Only attempt GitHub deletion if the project has a token
      const token = project.githubToken as string | undefined
      if (token) {
        await GithubService.deleteRepository(repo.repo_name, token)
      }

      await ProjectService.deleteRepository(id, repoId)
      res.json({ message: 'Repository unlinked successfully' })
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to remove repository', error: error.message })
    }
  }

  static async deleteProject(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const { id } = req.params

      const project = await ProjectService.deleteProject(id, userId)
      if (!project) {
        res.status(HttpStatus.NOT_FOUND).json({ message: 'Project not found' })
        return
      }

      res.json({ message: 'Project deleted successfully' })
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to delete project', error: error.message })
    }
  }

  static async updateReadmeInRepo(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.sub as string
      const { id, repoId } = req.params
      const { commitMessage } = req.body
      const file = req.file
  
      if (!file) {
        return res.status(HttpStatus.BAD_REQUEST).json({ message: 'README file is required' })
      }
  
      const content = file.buffer.toString('utf-8')
  
      const project = await ProjectService.getProjectById(id, userId)
      if (!project) {
        return res.status(HttpStatus.NOT_FOUND).json({
          message: 'Project not found'
        })
      }

      const token = project.githubToken || process.env.GITHUB_TOKEN
      if (!token) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message:
            'This project has no GitHub token configured. Please update the project with a valid GitHub token.',
        })
      }

      const repo = project.repos.find(r => r._id.toString() === repoId)
      if (!repo) {
        return res.status(HttpStatus.NOT_FOUND).json({
          message: 'Repository not found in this project',
        })
      }

      const hasAccess = await GithubService.validateRepoAccess(repo.repo_name, token)
      if (!hasAccess) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: `Cannot access GitHub repository: ${repo.repo_name}. Ensure the name is owner/repo, the repo exists, and the token has access.`,
        })
      }

      await GithubService.updateReadme(
        repo.repo_name,
        repo.branch,
        content,
        commitMessage || 'Update README via file upload',
        token
      )
  
      return res.json({
        message: 'README updated successfully'
      })
  
    } catch (error: any) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to update readme in project',
        error: error.message
      })
    }
  }
}
