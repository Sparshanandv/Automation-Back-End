import { HttpError } from '../../common/errors/http-error'
import { Feature } from '../../feature/feature.model'
import { Project } from '../../project/project.model'
import { runClaudeCode } from '../../common/utils/claude-code.executor'
import { Plan } from '../models/plan.model'
import { prepareFeatureBranch } from '../../common/utils/git-workflow.executor'
import { GithubService } from '../../github/github.service'

export async function executeFeatureImplementation(featureId: string) {
    const feature = await Feature.findById(featureId)
    if (!feature) {
        throw new HttpError(404, 'Feature not found')
    }
    // Before executing switch to main branch and then take pull and then take a branch and name feature/project-id/task-id and then switch to this branch then push the code to this branch and create a PR fro the main branch and then add PR link to the response field and then save this PR in DB 
    const plan= await Plan.findOne({ feature_id: featureId })
    if (!plan) {
        throw new HttpError(404, 'Plan not found for this feature')
    }

    const project = feature.projectId ? await Project.findById(feature.projectId) : null

    const repoPath = process.env.LOCAL_REPO_PATH
    if (!repoPath) {
        throw new HttpError(500, 'LOCAL_REPO_PATH environment variable is not configured')
    }

    const prompt = buildPrompt({
        featureTitle: feature.title as string,
        planContent: plan?.content,
    })

    //Switch to main branch and then take pull and then make a new branch
    const featureBranchPrepared= await prepareFeatureBranch({
        projectPath: repoPath,
        projectName: project?.name ?? 'unscoped',
        featureTitle: feature.title as string,
    })

    const { result, sessionId } = await runClaudeCode(prompt, { cwd: repoPath })

    //Create a PR
    //TODO: In this how can we access repoName as I have to make a PR now one method is to extract it from repo model(Currently the repoPath is wrong startegy)
    const isPrCreated= await GithubService.createPullRequest(repoPath,featureBranchPrepared.branchName,"main");

    return {
        featureId,
        sessionId,
        result,
    }
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
