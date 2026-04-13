# AI SDLC Automation Platform — Shared Context

A Jira replacement that uses AI (Amazon Bedrock / Claude) + GitHub to automate the software development lifecycle.

---

## TECH STACK

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Frontend       | React + NgRx                      |
| Backend        | Node.js + NestJS (REST)           |
| Database       | PostgreSQL (TypeORM)              |
| AI             | Amazon Bedrock (Claude)           |
| Infrastructure | AWS ECS, API Gateway, RDS, S3     |
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

## DATABASE TABLES

| Table            | Key Fields                                           |
|------------------|------------------------------------------------------|
| users            | id, email, password_hash, created_at                 |
| projects         | id, user_id, name, description                       |
| repositories     | id, project_id, repo_name, branch, purpose           |
| features         | id, project_id, title, description, criteria, status |
| test_cases       | id, feature_id, content (JSON)                       |
| plans            | id, feature_id, content (JSON)                       |
| code_generations | id, feature_id, files (JSON), s3_path                |
| conversations    | id, feature_id, role, message, created_at            |
| approvals        | id, feature_id, stage, approved_by, approved_at      |

---

## API CONTRACT

```
POST   /auth/signup
POST   /auth/login
POST   /auth/refresh

POST   /projects
GET    /projects
GET    /projects/:id
POST   /projects/:id/repos
DELETE /projects/:id/repos/:repoId

POST   /features
GET    /features/:id
PUT    /features/:id
PATCH  /features/:id/status

POST   /ai/qa/generate/:featureId
POST   /ai/plan/generate/:featureId
POST   /ai/code/generate/:featureId
POST   /ai/chat/:featureId
GET    /ai/chat/:featureId/history

POST   /github/branch/:featureId
POST   /github/commit/:featureId
POST   /github/pr/:featureId
```

---

## MVP SCOPE

**IN:** JWT auth, projects, repos, features, status pipeline, AI (QA/plan/code), chat, GitHub automation
**OUT:** GitHub OAuth, team roles, notifications, analytics

# Backend — NestJS

Shared context (stack, status flow, DB tables, API contract) is in ~/.claude/CLAUDE.md and loaded automatically.

---

## FOLDER STRUCTURE

```
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── dto/
│       ├── signup.dto.ts
│       └── login.dto.ts
├── project/
│   ├── project.module.ts
│   ├── project.controller.ts
│   ├── project.service.ts
│   ├── entities/
│   │   ├── project.entity.ts
│   │   └── repository.entity.ts
│   └── dto/
│       ├── create-project.dto.ts
│       └── add-repo.dto.ts
├── feature/
│   ├── feature.module.ts
│   ├── feature.controller.ts
│   ├── feature.service.ts
│   ├── feature.state-machine.ts   ← status transition logic lives here
│   ├── entities/
│   │   ├── feature.entity.ts
│   │   └── approval.entity.ts
│   └── dto/
│       ├── create-feature.dto.ts
│       └── update-status.dto.ts
├── ai/
│   ├── ai.module.ts
│   ├── ai.controller.ts
│   ├── ai.service.ts
│   ├── bedrock.client.ts          ← single centralized Bedrock client
│   ├── orchestrators/
│   │   ├── qa.orchestrator.ts
│   │   ├── plan.orchestrator.ts
│   │   └── codegen.orchestrator.ts
│   ├── prompts/
│   │   ├── qa.prompt.ts
│   │   ├── plan.prompt.ts
│   │   └── codegen.prompt.ts
│   └── entities/
│       ├── test-case.entity.ts
│       ├── plan.entity.ts
│       ├── code-generation.entity.ts
│       └── conversation.entity.ts
├── github/
│   ├── github.module.ts
│   ├── github.controller.ts
│   ├── github.service.ts
│   └── github.client.ts
├── common/
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   ├── decorators/
│   │   └── current-user.decorator.ts
│   └── interceptors/
│       └── logging.interceptor.ts
├── database/
│   └── migrations/
└── main.ts
```

---

## MODULES

### Auth Module
- JWT login/signup
- bcrypt for password hashing (rounds: 10)
- Returns: `{ access_token, refresh_token, user }`
- JWT secret from `process.env.JWT_SECRET`
- Access token expires in 15m, refresh token in 7d

### Project Module
- CRUD projects scoped to authenticated user
- Repos linked with `purpose` enum: `frontend | backend | infra`
- A project can have multiple repos

### Feature Module
- CRUD features linked to a project
- Status managed by `feature.state-machine.ts` — no direct status updates
- `PATCH /features/:id/status` validates transition then fires the appropriate trigger
- Approved stages recorded in `approvals` table

### AI Module
- All Bedrock calls go through `bedrock.client.ts` only
- Each orchestrator calls `bedrock.client.ts`, never Bedrock SDK directly
- Prompt templates in `/prompts/` — no inline prompts in services
- All AI responses parsed and validated before saving to DB
- Chat history fetched and injected into each prompt for context

### GitHub Module
- Uses personal access token from project/repo config (no OAuth for MVP)
- Operations are async — controller returns 202 immediately, job runs in background
- Flow per feature: create branch → commit files → push → open PR

---

## CODING RULES

- One module per service. No cross-importing controllers.
- All DB access via TypeORM repositories. No raw SQL.
- All request bodies validated with `class-validator` DTOs.
- Use `@CurrentUser()` decorator to get user from JWT in controllers.
- All secrets via `process.env`. Never hardcoded.
- Global exception filter handles all errors — no try/catch in controllers.
- Log errors with context: module name, method, input summary.
- Status transitions must go through `FeatureStateMachine.transition()` — never `feature.status = x`.
- GitHub operations must never block an API response — queue them.
- AI responses must be valid JSON before saving — throw if parsing fails.

---

## ENVIRONMENT VARIABLES

```
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
S3_BUCKET=
GITHUB_TOKEN=
```

---

## KEY PATTERNS

### Status Transition (always use this)
```typescript
// feature.state-machine.ts
const VALID_TRANSITIONS = {
  CREATED: ['QA'],
  QA: ['QA_APPROVED'],
  QA_APPROVED: ['DEV'],
  DEV: ['PLAN_APPROVED'],
  PLAN_APPROVED: ['CODE_GEN'],
  CODE_GEN: ['PR_CREATED'],
  PR_CREATED: ['DONE'],
};
```

### Bedrock Client (always call through this)
```typescript
// bedrock.client.ts
async invoke(prompt: string): Promise<string>
async invokeStream(prompt: string): AsyncGenerator<string>
```

### AI Response Validation (always validate before save)
```typescript
// parse → validate → save
const raw = await this.bedrock.invoke(prompt);
const parsed = JSON.parse(raw); // throw if invalid
// then save to DB
```
