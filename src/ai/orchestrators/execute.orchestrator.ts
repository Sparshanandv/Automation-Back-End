import { HttpError } from '../../common/errors/http-error'
import { Feature } from '../../feature/feature.model'
import { runClaudeCode } from '../../common/utils/claude-code.executor'
import { Plan } from '../models/plan.model'
import { CodeGeneration } from '../models/code-generation.model'
import { Project } from '../../project/project.model'

export async function executeFeatureImplementation(featureId: string) {
    const feature = await Feature.findById(featureId)
    if (!feature) {
        throw new HttpError(404, 'Feature not found')
    }

    // Check if code generation already exists
    const existingCodeGen = await CodeGeneration.findOne({ feature_id: featureId })
    if (existingCodeGen) {
        return {
            featureId,
            sessionId: existingCodeGen.sessionId,
            result: existingCodeGen.result,
        }
    }

    const plan = await Plan.findOne({ feature_id: featureId })
    if (!plan) {
        throw new HttpError(404, 'Plan not found for this feature')
    }

    const repoPath = process.env.LOCAL_REPO_PATH
    if (!repoPath) {
        throw new HttpError(500, 'LOCAL_REPO_PATH environment variable is not configured')
    }

    const prompt = buildPrompt({
        featureTitle: feature.title as string,
        planContent: plan?.content,
    })

    // Get project name for branch creation
    const project = feature.projectId
        ? await Project.findById(feature.projectId)
        : null
    const projectName = project?.name || 'automation'
    const featureTitle = feature.title || 'feature'

    const { result, sessionId } = await runClaudeCode(prompt, {
        cwd: repoPath,
        projectName,
        featureTitle
    })

    // Parse result if it's a JSON string
    let parsedResult = result
    if (typeof result === 'string') {
        try {
            // Try to extract JSON from markdown code fences or other formatting
            parsedResult = extractJsonFromString(result)
        } catch (err) {
            throw new HttpError(500, `Failed to parse Claude Code result as JSON: ${err instanceof Error ? err.message : 'Unknown error'}. Raw result: ${result.slice(0, 200)}`)
        }
    }

    // Save to database
    await CodeGeneration.findOneAndUpdate(
        { feature_id: featureId },
        {
            feature_id: featureId,
            result: parsedResult,
            sessionId: sessionId,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    console.log('parsedResult',parsedResult);

    return {
        featureId,
        sessionId,
        result: parsedResult,
    }
}

function extractJsonFromString(raw: string): unknown {
    // First, try direct JSON parse
    try {
        return JSON.parse(raw)
    } catch {
        // Continue to extraction methods
    }

    // Try to extract JSON from markdown code fences (```json ... ```)
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
        try {
            return JSON.parse(codeBlockMatch[1].trim())
        } catch {
            // Continue to next method
        }
    }

    // Try to find JSON object between curly braces
    const jsonObjectMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonObjectMatch) {
        try {
            return JSON.parse(jsonObjectMatch[0])
        } catch {
            // Continue to next method
        }
    }

    // If all else fails, throw error with sample of what we received
    throw new Error(`Could not extract valid JSON from string. Preview: ${raw.slice(0, 300)}`)
}

function buildPrompt(input: { featureTitle: string; planContent: unknown }): string {
    const planText = typeof input.planContent === 'string'
        ? input.planContent
        : JSON.stringify(input.planContent, null, 2)

    return `You are an expert software engineer. You have been given a pre-approved implementation plan. Your job is to execute it exactly — do NOT re-plan or deviate.

## Feature
${input.featureTitle}

## Implementation Plan to Execute
${planText}

## Instructions

1. **Read the codebase** — briefly explore the repo to understand existing patterns (file structure, imports, naming conventions, error handling).
2. **Implement the plan** — write all the code files to disk exactly as described in the plan above. Follow existing project conventions (TypeScript, Express patterns, HttpError, etc.).
3. **Report** — return a JSON summary of what you did.

Your final output MUST be valid JSON matching this structure exactly:

\`\`\`json
{
  "filesWritten": ["path/to/file1.ts", "path/to/file2.ts"],
  "summary": "A concise paragraph summarizing what was implemented and how it works"
}
\`\`\`

IMPORTANT: Only return the JSON above. Do NOT include any other text outside the JSON.`
}
