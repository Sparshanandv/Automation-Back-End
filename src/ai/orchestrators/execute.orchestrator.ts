import { HttpError } from '../../common/errors/http-error'
import { Feature } from '../../feature/feature.model'
import { runClaudeCode } from '../../common/utils/claude-code.executor'

export async function executeFeatureImplementation(featureId: string) {
    const feature = await Feature.findById(featureId)
    if (!feature) {
        throw new HttpError(404, 'Feature not found')
    }

    const repoPath = process.env.LOCAL_REPO_PATH
    if (!repoPath) {
        throw new HttpError(500, 'LOCAL_REPO_PATH environment variable is not configured')
    }

    const prompt = buildPrompt({
        title: feature.title as string,
        description: feature.description as string,
        criteria: feature.criteria as string,
    })

    const { result, sessionId } = await runClaudeCode(prompt, { cwd: repoPath })

    return {
        featureId,
        sessionId,
        result,
    }
}

function buildPrompt(feature: { title: string; description: string; criteria: string }): string {
    return `You are an expert software engineer. You have been given a feature to implement in this codebase.

## Feature Details
- **Title:** ${feature.title}
- **Description:** ${feature.description}
- **Acceptance Criteria:** ${feature.criteria}

## Instructions

Follow these steps in order:

### Step 1 — Explore
Read and understand the existing codebase structure. Start with:
- The project root (package.json, tsconfig.json)
- src/main.ts (entry point)
- src/routes/index.ts (route registry)
- src/feature/ (feature module — model, service, controller, router)
- src/ai/ (AI module — this is where new AI-driven features live)
- src/common/ (shared errors, middleware, utilities)

Understand the coding style, naming conventions, and architectural patterns used.

### Step 2 — Plan
Create a detailed implementation plan. Identify:
- Which new files need to be created
- Which existing files need to be modified (keep modifications minimal and additive)
- What the data flow looks like

### Step 3 — Implement
Write all the necessary code files to disk. Follow the existing patterns exactly:
- Use TypeScript
- Use the same import style, naming conventions, and error handling patterns
- Register any new routes through the existing route registry pattern
- Use HttpError for error responses

### Step 4 — Report
Return a structured JSON summary of everything you did:

\`\`\`json
{
  "plan": "Brief description of the implementation plan",
  "filesWritten": ["list", "of", "file", "paths"],
  "summary": "A concise paragraph summarizing what was implemented and how it works"
}
\`\`\`

IMPORTANT: Your final output MUST be valid JSON matching the structure above.`
}
