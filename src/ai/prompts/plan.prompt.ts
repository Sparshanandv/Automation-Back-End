const SYSTEM_CONTEXT = `
# AI SDLC Automation Platform — Codebase Context

## TECH STACK
- Frontend:  React + Redux Toolkit + TypeScript + Vite + Tailwind CSS
- Backend:   Node.js + Express + TypeScript (REST API)
- Database:  MongoDB with Mongoose ODM
- AI:        Amazon Bedrock (Claude)
- Auth:      JWT — access token (15 min) + refresh token (7 days)
- Infra:     AWS ECS, API Gateway, S3

## STATUS FLOW
CREATED → QA → QA_APPROVED → DEV → PLAN_APPROVED → CODE_GEN → PR_CREATED → DONE

| Transition               | Trigger        | Action                       |
|--------------------------|----------------|------------------------------|
| CREATED → QA             | User action    | AI generates test cases      |
| QA → QA_APPROVED         | Human approval | Lock test cases              |
| QA_APPROVED → DEV        | User action    | AI generates dev plan        |
| DEV → PLAN_APPROVED      | Human approval | Lock dev plan                |
| PLAN_APPROVED → CODE_GEN | User action    | AI generates code            |
| CODE_GEN → PR_CREATED    | Auto-triggered | GitHub: branch → commit → PR |
| PR_CREATED → DONE        | PR merged      | Feature complete             |

## BACKEND FOLDER STRUCTURE
\`\`\`
Automation-Back-End/src/
├── auth/
│   ├── auth.controller.ts      ← signup, login, refresh handlers
│   ├── auth.router.ts          ← POST /auth/signup, /login, /refresh
│   ├── auth.service.ts         ← bcrypt hash, JWT sign/verify
│   └── user.model.ts
├── feature/
│   ├── feature.controller.ts
│   ├── feature.router.ts
│   ├── feature.service.ts
│   ├── feature.state-machine.ts ← isValidTransition, isValidRejection
│   └── feature.model.ts        ← FeatureStatus enum + IFeature interface
├── ai/
│   ├── ai.controller.ts
│   ├── ai.router.ts
│   ├── bedrock.client.ts       ← invoke(prompt): Promise<string>  — only entrypoint to Bedrock
│   ├── models/
│   │   ├── test-case.model.ts  ← { feature_id, content: Mixed }
│   │   └── plan.model.ts       ← { feature_id, content: Mixed }
│   ├── orchestrators/
│   │   ├── qa.orchestrator.ts
│   │   └── plan.orchestrator.ts
│   └── prompts/
│       ├── qa.prompt.ts
│       └── plan.prompt.ts
├── common/
│   └── middleware/
│       ├── auth.middleware.ts  ← verifies Bearer token, attaches req.user = { sub, email }
│       └── error.middleware.ts ← global JSON error handler (registered last)
├── routes/index.ts             ← declarative registry: { path, router, isPublic }
└── main.ts
\`\`\`

## FRONTEND FOLDER STRUCTURE
\`\`\`
Automation-Front-End/src/
├── components/         ← reusable UI (Button, Input, Card, Badge, Spinner, Toast, KanbanBoard)
├── pages/              ← AuthPage, DashboardPage, FeaturesPage, FeatureDetailPage
├── services/           ← feature.service.ts, auth.service.ts (axios API calls)
├── store/              ← Redux Toolkit slices
├── types/index.ts      ← centralised TypeScript types
└── utils/              ← axios interceptor, token storage
\`\`\`

## DATABASE COLLECTIONS (MongoDB / Mongoose)
| Collection      | Key Fields                                                       |
|-----------------|------------------------------------------------------------------|
| users           | email, password_hash, createdAt                                  |
| features        | projectId, title, description, criteria, status, statusHistory[] |
| testcases       | feature_id, content (Mixed)                                      |
| plans           | feature_id, content (Mixed)                                      |
| codegenerations | feature_id, files (Mixed), s3Path                                |

## API CONTRACT (existing endpoints)
\`\`\`
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh

POST   /api/features
GET    /api/features
GET    /api/features/:id
PATCH  /api/features/:id/status

POST   /api/ai/qa/generate/:featureId
POST   /api/ai/plan/generate/:featureId   ← newly added
POST   /api/ai/plan/approve/:featureId    ← newly added
POST   /api/ai/plan/reject/:featureId     ← newly added
\`\`\`

## CODING RULES
1. Every module owns its Mongoose model — no shared src/models/ folder.
2. All DB access via Mongoose models. No raw queries.
3. Validate all request bodies in controllers before calling services.
4. Use req.user (attached by authMiddleware) to scope queries to the logged-in user.
5. All secrets via process.env — never hardcode.
6. All errors passed to next(err) — global errorMiddleware handles the response.
7. Status transitions use isValidTransition() — never set feature.status directly.
8. All Bedrock calls go through bedrock.client.ts only — never call the Bedrock SDK directly.
9. All prompt templates live in /prompts/ — no inline prompts in services or orchestrators.
10. AI responses must be valid JSON before saving — throw HttpError if parsing fails.

## KEY PATTERNS

### HttpError
\`\`\`typescript
throw new HttpError(404, 'Feature not found')
\`\`\`

### Status Transition (forward)
\`\`\`typescript
if (isValidTransition(feature.status, FeatureStatusEnum.DEV)) {
    feature.status = FeatureStatusEnum.DEV
    feature.statusHistory.push({ status: FeatureStatusEnum.DEV, changedBy: actor, changedAt: new Date() })
}
await feature.save()
\`\`\`

### Upsert pattern (test cases / plans)
\`\`\`typescript
await Plan.findOneAndUpdate(
    { feature_id: featureId },
    { feature_id: featureId, content: planText },
    { upsert: true, new: true, setDefaultsOnInsert: true }
)
\`\`\`
`.trim()

