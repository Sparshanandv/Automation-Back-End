import { Request, Response, NextFunction } from 'express'
import { generateQaTestCases } from './orchestrators/qa.orchestrator'
import { executeFeatureImplementation } from './orchestrators/execute.orchestrator'

export async function generateQa(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const result = await generateQaTestCases(featureId)
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
