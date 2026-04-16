import path from 'path'
import { HttpError } from '../../common/errors/http-error'
import { runClaudeCode } from '../../common/utils/claude-code.executor'
import { Feature, FeatureStatusEnum } from '../../feature/feature.model'
import { isValidTransition, isValidRejection } from '../../feature/feature.state-machine'
import { Plan } from '../models/plan.model'
import { TestCase } from '../models/test-case.model'
import { buildPlanPrompt } from '../prompts/plan.prompt'
import * as bedrockClient from '../bedrock.client'
import { parseAiJson } from '../ai.utils'
import { Project } from '../../project/project.model'

const TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

interface Actor {
    id: string
    email: string
}

// ─── Generate ──────────────────────────────────────────────────────────────────

export async function generateDevPlan(
    featureId: string,
    input: { testCases: unknown[]; userStory: string; optionalPrompt?: string }
): Promise<string> {
    const feature = await Feature.findById(featureId)
    if (!feature) throw new HttpError(404, 'Feature not found')

if (feature.status !== FeatureStatusEnum.QA_APPROVED && feature.status !== FeatureStatusEnum.DEV) {
        throw new HttpError(
            400,
            `Feature must be in QA_APPROVED or DEV status to generate a dev plan. Current status: ${feature.status}`
        )
    }

    // Fetch test cases from database instead of using request body
    const testCaseDoc = await TestCase.findOne({ feature_id: featureId })
    const testCases = testCaseDoc?.content || []

    // Use fetched test cases from DB, not the ones from request body
    const prompt = buildPlanPrompt({
        ...input,
        testCases: testCases
    })

        const project=await Project.findOne({_id: feature.projectId})
        if(!project){
            throw new HttpError(404, 'Project not found for this feature')
        }
    // Resolve monorepo root: works from both ts-node (src/) and compiled (dist/) contexts
    const projectRoot = `${process.env.LOCAL_REPO_PATH}/${project.name}`

    let planResult: unknown
    let sessionId: string

    try {
        const response = await runClaudeCode(prompt, {
            cwd: projectRoot,
            timeoutMs: TIMEOUT_MS, // Keep 5-minute timeout
        })
        planResult = response.result
        sessionId = response.sessionId
    } catch (err: any) {
        // Convert generic errors to HttpError for consistent API responses
        if (err.message?.includes('timed out')) {
            throw new HttpError(504, `Plan generation timed out after ${TIMEOUT_MS / 1000} seconds`)
        } else if (err.message?.includes('not found')) {
            throw new HttpError(
                500,
                'Claude CLI not found. Ensure `claude` is installed and available on PATH.'
            )
        } else {
            throw new HttpError(500, `Failed to generate plan: ${err.message}`)
        }
    }

    // Convert result to string if it's not already
    const planText = typeof planResult === 'string' ? planResult : JSON.stringify(planResult)

   const plan = await Plan.findOneAndUpdate(
        { feature_id: featureId },
        {
            feature_id: featureId,
            content: planText,
            sessionId: sessionId,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    if (isValidTransition(feature.status, FeatureStatusEnum.DEV)) {
        feature.status = FeatureStatusEnum.DEV
        feature.statusHistory.push({
            status: FeatureStatusEnum.DEV,
            changedBy: { id: 'system', email: 'system' },
            changedAt: new Date(),
        })
        await feature.save()
    }
    console.log("plan objext________",plan)
    console.log("plan text__________________",planText)
    return planText
}

// ─── Approve ───────────────────────────────────────────────────────────────────

export async function approvePlan(featureId: string, actor: Actor) {
    const feature = await Feature.findById(featureId)
    if (!feature) throw new HttpError(404, 'Feature not found')

    if (feature.status !== FeatureStatusEnum.DEV) {
        throw new HttpError(
            400,
            `Feature must be in DEV status to approve the plan. Current status: ${feature.status}`
        )
    }

    const plan = await Plan.findOne({ feature_id: featureId })
    if (!plan) throw new HttpError(404, 'No plan found for this feature. Generate a plan first.')

    feature.status = FeatureStatusEnum.PLAN_APPROVED
    feature.statusHistory.push({
        status: FeatureStatusEnum.PLAN_APPROVED,
        changedBy: actor,
        changedAt: new Date(),
    })
    await feature.save()

    return { message: 'Plan approved', featureId }
}

// ─── Reject ────────────────────────────────────────────────────────────────────

export async function rejectPlan(featureId: string, actor: Actor) {
    const feature = await Feature.findById(featureId)
    if (!feature) throw new HttpError(404, 'Feature not found')

    if (feature.status !== FeatureStatusEnum.DEV) {
        throw new HttpError(
            400,
            `Feature must be in DEV status to reject the plan. Current status: ${feature.status}`
        )
    }

    await Plan.deleteOne({ feature_id: featureId })

    if (isValidRejection(feature.status, FeatureStatusEnum.QA_APPROVED)) {
        feature.status = FeatureStatusEnum.QA_APPROVED
        feature.statusHistory.push({
            status: FeatureStatusEnum.QA_APPROVED,
            changedBy: actor,
            changedAt: new Date(),
        })
        await feature.save()
    }

    return { message: 'Plan rejected', featureId }
}
