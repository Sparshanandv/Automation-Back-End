import { Feature, FeatureStatus, FeatureStatusEnum } from './feature.model'
import { isValidTransition } from './feature.state-machine'
import { Project } from '../project/project.model'

interface Actor {
  id: string
  email: string
}

async function generateFeatureKey(projectId?: string): Promise<string> {
  if (projectId) {
    const project = await Project.findById(projectId)
    const prefix = project
      ? project.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase().padEnd(4, 'X')
      : 'TASK'
    const count = await Feature.countDocuments({ projectId })
    return `${prefix}-${count + 1}`
  }
  const count = await Feature.countDocuments({ projectId: null })
  return `TASK-${count + 1}`
}

export const featureService = {
  async create(title: string, description: string, criteria: string, actor: Actor, projectId?: string) {
    const featureKey = await generateFeatureKey(projectId)
    const feature = new Feature({
      featureKey,
      title,
      description,
      criteria,
      status: FeatureStatusEnum.CREATED,
      statusHistory: [{ status: FeatureStatusEnum.CREATED, changedBy: actor, changedAt: new Date() }],
      ...(projectId && { projectId }),
    })
    return feature.save()
  },

  async getById(id: string) {
    const feature = await Feature.findById(id)
    if (!feature) throw Object.assign(new Error('Feature not found'), { status: 404 })
    return feature
  },

  async listAll() {
    return Feature.find().sort({ createdAt: -1 })
  },

  async listByProject(projectId: string) {
    return Feature.find({ projectId }).sort({ createdAt: -1 })
  },

  async updateStatus(id: string, to: FeatureStatus, actor: Actor) {
    const feature = await featureService.getById(id)
    if (!isValidTransition(feature.status as FeatureStatus, to)) {
      throw Object.assign(
        new Error(`Invalid transition: ${feature.status} → ${to}. Only the next sequential status is allowed.`),
        { status: 400 }
      )
    }
    feature.status = to
    feature.statusHistory.push({ status: to, changedBy: actor, changedAt: new Date() })
    return feature.save()
  },
}
