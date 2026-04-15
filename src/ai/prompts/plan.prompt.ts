export interface PlanPromptInput {
    title: string
    description: string
    criteria: string
    testCases: any
    refinement?: string
}

export function buildPlanPrompt(input: PlanPromptInput): string {
    const { title, description, criteria, testCases, refinement } = input

    return `System: You are an expert software architect and developer. Generate a detailed, technical development plan for the following feature.
User:
Feature: ${title}
Description: ${description}
Acceptance Criteria: 
${criteria}

Reference Test Cases:
${JSON.stringify(testCases, null, 2)}

${refinement ? `Additional Requirements/Refinements:\n${refinement}` : ''}

Output the plan in Markdown format. Include:
1. Technical Architecture Summary
2. Files to be created/modified
3. Implementation steps
4. Potential risks or edge cases

Format the output clearly as a single JSON object with a "plan" field containing the markdown string.
\`\`\`json
{
  "plan": "... markdown content ..."
}
\`\`\`
`
}
