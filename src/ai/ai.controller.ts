import { Request, Response, NextFunction } from 'express'
import { generateQaTestCases } from './orchestrators/qa.orchestrator'

export async function generateQa(req: Request, res: Response, next: NextFunction) {
    try {
        const { featureId } = req.params
        const result = await generateQaTestCases(featureId)
        res.json(result)
    } catch (err) {
        next(err)
    }
}
