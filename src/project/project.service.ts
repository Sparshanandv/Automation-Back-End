import { Project, Repository } from './project.model'
import { Types } from 'mongoose'

export class ProjectService {
  static async getProjects(userId: string) {
    return Project.find({ userId }).sort({ createdAt: -1 })
  }

  static async getProjectById(projectId: string, userId: string) {
    const project = await Project.findOne({ _id: projectId, userId })
    if (!project) return null

    const repos = await Repository.find({ projectId }).sort({ createdAt: -1 })
    return { ...project.toObject(), repos }
  }

  static async createProject(userId: string, name: string, description?: string) {
    const project = new Project({ name, description, userId })
    await project.save()
    return project
  }

  static async addRepository(
    projectId: string,
    repo_name: string,
    branch: string,
    purpose: string
  ) {
    const repo = new Repository({ projectId, repo_name, branch, purpose })
    await repo.save()
    return repo
  }

  static async deleteRepository(projectId: string, repoId: string) {
    const repo = await Repository.findOneAndDelete({ _id: repoId, projectId })
    return repo
  }

  static async deleteProject(projectId: string, userId: string) {
    const project = await Project.findOneAndDelete({ _id: projectId, userId })
    if (project) {
      await Repository.deleteMany({ projectId })
    }
    return project
  }
}
