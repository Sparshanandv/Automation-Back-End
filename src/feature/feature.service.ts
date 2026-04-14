import { Feature, FeatureStatus, FeatureStatusEnum } from './feature.model'
import { isValidTransition } from './feature.state-machine'

interface Actor {
  id: string
  email: string
}

export const featureService = {
  async create(title: string, description: string, criteria: string, actor: Actor) {
    const feature = new Feature({
      title,
      description,
      criteria,
      status: FeatureStatusEnum.CREATED,
      statusHistory: [{ status: FeatureStatusEnum.CREATED, changedBy: actor, changedAt: new Date() }],
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
