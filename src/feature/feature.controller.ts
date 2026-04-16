import { Response, NextFunction } from 'express'
import { AuthRequest } from '../common/middleware/auth.middleware'
import { featureService } from './feature.service'
import { HttpStatus } from '../common/constants/http-status'
import { FeatureStatus, FEATURE_TYPES } from './feature.model'
import { ProjectService } from '../project/project.service'

export const featureController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { title, description, criteria, projectId, type } = req.body
      if (!title || !description || !criteria) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ message: "title, description, and criteria are required" });
      }
      if (projectId) {
        const exists = await ProjectService.exists(projectId);
        if (!exists) {
          return res.status(404).json({ message: "Project not found" });
        }
      }
      const actor = { id: req.user!.sub, email: req.user!.email }
      const feature = await featureService.create(title, description, criteria, actor, type || 'task', projectId)
      res.status(HttpStatus.CREATED).json(feature)
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    // eslint-disable-line @typescript-eslint/no-unused-vars
    try {
      const feature = await featureService.getById(req.params.id);
      res.json(feature);
    } catch (err) {
      next(err);
    }
  },

  async listAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.query;
      const features = projectId
        ? await featureService.listByProject(projectId as string)
        : await featureService.listAll();
      res.json(features);
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      if (!status)
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ message: "status is required" });
      const actor = { id: req.user!.sub, email: req.user!.email };
      const feature = await featureService.updateStatus(
        req.params.id,
        status as FeatureStatus,
        actor,
      );
      res.json(feature);
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { title, description, criteria } = req.body;

      // At least one field must be provided
      if (!title && !description && !criteria) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message:
            "At least one field (title, description, or criteria) is required",
        });
      }

      const feature = await featureService.update(req.params.id, {
        title,
        description,
        criteria,
      });
      res.json(feature);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await featureService.delete(req.params.id);
      res.status(HttpStatus.OK).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getTypes(_req: AuthRequest, res: Response) {
    try {
      res.json(FEATURE_TYPES)
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to get feature types', error: error.message })
    }
  }
};


