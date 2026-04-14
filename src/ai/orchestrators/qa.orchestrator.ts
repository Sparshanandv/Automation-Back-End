import { HttpError } from '../../common/errors/http-error'
import { Feature } from '../../feature/feature.model'
import { isValidTransition } from '../../feature/feature.state-machine'
import { TestCase } from '../models/test-case.model'
import { buildQaPrompt } from '../prompts/qa.prompt'
import * as bedrockClient from '../bedrock.client'

export async function generateQaTestCases(featureId: string) {
    const feature = await Feature.findById(featureId)
    if (!feature) {
        throw new HttpError(404, 'Feature not found')
    }

    if (feature.status !== 'CREATED') {
        throw new HttpError(400, `Feature must be in CREATED status to generate QA test cases. Current status: ${feature.status}`)
    }

    const prompt = buildQaPrompt({
        title: feature.title as string,
        description: feature.description as string,
        criteria: feature.criteria as string,
    })

    const raw = await bedrockClient.invoke(prompt)

    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new HttpError(400, 'AI returned invalid JSON')
    }

    const testCase = await TestCase.findOneAndUpdate(
        { feature_id: featureId },
        { feature_id: featureId, content: parsed },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    if (isValidTransition(feature.status, 'QA')) {
        feature.status = 'QA'
        feature.statusHistory.push({
            status: 'QA',
            changedBy: { id: 'system', email: 'system' },
            changedAt: new Date(),
        })
    }
    await feature.save()

    return testCase
}