export function buildPlanPrompt(input: {
    testCases: unknown[]
    userStory: string
    optionalPrompt?: string
    repoContext?: string
}): string {
    const cappedTestCases = input.testCases.slice(0, 50)
    const truncationNote =
        input.testCases.length > 50
            ? `\n\n> Note: ${input.testCases.length - 50} test case(s) were omitted to stay within context limits.`
            : ''

    const additionalSection = input.optionalPrompt
        ? `\n\n## ADDITIONAL INSTRUCTIONS FROM USER\n${input.optionalPrompt}`
        : ''

    const repoContextSection = input.repoContext
        ? `\n\n${input.repoContext}\n`
        : ''

    return `${SYSTEM_CONTEXT}${repoContextSection}

---

## ROLE
You are a senior software architect working on the AI SDLC Automation Platform described above.
Your task is to produce a detailed, actionable development plan for the feature described below.

IMPORTANT CONSTRAINTS:
- You have been provided with ACTUAL FILE CONTENTS from the repository
- Use the real code, existing patterns, and architecture you see in the repository context
- Reference specific existing files, functions, and modules when planning modifications
- Follow the exact coding patterns and conventions observed in the actual codebase
- Do NOT run any shell commands
- Do NOT modify any files
- Do NOT generate actual code — describe what needs to be written, not the code itself
- Base ALL recommendations on the actual repository context provided above

---

## USER STORY
${input.userStory}

## TEST CASES (${cappedTestCases.length} total)
${JSON.stringify(cappedTestCases, null, 2)}${truncationNote}${additionalSection}

---

## OUTPUT FORMAT
Produce a markdown development plan with exactly the following sections.
Do not add extra sections. Do not skip any section.

# Summary
One paragraph: what this feature does and why it is being built.

# Files to Create
For each new file: exact path relative to repo root, purpose, and key exports/functions.

# Files to Modify
For each existing file to change: exact path, what changes and why.

# API Changes
New or modified routes with: HTTP method, full path, request body shape, response shape.

# DB Changes
New collections, schema changes, or new indexes. State "None" if no changes.

# Implementation Order
Numbered step-by-step build sequence. Each step must reference a specific file and action.

# Risks & Edge Cases
Ambiguities, missing requirements, failure modes, or migration concerns to address.`
}
