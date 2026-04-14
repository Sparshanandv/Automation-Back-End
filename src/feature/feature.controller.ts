import { Response, NextFunction } from 'express'
import { AuthRequest } from '../common/middleware/auth.middleware'
import { featureService } from './feature.service'
import { FeatureStatus } from './feature.model'

export const featureController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { title, description, criteria } = req.body
      if (!title || !description || !criteria) {
        return res.status(400).json({ message: 'title, description, and criteria are required' })
      }
      const actor = { id: req.user!.sub, email: req.user!.email }
      const feature = await featureService.create(title, description, criteria, actor)
      res.status(201).json(feature)
    } catch (err) {
      next(err)
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) { // eslint-disable-line @typescript-eslint/no-unused-vars
    try {
      const feature = await featureService.getById(req.params.id)
      res.json(feature)
    } catch (err) {
      next(err)
    }
  },

  async listAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const features = await featureService.listAll()
      res.json(features)
    } catch (err) {
      next(err)
    }
  },

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body
      if (!status) return res.status(400).json({ message: 'status is required' })
      const actor = { id: req.user!.sub, email: req.user!.email }
      const feature = await featureService.updateStatus(req.params.id, status as FeatureStatus, actor)
      res.json(feature)
    } catch (err) {
      next(err)
    }
  },
}
