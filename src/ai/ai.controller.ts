import { Request, Response, NextFunction } from 'express'
import { generateQaTestCases, regenerateQaTestCases, approveQaTestCases } from './orchestrators/qa.orchestrator'

export async function generateQa(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const result = await generateQaTestCases(featureId)
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

export async function approveQa(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const result = await approveQaTestCases(featureId)
        res.json(result)
    } catch (err) {
        next(err)
    }
}
