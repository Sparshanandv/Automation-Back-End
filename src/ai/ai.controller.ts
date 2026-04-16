import { Request, Response, NextFunction } from 'express'
import { approveQaTestCases, generateQaTestCases, regenerateQaTestCases } from './orchestrators/qa.orchestrator'
import { generateDevPlan, approvePlan, rejectPlan } from './orchestrators/plan.orchestrator'
import { executeFeatureImplementation } from './orchestrators/execute.orchestrator'
import { TestCase } from './models/test-case.model'
import { AuthRequest } from '../common/middleware/auth.middleware'
import { HttpError } from '../common/errors/http-error'
import { Plan } from './models/plan.model'
import { CodeGeneration } from './models/code-generation.model'
import { PullRequest } from './models/pull-request.model'
import { Feature } from '../feature/feature.model'

export async function generateQa(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const result = await generateQaTestCases(featureId)
        res.json(result)
    } catch (err) {
        next(err)
    }
}

export async function getQaResults(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        let result = await TestCase.findOne({ feature_id: featureId })

        // Demo fallback for UI visualization
        if (!result) {
            return res.json({
                feature_id: featureId,
                content: [
                    { id: "TC-1", description: "Verify user can login with valid credentials" },
                    { id: "TC-2", description: "Verify error message on invalid password" },
                    { id: "TC-3", description: "Verify authentication token is stored in localStorage" }
                ]
            })
        }
        res.json(result)
    } catch (err) {
        next(err)
    }
}

export async function regenerateQa(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const { promptToRegenerateQa } = req.body

        const result = await regenerateQaTestCases(featureId, promptToRegenerateQa)
        res.json(result)
    } catch (err) {
        next(err)
    }
}

export async function getPlan(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const result = await Plan.findOne({ feature_id: featureId })
        res.json(result)
    } catch (err) {
        next(err)
    }
}

export async function approveQa(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const result = await approveQaTestCases(featureId)
        res.json(result)
    } catch (err) {
        next(err)
    }
}

export async function executeFeature(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const result = await executeFeatureImplementation(featureId)
        res.json(result)
    } catch (err) {
        next(err)
    }
}

export async function getCodeGeneration(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const codeGen = await CodeGeneration.findOne({ feature_id: featureId })

        if (!codeGen) {
            return res.status(404).json({ message: 'No code generation found for this feature' })
        }

        res.json({
            featureId: codeGen.feature_id,
            sessionId: codeGen.sessionId,
            result: codeGen.result,
        })
    } catch (err) {
        next(err)
    }
}

export async function generatePlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const { testCases, userStory, optionalPrompt } = req.body

        if (!Array.isArray(testCases)) {
            res.status(400).json({ message: 'testCases must be an array' })
            return
        }
        if (!userStory || typeof userStory !== 'string' || userStory.trim() === '') {
            res.status(400).json({ message: 'userStory is required and must be a non-empty string' })
            return
        }
        if (optionalPrompt !== undefined && typeof optionalPrompt !== 'string') {
            res.status(400).json({ message: 'optionalPrompt must be a string if provided' })
            return
        }

        const plan = await generateDevPlan(featureId, {
            testCases,
            userStory: userStory.trim(),
            optionalPrompt: optionalPrompt?.trim(),
        })

        res.json({ plan })
    } catch (err) {
        next(err)
    }
}

export async function approvePlanController(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const actor = { id: req.user!.sub, email: req.user!.email }
        const result = await approvePlan(featureId, actor)
        res.json(result)
    } catch (err) {
        next(err)
    }
}

export async function rejectPlanController(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const actor = { id: req.user!.sub, email: req.user!.email }
        const result = await rejectPlan(featureId, actor)
        res.json(result)
    } catch (err) {
        next(err)
    }
}

export async function getPlanController(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const plan = await Plan.findOne({ feature_id: featureId })
        if (!plan) throw new HttpError(404, 'No plan found for this feature')
        res.json({ plan: plan.content })
    } catch (err) {
        next(err)
    }
}

export async function getPullRequest(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const pr = await PullRequest.findOne({ feature_id: featureId })

        if (!pr) {
            return res.status(404).json({ message: 'No pull request found for this feature' })
        }

        res.json(pr)
    } catch (err) {
        next(err)
    }
}

export async function getAllPullRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        // Optional: filter by project
        const { projectId } = req.query

        let query = {}
        if (projectId) {
            // Get all features for this project
            const features = await Feature.find({ projectId })
            const featureIds = features.map(f => f._id)
            query = { feature_id: { $in: featureIds } }
        }

        const prs = await PullRequest.find(query)
            .populate('feature_id', 'title status')
            .sort({ createdAt: -1 })

        res.json(prs)
    } catch (err) {
        next(err)
    }
}
