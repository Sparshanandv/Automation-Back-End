import { HttpError } from '../../common/errors/http-error'
import { Feature, FeatureStatusEnum, IFeature } from '../../feature/feature.model'
import { isValidTransition } from '../../feature/feature.state-machine'
import { TestCase } from '../models/test-case.model'
import { buildQaPrompt, buildQaRegenerationPrompt } from '../prompts/qa.prompt'
import * as bedrockClient from '../bedrock.client'


async function callAi(prompt: string): Promise<any> {
    const raw = await bedrockClient.invoke(prompt)
    try {
        return JSON.parse(raw)
    } catch {
        throw new HttpError(400, 'AI returned invalid JSON')
    }
}

async function getValidatedFeature(featureId: string): Promise<IFeature> {
    const feature = await Feature.findById(featureId)
    if (!feature) {
        throw new HttpError(404, 'Feature not found')
    }
    return feature
}

async function saveAndProgressFeature(feature: IFeature, content: any): Promise<any> {
    const featureId = feature._id

    const testCase = await TestCase.findOneAndUpdate(
        { feature_id: featureId },
        { feature_id: featureId, content },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    if (isValidTransition(feature.status, FeatureStatusEnum.QA)) {
        feature.status = FeatureStatusEnum.QA
        feature.statusHistory.push({
            status: FeatureStatusEnum.QA,
            changedBy: { id: 'system', email: 'system' },
            changedAt: new Date(),
        })
        await feature.save()
    }

    return testCase
}

export async function generateQaTestCases(featureId: string) {
    const feature = await getValidatedFeature(featureId)

    if (feature.status !== FeatureStatusEnum.CREATED) {
        throw new HttpError(400, `Feature must be in CREATED status to generate QA test cases. Current status: ${feature.status}`)
    }

    const prompt = buildQaPrompt({
        title: feature.title,
        description: feature.description,
        criteria: feature.criteria,
    })

    const parsed = await callAi(prompt)
    return saveAndProgressFeature(feature, parsed)
}

export async function regenerateQaTestCases(featureId: string, promptToRegenerateQa: string) {
    const feature = await getValidatedFeature(featureId)

    
    if (feature.status !== FeatureStatusEnum.QA) {
        throw new HttpError(400, `Feature must be in QA status to regenerate test cases. Current status: ${feature.status}`)
    }

    
    const existingTestCase = await TestCase.findOne({ feature_id: featureId })
    const previousContent = existingTestCase?.content || []

    const prompt = buildQaRegenerationPrompt(
        {
            title: feature.title,
            description: feature.description,
            criteria: feature.criteria,
        },
        previousContent,
        promptToRegenerateQa
    )

    const parsed = await callAi(prompt)
    return saveAndProgressFeature(feature, parsed)
}
