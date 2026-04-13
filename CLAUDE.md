# AI SDLC Automation Platform — Shared Context

A Jira replacement that uses AI (Amazon Bedrock / Claude) + GitHub to automate the software development lifecycle.

---

## TECH STACK

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Frontend       | React + Redux Toolkit             |
| Backend        | Node.js + Express (REST)          |
| Database       | MongoDB (Mongoose)                |
| AI             | Amazon Bedrock (Claude)           |
| Infrastructure | AWS ECS, API Gateway, S3          |
| Auth           | JWT (access + refresh tokens)     |

---

## STATUS FLOW

```
CREATED → QA → QA_APPROVED → DEV → PLAN_APPROVED → CODE_GEN → PR_CREATED → DONE
```

| Transition               | Trigger        | Action                       |
|--------------------------|----------------|------------------------------|
| CREATED → QA             | User action    | AI generates test cases      |
| QA → QA_APPROVED         | Human approval | Lock test cases              |
| QA_APPROVED → DEV        | User action    | AI generates dev plan        |
| DEV → PLAN_APPROVED      | Human approval | Lock dev plan                |
| PLAN_APPROVED → CODE_GEN | User action    | AI generates code            |
| CODE_GEN → PR_CREATED    | Auto-triggered | GitHub: branch → commit → PR |
| PR_CREATED → DONE        | PR merged      | Feature complete             |

---

## DATABASE COLLECTIONS

| Collection       | Key Fields                                           |
|------------------|------------------------------------------------------|
| users            | email, password_hash, createdAt                      |
| projects         | userId, name, description, repositories[]            |
| features         | projectId, title, description, criteria, status      |
| testcases        | featureId, content (Mixed)                           |
| plans            | featureId, content (Mixed)                           |
| codegenerations  | featureId, files (Mixed), s3Path                     |
| conversations    | featureId, role, message, createdAt                  |
| approvals        | featureId, stage, approvedBy, approvedAt             |

---

## API CONTRACT

```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh

POST   /api/projects
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects/:id/repos
DELETE /api/projects/:id/repos/:repoId

POST   /api/features
GET    /api/features/:id
PUT    /api/features/:id
PATCH  /api/features/:id/status

POST   /api/ai/qa/generate/:featureId
POST   /api/ai/plan/generate/:featureId
POST   /api/ai/code/generate/:featureId
POST   /api/ai/chat/:featureId
GET    /api/ai/chat/:featureId/history

POST   /api/github/branch/:featureId
POST   /api/github/commit/:featureId
POST   /api/github/pr/:featureId
```

---

## MVP SCOPE

**IN:** JWT auth, projects, repos, features, status pipeline, AI (QA/plan/code), chat, GitHub automation
**OUT:** GitHub OAuth, team roles, notifications, analytics

# Backend — Express + Mongoose

---

## FOLDER STRUCTURE

```
src/
├── auth/
│   ├── auth.controller.ts         ← request handlers (signup, login, refresh)
│   ├── auth.router.ts             ← POST /auth/signup, /login, /refresh
│   ├── auth.service.ts            ← bcrypt hash, JWT sign/verify
│   └── user.model.ts              ← Mongoose User schema
├── project/
│   ├── project.controller.ts
│   ├── project.router.ts
│   ├── project.service.ts
│   └── project.model.ts           ← each module owns its model
├── feature/
│   ├── feature.controller.ts
│   ├── feature.router.ts
│   ├── feature.service.ts
│   ├── feature.state-machine.ts   ← status transition logic lives here
│   └── feature.model.ts
├── ai/
│   ├── ai.controller.ts
│   ├── ai.router.ts
│   ├── ai.service.ts
│   ├── bedrock.client.ts          ← single centralized Bedrock client
│   ├── orchestrators/
│   │   ├── qa.orchestrator.ts
│   │   ├── plan.orchestrator.ts
│   │   └── codegen.orchestrator.ts
│   └── prompts/
│       ├── qa.prompt.ts
│       ├── plan.prompt.ts
│       └── codegen.prompt.ts
├── github/
│   ├── github.controller.ts
│   ├── github.router.ts
│   ├── github.service.ts
│   └── github.client.ts
├── common/
│   └── middleware/
│       ├── auth.middleware.ts     ← verifies Bearer token, attaches req.user
│       ├── error.middleware.ts    ← global JSON error handler (registered last)
│       └── notFound.middleware.ts ← JSON 404 for unknown routes
├── routes/
│   └── index.ts                   ← declarative route registry with isPublic flag
└── main.ts
```

---

## ROUTE REGISTRY PATTERN

All routes declared in `src/routes/index.ts` as a typed array:

```typescript
const routes: RouteDefinition[] = [
  { path: '/auth',     router: authRouter,    isPublic: true  },
  { path: '/projects', router: projectRouter, isPublic: false },
]
```

- `isPublic: true` → mounted bare under `/api`
- `isPublic: false` → `authMiddleware` injected automatically

---

## MODULES

### Auth Module
- JWT login/signup
- bcrypt for password hashing (rounds: 10)
- Returns: `{ access_token, refresh_token, user }`
- Access token expires in 15m, refresh token in 7d

### Project Module
- CRUD projects scoped to authenticated user
- Repos embedded in project document with `purpose` enum: `frontend | backend | infra`

### Feature Module
- CRUD features linked to a project
- Status managed by `feature.state-machine.ts` — no direct status updates
- `PATCH /features/:id/status` validates transition then fires the appropriate trigger

### AI Module
- All Bedrock calls go through `bedrock.client.ts` only
- Each orchestrator calls `bedrock.client.ts`, never Bedrock SDK directly
- Prompt templates in `/prompts/` — no inline prompts in services
- Chat history fetched and injected into each prompt for context

### GitHub Module
- Uses personal access token from project/repo config
- Operations are async — controller returns 202 immediately, job runs in background
- Flow per feature: create branch → commit files → push → open PR

---

## CODING RULES

- Every module owns its Mongoose model — no shared `src/models/` folder.
- All DB access via Mongoose models. No raw queries.
- All request bodies validated in controllers before calling service.
- Use `req.user` (attached by `authMiddleware`) to scope queries to the logged-in user.
- All secrets via `process.env`. Never hardcoded.
- All errors passed to `next(err)` — global `errorMiddleware` handles the response.
- Status transitions must go through `FeatureStateMachine.transition()` — never `feature.status = x`.
- GitHub operations must never block an API response — run async.
- AI responses must be valid JSON before saving — throw if parsing fails.

---

## KEY PATTERNS

### Status Transition
```typescript
const VALID_TRANSITIONS = {
  CREATED: ['QA'],
  QA: ['QA_APPROVED'],
  QA_APPROVED: ['DEV'],
  DEV: ['PLAN_APPROVED'],
  PLAN_APPROVED: ['CODE_GEN'],
  CODE_GEN: ['PR_CREATED'],
  PR_CREATED: ['DONE'],
}
```

### Bedrock Client
```typescript
async invoke(prompt: string): Promise<string>
async invokeStream(prompt: string): AsyncGenerator<string>
```

---

## ENVIRONMENT VARIABLES

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/automation
JWT_SECRET=
JWT_REFRESH_SECRET=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
S3_BUCKET=
GITHUB_TOKEN=
```
