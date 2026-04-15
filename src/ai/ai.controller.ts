import { Request, Response, NextFunction } from 'express'
import { approveQaTestCases, generateQaTestCases, regenerateQaTestCases } from './orchestrators/qa.orchestrator'
import { generateDevPlan } from './orchestrators/plan.orchestrator'
import { TestCase } from './models/test-case.model'
import { Plan } from './models/plan.model'

export async function generateQa(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const result = await generateQaTestCases(featureId)
        res.json(result)
    } catch (err) {
        next(err)
    }
}

export async function getQaTestCases(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const result = await TestCase.findOne({ feature_id: featureId })
        if (!result) {
            return res.status(404).json({ message: 'Test cases not found' })
        }
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

export async function generatePlan(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const { refinement } = req.body
        const result = await generateDevPlan(featureId, refinement)
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
