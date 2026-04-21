import fs from 'fs'
import { HttpError } from '../../common/errors/http-error'
import { Feature, FeatureStatusEnum } from '../../feature/feature.model'
import { isValidTransition, isValidRejection } from '../../feature/feature.state-machine'
import { Plan } from '../models/plan.model'
import { TestCase } from '../models/test-case.model'
import { buildPlanPrompt } from '../prompts/plan.prompt'
import * as bedrockClient from '../bedrock.client'
import { Project, Repository } from '../../project/project.model'
import { resolveLocalRepoPath, getRepositoryContext, formatRepositoryContext } from '../../common/utils/local-repo-snapshot'

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

    // Get repository context for better planning
    let repoContext: string | undefined
    if (feature.projectId) {
        try {
            const project = await Project.findById(feature.projectId)
            if (project) {
                const repos = await Repository.find({ projectId: feature.projectId }).lean()
                const repoPath = resolveLocalRepoPath({ name: project.name as string }, repos)

                if (fs.existsSync(repoPath)) {
                    console.log(`[Plan] Reading repository context from: ${repoPath}`)
                    const context = getRepositoryContext(repoPath)
                    repoContext = formatRepositoryContext(context)
                    console.log(`[Plan] Scanned ${context.totalFilesScanned} files, ${context.totalCharacters} characters`)
                } else {
                    console.warn(`[Plan] Repository path not found: ${repoPath}`)
                }
            }
        } catch (err) {
            console.warn('[Plan] Could not load repository context:', err)
        }
    }

    // Use fetched test cases from DB and repository context
    const prompt = buildPlanPrompt({
        ...input,
        testCases: testCases,
        repoContext
    })

    let planText: string

    try {
        // Use Bedrock API directly — fast (~30-60s), no subprocess, no git side effects
        planText = await bedrockClient.invoke(prompt)
        if (!planText) throw new Error('Empty response from Bedrock')
    } catch (err: any) {
        throw new HttpError(500, `Failed to generate plan: ${err.message}`)
    }

    const plan = await Plan.findOneAndUpdate(
        { feature_id: featureId },
        {
            feature_id: featureId,
            content: planText,
            status: 'completed',
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
