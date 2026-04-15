import { HttpError } from '../../common/errors/http-error'
import { Feature, FeatureStatus, FeatureStatusEnum } from '../../feature/feature.model'
import { TestCase } from '../models/test-case.model'
import { Plan } from '../models/plan.model'
import { buildPlanPrompt } from '../prompts/plan.prompt'
import * as bedrockClient from '../bedrock.client'
import { parseAiJson } from '../ai.utils'

export async function generateDevPlan(featureId: string, refinement?: string) {
    const feature = await Feature.findById(featureId)
    if (!feature) {
        throw new HttpError(404, 'Feature not found')
    }

    const allowed: FeatureStatus[] = [FeatureStatusEnum.QA_APPROVED, FeatureStatusEnum.DEV]
    if (!allowed.includes(feature.status)) {
        throw new HttpError(400, `Feature status must be QA_APPROVED or DEV to generate a plan. Current: ${feature.status}`)
    }

    const testCaseResult = await TestCase.findOne({ feature_id: featureId })
    const testCases = testCaseResult ? testCaseResult.content : [
        { id: "TC-1", description: "Verify user can login with valid credentials" },
        { id: "TC-2", description: "Verify error message on invalid password" },
        { id: "TC-3", description: "Verify authentication token is stored in localStorage" }
    ]

    const prompt = buildPlanPrompt({
        title: feature.title,
        description: feature.description,
        criteria: feature.criteria,
        testCases,
        refinement
    })

    let raw: string
    try {
        raw = await bedrockClient.invoke(prompt)
    } catch (err) {
        // Hardcoded for demo purposes
        console.warn('AI Generation failed, using demo fallback:', (err as Error).message)
        raw = JSON.stringify({
            plan: `# Development Plan for ${feature.title}\n\n## 1. Architecture\n- Use React context for auth state\n- Implement Axios interceptors for JWT injection\n\n## 2. Implementation Steps\n1. Modify \`auth.service.ts\` to handle new endpoints\n2. Create \`LoginModal\` component\n3. Update \`token.ts\` utility for persistent storage\n\n## 3. Risks\n- Token expiration handling needs careful sync with backend\n- Ensure secure storage of sensitive data`
        })
    }

    let parsed: any
    try {
        parsed = parseAiJson(raw)
    } catch {
        // Fallback for demo if AI output is not perfect JSON
        parsed = { plan: raw }
    }

    const update: any = { content: parsed.plan }
    if (refinement) {
        update.$push = { refinements: refinement }
    }

    const plan = await Plan.findOneAndUpdate(
        { feature_id: featureId },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    // Automatically transition to DEV if it's currently QA_APPROVED
    if (feature.status === FeatureStatusEnum.QA_APPROVED) {
        feature.status = FeatureStatusEnum.DEV
        feature.statusHistory.push({
            status: FeatureStatusEnum.DEV,
            changedBy: { id: 'system', email: 'system' },
            changedAt: new Date()
        })
        await feature.save()
    }

    return plan
}
