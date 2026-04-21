# AI Code Execution Flow — Complete Technical Documentation

**AI SDLC Automation Platform**  
End-to-end documentation of how AI generates QA test cases, development plans, and production code.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Phase 1: QA Test Case Generation](#phase-1-qa-test-case-generation)
3. [Phase 2: Development Plan Generation](#phase-2-development-plan-generation)
4. [Phase 3: Code Generation & GitHub PR](#phase-3-code-generation--github-pr)
5. [Repository Context System](#repository-context-system)
6. [Quality & Relevance](#quality--relevance)
7. [Performance Characteristics](#performance-characteristics)
8. [Troubleshooting](#troubleshooting)

---

## System Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                    (React + Redux Frontend)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP REST API
┌────────────────────────────▼────────────────────────────────────┐
│                      Express Backend                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Feature    │  │   Project    │  │     Auth     │         │
│  │   Module     │  │   Module     │  │   Module     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘         │
│         │                  │                                     │
│  ┌──────▼──────────────────▼────────────────────────────┐      │
│  │              AI Module (Orchestrators)               │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │      │
│  │  │    QA    │  │   Plan   │  │  Code Execution  │  │      │
│  │  │Orchestr. │→ │Orchestr. │→ │   Orchestrator   │  │      │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────────────┘  │      │
│  └───────┼─────────────┼─────────────┼────────────────┘      │
│          │             │             │                          │
│  ┌───────▼─────────────▼─────────────▼────────────────┐       │
│  │         Repository Context Reader                   │       │
│  │  (Scans local repo, reads files, builds context)   │       │
│  └───────┬─────────────────────────────────────────────┘       │
└──────────┼─────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────┐
│                    Local Repository                             │
│  /Users/.../Automation-Back-End/                               │
│    ├── src/                                                     │
│    │   ├── auth/                                               │
│    │   ├── feature/                                            │
│    │   └── ...                                                 │
│    ├── package.json                                            │
│    └── tsconfig.json                                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
           ┌─────────────────▼─────────────────┐
           │   Amazon Bedrock (Claude API)     │
           │   - Receives repo context         │
           │   - Generates QA/Plan/Code        │
           └─────────────────┬─────────────────┘
                             │
           ┌─────────────────▼─────────────────┐
           │         GitHub API                │
           │   - Create branch                 │
           │   - Commit files                  │
           │   - Open pull request             │
           └───────────────────────────────────┘
```

### Status Flow

```
CREATED → QA → QA_APPROVED → DEV → PLAN_APPROVED → CODE_GEN → PR_CREATED → DONE
   │       │         │          │          │           │            │
   │       └─────────┘          └──────────┘           └────────────┘
   │       AI Gen QA            AI Gen Plan           AI Gen Code
```

---

## Phase 1: QA Test Case Generation

### Overview

**Where:** Backend server (`src/ai/orchestrators/qa.orchestrator.ts`)  
**Trigger:** User clicks "Generate QA" on a feature in `CREATED` status  
**Output:** JSON array of test cases saved to MongoDB  
**Duration:** ~30-90 seconds (depending on repo size)

### Request Flow

```
User clicks "Generate QA"
         │
         ▼
POST /api/ai/qa/generate/:featureId
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  qa.orchestrator.ts: generateQaTestCases()            │
├────────────────────────────────────────────────────────┤
│  1. Validate feature status (must be CREATED)         │
│  2. Load project & repository info from MongoDB       │
│  3. Resolve local repository path                     │
│  4. Scan repository → Read up to 40 source files      │
│  5. Format context into structured markdown           │
│  6. Build AI prompt with feature + repo context       │
│  7. Send to Amazon Bedrock (Claude API)               │
│  8. Parse JSON response                               │
│  9. Save test cases to MongoDB                        │
│ 10. Update feature status: CREATED → QA              │
└────────────────────────────────────────────────────────┘
```

### Step-by-Step Execution

#### Step 1: Feature Validation

```typescript
// qa.orchestrator.ts lines 99-106
const feature = await getValidatedFeature(featureId)

if (feature.status !== FeatureStatusEnum.CREATED) {
    throw new HttpError(400, 
        `Feature must be in CREATED status. Current: ${feature.status}`
    )
}
```

**What happens:** Ensures feature hasn't already had QA generated.

---

#### Step 2: Load Project Bundle

```typescript
// qa.orchestrator.ts lines 108
const projectBundle = await loadQaProjectBundle(feature)
```

**What `loadQaProjectBundle()` does:**

1. **Fetches project** from MongoDB using `feature.projectId`
2. **Fetches repositories** linked to the project
3. **Resolves local repo path:**
   - Uses `repo.localPath` if specified
   - Falls back to `${LOCAL_REPO_PATH}/${project.name}`
   - Example: `/Users/usl-sz-1829/Desktop/Automation-Back-End`

4. **Checks if path exists:**
   ```typescript
   if (!fs.existsSync(repoPath)) {
       throw new HttpError(400, 
           `Repository directory not found at "${repoPath}"`
       )
   }
   ```

5. **Scans repository** (THE KEY STEP):
   ```typescript
   // qa.orchestrator.ts lines 63-66
   console.log(`[QA] Reading repository context from: ${repoPath}`)
   const context = getRepositoryContext(repoPath)
   const repoContext = formatRepositoryContext(context)
   console.log(`[QA] Scanned ${context.totalFilesScanned} files, ${context.totalCharacters} characters`)
   ```

**Returns:**
```typescript
{
    projectName: "Automation Platform",
    projectDescription: "AI-powered SDLC automation",
    repositories: [
        { repo_name: "org/automation-backend", branch: "main", purpose: "BE" }
    ],
    repoContext: "## REPOSITORY CONTEXT\nFolder: Automation-Back-End\n..." // 50-150K chars
}
```

---

#### Step 3: Repository Context Scanning

**Where:** `src/common/utils/repo-context-reader.ts`

**Configuration:**
```typescript
// local-repo-snapshot.ts lines 49-53
{
    maxFiles: 40,              // Read up to 40 files
    maxCharsPerFile: 8000,     // 8KB per file max
    maxDepth: 4,               // Traverse 4 directory levels deep
    includeExtensions: ['.ts', '.js', '.tsx', '.jsx', '.json', '.md'],
    excludeDirs: ['node_modules', 'dist', 'build', 'coverage', '.git']
}
```

**Scanning Algorithm:**

```typescript
// repo-context-reader.ts: scanRepositoryContext()

1. Get top-level entries (src/, package.json, tsconfig.json, etc.)

2. Build file tree:
   src/
     auth/
       auth.controller.ts
       auth.service.ts
       user.model.ts
     feature/
       feature.controller.ts
     ...

3. Collect all eligible files recursively

4. Prioritize files:
   PRIORITY:
   - package.json, tsconfig.json
   - README.md, CLAUDE.md
   - main.ts, index.ts, App.tsx
   - Root-level files
   
   REGULAR:
   - All other .ts, .js, .json files in src/

5. Read priority files first (up to maxFiles limit)

6. Read file contents:
   - Skip if file > 16KB (too large)
   - Read and truncate to maxCharsPerFile (8000 chars)
   - Mark truncation: "[...truncated, 2341 more characters]"

7. Generate summary:
   - Detect project type (React Frontend, Node.js Backend, etc.)
   - List top-level structure
   - Note if tests exist
```

**Example Output (RepoContext object):**
```typescript
{
    repoPath: "/Users/usl-sz-1829/Desktop/Automation-Back-End",
    repoFolderName: "Automation-Back-End",
    topLevelEntries: ["src", "package.json", "tsconfig.json", "README.md"],
    fileTree: "src/\n  auth/\n    auth.controller.ts\n    auth.service.ts\n...",
    keyFiles: [
        {
            relativePath: "package.json",
            content: "{\n  \"name\": \"automation-back-end\",\n  \"dependencies\": {...}\n}",
            size: 1234
        },
        {
            relativePath: "src/auth/auth.controller.ts",
            content: "export class AuthController {\n  async signup(req, res) {...}\n}",
            size: 5678
        },
        // ... 35-40 files total
    ],
    totalFilesScanned: 35,
    totalCharacters: 87423,
    summary: "Node.js Backend project with 35 key files scanned. Structure includes: src, package.json, tsconfig.json. Has test files."
}
```

---

#### Step 4: Format Context for AI

**Where:** `formatRepoContextForPrompt()` in `repo-context-reader.ts`

**Formats context into markdown:**

```markdown
## REPOSITORY CONTEXT
Folder: Automation-Back-End
Summary: Node.js Backend project with 35 key files scanned. Structure includes: src, package.json, tsconfig.json. Has test files.
Files analyzed: 35

### Top-Level Structure
src, package.json, tsconfig.json, README.md, .gitignore

### File Tree
```
src/
  auth/
    auth.controller.ts
    auth.service.ts
    auth.router.ts
    user.model.ts
  feature/
    feature.controller.ts
    feature.service.ts
    feature.model.ts
  ai/
    orchestrators/
      qa.orchestrator.ts
      plan.orchestrator.ts
    prompts/
      qa.prompt.ts
```

### Key Files (35)

#### package.json
```json
{
  "name": "automation-back-end",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^8.0.0",
    "@aws-sdk/client-bedrock-runtime": "^3.0.0"
  }
}
```

#### src/auth/auth.controller.ts
```typescript
import { Request, Response, NextFunction } from 'express'
import { AuthService } from './auth.service'

export class AuthController {
    static async signup(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body
            const result = await AuthService.signup(email, password)
            res.status(201).json(result)
        } catch (err) {
            next(err)
        }
    }
}
```

#### src/auth/auth.router.ts
```typescript
import { Router } from 'express'
import { AuthController } from './auth.controller'

const router = Router()

router.post('/signup', AuthController.signup)
router.post('/login', AuthController.login)
router.post('/refresh', AuthController.refresh)

export default router
```

... (continues for all 35 files)
```

**Size:** Typically 50,000 - 150,000 characters (within Bedrock's 200K token limit)

---

#### Step 5: Build AI Prompt

**Where:** `src/ai/prompts/qa.prompt.ts`

```typescript
// qa.prompt.ts: buildQaPrompt()

const prompt = `You are a senior QA engineer. Generate comprehensive test cases for the following feature.

${formatProjectSection(project)}  // ← INJECTS REPO CONTEXT HERE

PROJECT-AWARE RULES:
- You have been provided with ACTUAL FILE CONTENTS from the repository above
- Use the real code, API endpoints, functions, and modules you see in the repository context
- Reference specific files, classes, functions, and API routes from the codebase
- Create test cases that match the actual implementation patterns and architecture
- If you see existing test files, follow their format and structure
- Ground all test steps in the actual code structure, not generic assumptions

## FEATURE
FEATURE TITLE: ${feature.title}
FEATURE DESCRIPTION: ${feature.description}
ACCEPTANCE CRITERIA: ${feature.criteria}

Return ONLY a raw JSON array. No explanation. No markdown. No code fences.

Each element must follow this exact structure:
{
  "id": "TC-001",
  "title": "Short test case title",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "expected": "Expected result description",
  "type": "functional | edge | negative"
}

Cover:
- All acceptance criteria (functional tests)
- Boundary and edge cases (edge tests)
- Invalid inputs and error scenarios (negative tests)

Return ONLY the JSON array.`
```

**Total Prompt Size:**
- System instructions: ~2,000 chars
- Repository context: ~87,000 chars
- Feature details: ~500 chars
- **Total: ~90,000 chars** (well within Claude's limits)

---

#### Step 6: Send to Bedrock

**Where:** `src/ai/bedrock.client.ts`

```typescript
// bedrock.client.ts: invoke()

export async function invoke(prompt: string, maxTokens = 16000): Promise<string> {
    const command = new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID, // claude-3-sonnet-20240229-v1:0
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: maxTokens,
            messages: [
                {
                    role: 'user',
                    content: prompt  // ← 90K char prompt with full repo context
                }
            ]
        })
    })

    const response = await bedrockClient.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))
    
    return responseBody.content[0].text
}
```

**What Claude receives:**
1. **Full repository structure** (file tree)
2. **Actual code** from 35-40 files
3. **Package dependencies** (from package.json)
4. **Existing patterns** (controllers, services, routers)
5. **Feature requirements** (title, description, criteria)

**What Claude does:**
1. Analyzes the actual codebase structure
2. Identifies real API endpoints (e.g., `POST /api/auth/signup`)
3. Understands actual functions and modules
4. Generates test cases that reference **real code**, not hypothetical endpoints

---

#### Step 7: Parse & Save Response

```typescript
// qa.orchestrator.ts

const parsed = await callAi(prompt)  // Returns parsed JSON

// Example response from Claude:
[
    {
        "id": "TC-001",
        "title": "User signup with valid credentials",
        "steps": [
            "Send POST /api/auth/signup with { email: 'test@example.com', password: 'SecurePass123' }",
            "Verify response status is 201",
            "Verify response contains access_token and refresh_token"
        ],
        "expected": "User account created successfully with JWT tokens returned",
        "type": "functional"
    },
    {
        "id": "TC-002",
        "title": "Signup with existing email",
        "steps": [
            "Create user with POST /api/auth/signup",
            "Attempt POST /api/auth/signup with same email",
            "Verify response status is 409"
        ],
        "expected": "Error response: Email already exists",
        "type": "negative"
    }
    // ... 10-20 more test cases
]

// Save to MongoDB
await TestCase.findOneAndUpdate(
    { feature_id: featureId },
    { feature_id: featureId, content: parsed },
    { upsert: true, new: true }
)

// Update feature status
feature.status = FeatureStatusEnum.QA
await feature.save()
```

---

### What Makes QA Generation Context-Aware

#### Before (Without Repo Context):
```json
{
    "id": "TC-001",
    "title": "Test login functionality",
    "steps": [
        "Navigate to login page",
        "Enter username and password",
        "Click submit button"
    ],
    "expected": "User should be logged in",
    "type": "functional"
}
```
❌ **Generic, vague, not specific to your codebase**

#### After (With Repo Context):
```json
{
    "id": "TC-001",
    "title": "JWT authentication via POST /api/auth/login",
    "steps": [
        "Send POST request to /api/auth/login with body: { email: 'test@example.com', password: 'password123' }",
        "Verify response status is 200",
        "Verify response contains: { access_token: string, refresh_token: string, user: { email: string } }",
        "Verify access_token is a valid JWT with 15-minute expiry",
        "Extract userId from req.user (attached by authMiddleware)"
    ],
    "expected": "Returns JWT access token (15m expiry), refresh token (7d expiry), and user object",
    "type": "functional"
}
```
✅ **References actual endpoints, actual response structure, actual middleware**

---

### Console Output Example

```bash
[QA] Reading repository context from: /Users/usl-sz-1829/Desktop/Automation-Back-End
[QA] Scanned 35 files, 87423 characters
[Bedrock] Sending prompt (89,234 characters) to Claude...
[Bedrock] Response received (4,521 characters)
[QA] Generated 12 test cases for feature: User Authentication
[QA] Feature status updated: CREATED → QA
```

---

## Phase 2: Development Plan Generation

### Overview

**Where:** Backend server (`src/ai/orchestrators/plan.orchestrator.ts`)  
**Trigger:** User clicks "Generate Plan" on a feature in `QA_APPROVED` status  
**Output:** Markdown development plan saved to MongoDB  
**Duration:** ~45-120 seconds

### Request Flow

```
User approves QA → Feature status: QA_APPROVED
         │
         ▼
User clicks "Generate Plan"
         │
         ▼
POST /api/ai/plan/generate/:featureId
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  plan.orchestrator.ts: generateDevPlan()              │
├────────────────────────────────────────────────────────┤
│  1. Validate feature status (QA_APPROVED or DEV)      │
│  2. Fetch approved test cases from MongoDB            │
│  3. Load project & repository info                    │
│  4. Resolve local repository path                     │
│  5. Scan repository → Read up to 40 source files      │
│  6. Format context into structured markdown           │
│  7. Build AI prompt with test cases + repo context    │
│  8. Send to Amazon Bedrock (Claude API)               │
│  9. Parse markdown response                           │
│ 10. Save plan to MongoDB                              │
│ 11. Update feature status: QA_APPROVED → DEV         │
└────────────────────────────────────────────────────────┘
```

### Step-by-Step Execution

#### Step 1: Fetch Test Cases

```typescript
// plan.orchestrator.ts lines 34-35
const testCaseDoc = await TestCase.findOne({ feature_id: featureId })
const testCases = testCaseDoc?.content || []
```

**Why:** The plan needs to satisfy all test cases generated in Phase 1.

---

#### Step 2: Load Repository Context

```typescript
// plan.orchestrator.ts lines 38-58
let repoContext: string | undefined

if (feature.projectId) {
    const project = await Project.findById(feature.projectId)
    if (project) {
        const repos = await Repository.find({ projectId: feature.projectId }).lean()
        const repoPath = resolveLocalRepoPath({ name: project.name }, repos)

        if (fs.existsSync(repoPath)) {
            console.log(`[Plan] Reading repository context from: ${repoPath}`)
            const context = getRepositoryContext(repoPath)  // ← SCANS REPO AGAIN
            repoContext = formatRepositoryContext(context)
            console.log(`[Plan] Scanned ${context.totalFilesScanned} files, ${context.totalCharacters} characters`)
        }
    }
}
```

**Why scan again?**
- Files may have changed since QA generation
- Ensures plan references current codebase state
- Same scanning algorithm as QA (40 files, 8KB each)

---

#### Step 3: Build Plan Prompt

**Where:** `src/ai/prompts/plan.prompt.ts`

```typescript
// plan.prompt.ts: buildPlanPrompt()

const prompt = `
## SYSTEM CONTEXT
- Tech Stack: Node.js + Express + MongoDB + React + Redux
- Status Flow: CREATED → QA → DEV → PLAN_APPROVED → CODE_GEN → PR_CREATED
- Backend Structure: src/auth/, src/feature/, src/ai/orchestrators/
- Coding Rules: Use HttpError, Mongoose models, JWT auth, status transitions

${input.repoContext}  // ← INJECTS FULL REPO CONTEXT (50-150KB)

---

## ROLE
You are a senior software architect working on the AI SDLC Automation Platform.
Your task is to produce a detailed, actionable development plan for the feature below.

IMPORTANT CONSTRAINTS:
- You have been provided with ACTUAL FILE CONTENTS from the repository
- Use the real code, existing patterns, and architecture you see in the repository context
- Reference specific existing files, functions, and modules when planning modifications
- Follow the exact coding patterns and conventions observed in the actual codebase
- Do NOT run shell commands, modify files, or generate actual code
- Base ALL recommendations on the actual repository context provided above

---

## USER STORY
${input.userStory}

## TEST CASES (${testCases.length} total)
${JSON.stringify(testCases, null, 2)}

---

## OUTPUT FORMAT
Produce a markdown development plan with exactly these sections:

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
Ambiguities, missing requirements, failure modes, or migration concerns to address.
`
```

**Prompt Size:**
- System context: ~5,000 chars
- Repository context: ~87,000 chars
- Test cases: ~4,000 chars
- Feature details: ~500 chars
- **Total: ~97,000 chars**

---

#### Step 4: Send to Bedrock & Parse Response

```typescript
// plan.orchestrator.ts lines 69-75
try {
    planText = await bedrockClient.invoke(prompt)
    if (!planText) throw new Error('Empty response from Bedrock')
} catch (err: any) {
    throw new HttpError(500, `Failed to generate plan: ${err.message}`)
}
```

**Example Response from Claude:**

```markdown
# Summary

This feature implements JWT-based refresh token functionality to allow users to obtain new access tokens without re-authenticating. The refresh token is stored securely, has a 7-day expiry, and can be used once to generate a new access/refresh token pair. This improves UX by keeping users logged in and reduces password exposure.

# Files to Create

None. All required functionality can be implemented in existing files.

# Files to Modify

## src/auth/auth.controller.ts
**Changes:**
- Add `refresh` static method to handle POST /api/auth/refresh
- Verify refresh token from request body
- Call AuthService.refreshTokens()
- Return new access_token and refresh_token

**Why:** Controller layer handles HTTP request/response for refresh endpoint.

## src/auth/auth.service.ts
**Changes:**
- Add `refreshTokens(refreshToken: string)` method
- Verify refresh token with JWT_REFRESH_SECRET
- Find user by ID from token payload
- Generate new access token (15m) and refresh token (7d)
- Return { access_token, refresh_token, user }

**Why:** Service layer contains business logic for token refresh.

## src/auth/auth.router.ts
**Changes:**
- Add route: `router.post('/refresh', AuthController.refresh)`

**Why:** Exposes refresh endpoint at POST /api/auth/refresh.

## src/auth/user.model.ts
**Changes:**
- No schema changes needed. User model already has email and password fields.

**Why:** No additional fields required for refresh token flow.

# API Changes

## POST /api/auth/refresh
**Status:** New endpoint  
**Authentication:** None (public route - uses refresh token in body)  
**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com"
  }
}
```
**Response (401):**
```json
{
  "error": "Invalid or expired refresh token"
}
```

# DB Changes

None. Existing `users` collection has all required fields.

# Implementation Order

1. **src/auth/auth.service.ts** — Add `refreshTokens()` method
   - Verify refresh token with jwt.verify()
   - Extract user ID from token payload
   - Fetch user from MongoDB
   - Generate new tokens with AuthService.generateTokens()
   - Return token pair + user object

2. **src/auth/auth.controller.ts** — Add `refresh()` static method
   - Extract refresh_token from req.body
   - Validate it exists (throw 400 if missing)
   - Call AuthService.refreshTokens(refresh_token)
   - Handle errors (throw 401 for invalid/expired tokens)
   - Return JSON response with new tokens

3. **src/auth/auth.router.ts** — Add POST /refresh route
   - Register route before other protected routes
   - Map to AuthController.refresh

4. **Test with curl/Postman:**
   ```bash
   POST /api/auth/refresh
   Body: { "refresh_token": "<valid-token>" }
   Expected: 200 with new access_token and refresh_token
   ```

# Risks & Edge Cases

1. **Refresh Token Reuse:** Current implementation allows refresh token reuse until expiry. Consider implementing "rotation" (invalidate old refresh token on use) for better security.

2. **Concurrent Refresh Requests:** If user's app makes multiple refresh requests simultaneously, both will succeed. This is acceptable for MVP but may create confusion in logs.

3. **Token Revocation:** No mechanism to revoke refresh tokens (e.g., on logout, password change). Consider adding a `tokenVersion` field to User model and incrementing it on logout/password reset.

4. **Missing JWT_REFRESH_SECRET:** Ensure .env has JWT_REFRESH_SECRET set. If missing, throw startup error in main.ts.

5. **Clock Skew:** JWT expiry validation may fail if server clock is wrong. Use standard NTP sync.

6. **Error Messages:** Don't reveal whether user exists or token is invalid - always return generic "Invalid or expired refresh token" to prevent enumeration attacks.
```

---

#### Step 5: Save Plan & Update Status

```typescript
// plan.orchestrator.ts lines 77-95
const plan = await Plan.findOneAndUpdate(
    { feature_id: featureId },
    {
        feature_id: featureId,
        content: planText,  // Full markdown plan
        status: 'completed',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
)

// Advance status: QA_APPROVED → DEV
if (isValidTransition(feature.status, FeatureStatusEnum.DEV)) {
    feature.status = FeatureStatusEnum.DEV
    feature.statusHistory.push({
        status: FeatureStatusEnum.DEV,
        changedBy: { id: 'system', email: 'system' },
        changedAt: new Date(),
    })
    await feature.save()
}
```

---

### What Makes Plan Generation Context-Aware

#### Before (Without Repo Context):
```markdown
# Files to Create
- Create a new authentication controller
- Create a service to handle tokens
- Create a router file

# Files to Modify
- Update main application file to register routes

# API Changes
- Add POST /auth/refresh endpoint

# Implementation Order
1. Create authentication files
2. Implement token logic
3. Add routes
```
❌ **Generic, no specific paths, ignores existing architecture**

#### After (With Repo Context):
```markdown
# Files to Modify

## src/auth/auth.controller.ts (existing file)
**Line 42:** Add new static method `refresh()` after the `login()` method
**Why:** Follows existing pattern - all auth handlers are static methods in AuthController

## src/auth/auth.service.ts (existing file)
**Line 67:** Add `refreshTokens(refreshToken: string)` method
**Implementation:** Use jwt.verify() with JWT_REFRESH_SECRET (same pattern as line 45-52 in verify())
**Why:** Matches existing service architecture - all JWT operations in AuthService

## src/auth/auth.router.ts (existing file)
**Line 9:** Add `router.post('/refresh', AuthController.refresh)`
**Why:** Existing router already has /signup and /login at lines 7-8

# API Changes
POST /api/auth/refresh (matches existing pattern: /api/auth/signup, /api/auth/login)
Response format: { access_token, refresh_token, user } (same as login response, line 34 of auth.service.ts)

# Implementation Order
1. **src/auth/auth.service.ts** line 67 — Add refreshTokens()
   - Follow existing generateTokens() pattern (lines 29-41)
   - Use User.findById() like in login() (line 18)
2. **src/auth/auth.controller.ts** line 42 — Add refresh()
   - Follow signup/login pattern (lines 15-40)
   - Use same error handling (next(err) pattern)
3. **src/auth/auth.router.ts** line 9 — Register route
```
✅ **References actual files, line numbers, existing patterns, real functions**

---

### Console Output Example

```bash
[Plan] Reading repository context from: /Users/usl-sz-1829/Desktop/Automation-Back-End
[Plan] Scanned 35 files, 87423 characters
[Bedrock] Sending prompt (96,734 characters) to Claude...
[Bedrock] Response received (6,234 characters)
[Plan] Generated development plan for feature: Refresh Token Support
[Plan] Feature status updated: QA_APPROVED → DEV
```

---

## Phase 3: Code Generation & GitHub PR

### Overview

**Where:** Backend server (`src/ai/orchestrators/execute.orchestrator.ts`)  
**Trigger:** User clicks "Generate Code" on a feature in `PLAN_APPROVED` status  
**Output:** 
- Code files written to local repository disk
- Git branch created
- Files committed and pushed to GitHub
- Pull request opened automatically
**Duration:** ~60-180 seconds (depends on code complexity + GitHub API)

### Request Flow

```
User approves Plan → Feature status: PLAN_APPROVED
         │
         ▼
User clicks "Generate Code"
         │
         ▼
POST /api/ai/code/generate/:featureId
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  execute.orchestrator.ts: executeFeatureImpl()       │
├────────────────────────────────────────────────────────┤
│  1. Validate feature has PLAN_APPROVED status         │
│  2. Fetch approved plan from MongoDB                  │
│  3. Load project & repository info                    │
│  4. Resolve local repository path                     │
│  5. Scan repository → Read up to 40 source files      │
│  6. Format context into structured markdown           │
│  7. Build code generation prompt                      │
│  8. Send to Amazon Bedrock (Claude API)               │
│  9. Parse JSON response (files array)                 │
│ 10. Write files to local disk (repo directory)        │
│ 11. Create Git branch (feature/project/feature-name)  │
│ 12. Commit files with message                         │
│ 13. Push branch to GitHub                             │
│ 14. Open pull request via GitHub API                  │
│ 15. Save CodeGeneration record to MongoDB             │
│ 16. Save PullRequest record to MongoDB                │
│ 17. Update feature status: PLAN_APPROVED → CODE_GEN  │
└────────────────────────────────────────────────────────┘
```

### Step-by-Step Execution

#### Step 1: Validate & Load Plan

```typescript
// execute.orchestrator.ts lines 19-33
const feature = await Feature.findById(featureId)
if (!feature) throw new HttpError(404, 'Feature not found')

// Check for existing completed code generation
const existingCodeGen = await CodeGeneration.findOne({ feature_id: featureId })
if (existingCodeGen && existingCodeGen.status === 'completed') {
    return { featureId, sessionId: existingCodeGen.sessionId, result: existingCodeGen.result }
}

const plan = await Plan.findOne({ feature_id: featureId })
if (!plan) throw new HttpError(404, 'Plan not found for this feature')

const project = await Project.findById(feature.projectId)
const repos = await Repository.find({ projectId: project._id }).lean()
const repoPath = resolveLocalRepoPath({ name: project.name }, repos)
```

---

#### Step 2: Scan Repository Context (Again)

```typescript
// execute.orchestrator.ts lines 48-51
console.log(`[CodeGen] Reading repository context from: ${repoPath}`)
const context = getRepositoryContext(repoPath)
const repoContext = formatRepositoryContext(context)
console.log(`[CodeGen] Scanned ${context.totalFilesScanned} files, ${context.totalCharacters} characters`)
```

**Why scan for the third time?**
- Codebase may have changed since plan generation
- Developer may have implemented some files manually
- Ensures AI generates code compatible with **current** state
- Prevents merge conflicts

---

#### Step 3: Build Code Generation Prompt

**Where:** `execute.orchestrator.ts` lines 171-219

```typescript
function buildCodeGenPrompt(input: {
    featureTitle: string
    planContent: unknown
    repoFolderName: string
    repoContext: string
}): string {
    return `You are a senior software engineer. Implement the following feature by generating complete, working code files.

## Feature
${input.featureTitle}

## Approved Implementation Plan
${planText}

${input.repoContext}  // ← FULL REPO CONTEXT (50-150KB)

## Instructions
- You have been provided with ACTUAL FILE CONTENTS from the repository above
- Study the existing code patterns, architecture, and conventions carefully
- Match the exact coding style, naming patterns, and structure you see in existing files
- Reuse existing utilities, helpers, and patterns where applicable
- Import from existing modules following the patterns you observe
- Generate ALL files described in the plan's "Files to Create" section
- Each file must have complete, working code — no placeholders or TODOs
- Follow the existing codebase conventions you can see in the repository context

## Required Output Format
Return ONLY a valid JSON object — no markdown, no explanation, no code fences. Just raw JSON:

{
  "files": [
    { "path": "src/feature/foo.ts", "content": "full file content here" },
    { "path": "src/feature/foo.test.ts", "content": "full file content here" }
  ],
  "summary": "One paragraph describing what was implemented and how it works"
}

CRITICAL RULES FOR PATHS:
- Paths MUST be relative to the repo root (e.g. "src/feature/foo.ts")
- Do NOT prefix paths with the repo folder name "${input.repoFolderName}/"
- Do NOT use absolute paths
- WRONG: "Automation-Back-End/src/feature/foo.ts"
- CORRECT: "src/feature/foo.ts"
`
}
```

**Prompt Size:**
- Instructions: ~2,000 chars
- Feature title: ~100 chars
- Plan content: ~6,000 chars (markdown plan from Phase 2)
- Repository context: ~87,000 chars (actual code)
- **Total: ~95,000 chars**

---

#### Step 4: Send to Bedrock with Higher Token Limit

```typescript
// execute.orchestrator.ts lines 65-71
try {
    const raw = await bedrockClient.invoke(prompt, 32000)  // ← 32K token limit (16K default)
    const parsed = extractJson(raw)
    generatedFiles = parsed.files || []
    summary = parsed.summary || ''
} catch (err: any) {
    throw new HttpError(500, `Code generation via Bedrock failed: ${err.message}`)
}
```

**Why 32K tokens?**
- Code files are longer than test cases or plans
- Need capacity for multiple file contents
- Typical: 3-10 files, each 200-800 lines
- Total output: 5,000-15,000 tokens

---

#### Step 5: Parse JSON Response

**Claude's Response Example:**

```json
{
  "files": [
    {
      "path": "src/auth/auth.controller.ts",
      "content": "import { Request, Response, NextFunction } from 'express'\nimport { AuthService } from './auth.service'\nimport { HttpError } from '../common/errors/http-error'\n\nexport class AuthController {\n    static async signup(req: Request, res: Response, next: NextFunction) {\n        try {\n            const { email, password } = req.body\n            if (!email || !password) {\n                throw new HttpError(400, 'Email and password are required')\n            }\n            const result = await AuthService.signup(email, password)\n            res.status(201).json(result)\n        } catch (err) {\n            next(err)\n        }\n    }\n\n    static async login(req: Request, res: Response, next: NextFunction) {\n        try {\n            const { email, password } = req.body\n            const result = await AuthService.login(email, password)\n            res.status(200).json(result)\n        } catch (err) {\n            next(err)\n        }\n    }\n\n    static async refresh(req: Request, res: Response, next: NextFunction) {\n        try {\n            const { refresh_token } = req.body\n            if (!refresh_token) {\n                throw new HttpError(400, 'Refresh token is required')\n            }\n            const result = await AuthService.refreshTokens(refresh_token)\n            res.status(200).json(result)\n        } catch (err) {\n            next(err)\n        }\n    }\n}\n"
    },
    {
      "path": "src/auth/auth.service.ts",
      "content": "import bcrypt from 'bcryptjs'\nimport jwt from 'jsonwebtoken'\nimport { User } from './user.model'\nimport { HttpError } from '../common/errors/http-error'\n\nconst JWT_SECRET = process.env.JWT_SECRET!\nconst JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!\n\nexport class AuthService {\n    static async signup(email: string, password: string) {\n        const existingUser = await User.findOne({ email })\n        if (existingUser) {\n            throw new HttpError(409, 'Email already exists')\n        }\n        const password_hash = await bcrypt.hash(password, 10)\n        const user = await User.create({ email, password_hash })\n        const tokens = this.generateTokens(user._id.toString(), email)\n        return { ...tokens, user: { id: user._id, email: user.email } }\n    }\n\n    static async refreshTokens(refreshToken: string) {\n        try {\n            const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { sub: string; email: string }\n            const user = await User.findById(decoded.sub)\n            if (!user) {\n                throw new HttpError(401, 'Invalid or expired refresh token')\n            }\n            const tokens = this.generateTokens(user._id.toString(), user.email as string)\n            return { ...tokens, user: { id: user._id, email: user.email } }\n        } catch (err) {\n            throw new HttpError(401, 'Invalid or expired refresh token')\n        }\n    }\n\n    private static generateTokens(userId: string, email: string) {\n        const access_token = jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: '15m' })\n        const refresh_token = jwt.sign({ sub: userId, email }, JWT_REFRESH_SECRET, { expiresIn: '7d' })\n        return { access_token, refresh_token }\n    }\n}\n"
    },
    {
      "path": "src/auth/auth.router.ts",
      "content": "import { Router } from 'express'\nimport { AuthController } from './auth.controller'\n\nconst router = Router()\n\nrouter.post('/signup', AuthController.signup)\nrouter.post('/login', AuthController.login)\nrouter.post('/refresh', AuthController.refresh)\n\nexport default router\n"
    }
  ],
  "summary": "Implemented JWT refresh token functionality by adding a new refresh() method to AuthController and refreshTokens() method to AuthService. The refresh endpoint validates the provided refresh token, extracts the user ID, fetches the user from the database, and generates a new access/refresh token pair. The implementation follows existing authentication patterns, uses the same error handling (HttpError), and maintains consistency with signup/login flows. All three files (controller, service, router) were updated to support the new POST /api/auth/refresh endpoint."
}
```

---

#### Step 6: Write Files to Disk

```typescript
// execute.orchestrator.ts lines 78-93
const cleanedFiles: Array<{ path: string; content: string }> = []

for (const file of generatedFiles) {
    if (!file.path || !file.content) continue
    
    // Strip repo prefix if AI accidentally included it
    // "Automation-Back-End/src/auth/foo.ts" → "src/auth/foo.ts"
    const cleanPath = stripRepoPrefix(file.path, context.repoFolderName)
    
    // Build full absolute path
    const fullPath = path.join(repoPath, cleanPath)
    // e.g. /Users/usl-sz-1829/Desktop/Automation-Back-End/src/auth/auth.controller.ts
    
    // Security: ensure path is inside repo (prevent directory traversal)
    if (!fullPath.startsWith(path.resolve(repoPath))) {
        console.warn(`[CodeGen] Skipping unsafe path: ${file.path}`)
        continue
    }
    
    // Create parent directories if needed
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    
    // Write file
    fs.writeFileSync(fullPath, file.content, 'utf-8')
    
    cleanedFiles.push({ path: cleanPath, content: file.content })
}

const filesWritten = cleanedFiles.map(f => f.path)
// ["src/auth/auth.controller.ts", "src/auth/auth.service.ts", "src/auth/auth.router.ts"]
```

**File System Result:**
```bash
/Users/usl-sz-1829/Desktop/Automation-Back-End/
  src/
    auth/
      auth.controller.ts  ← WRITTEN (modified existing file)
      auth.service.ts     ← WRITTEN (modified existing file)
      auth.router.ts      ← WRITTEN (modified existing file)
```

---

#### Step 7: Push to GitHub & Create PR

```typescript
// execute.orchestrator.ts lines 96-124
let prUrl = ''
let prNumber = 0
let branchName = ''

if (project.githubToken && repo?.repo_name) {
    try {
        // Generate branch name: feature/automation-platform/refresh-token-support
        branchName = `feature/${sanitize(projectName)}/${sanitize(featureTitle)}`
        const baseBranch = repo.branch || 'main'
        
        // Call GitHub service (creates branch, commits, pushes, opens PR)
        const prResult = await GithubService.pushFilesAndCreatePR(
            repo.repo_name,           // "org/automation-backend"
            branchName,               // "feature/automation-platform/refresh-token-support"
            cleanedFiles,             // [{ path: "src/auth/...", content: "..." }]
            `feat: ${featureTitle}`,  // Commit message
            `Generated by AI Code Gen\n\n${summary}`,  // Commit body + PR description
            baseBranch,               // "main"
            project.githubToken       // GitHub PAT
        )
        
        prUrl = prResult.prUrl      // https://github.com/org/repo/pull/42
        prNumber = prResult.prNumber // 42
    } catch (ghErr: any) {
        console.warn(`[CodeGen] GitHub PR creation failed: ${ghErr.message}`)
        // Non-fatal: code is still written to disk
    }
}
```

**GitHub Service Implementation (`src/github/github.service.ts`):**

```typescript
static async pushFilesAndCreatePR(
    repoFullName: string,    // "org/automation-backend"
    branchName: string,      // "feature/automation-platform/refresh-token"
    files: Array<{ path: string; content: string }>,
    commitMessage: string,
    commitBody: string,
    baseBranch: string,      // "main"
    githubToken: string
): Promise<{ prUrl: string; prNumber: number }> {
    
    const [owner, repo] = repoFullName.split('/')
    const octokit = new Octokit({ auth: githubToken })
    
    // 1. Get base branch SHA
    const { data: baseRef } = await octokit.rest.git.getRef({
        owner, repo,
        ref: `heads/${baseBranch}`
    })
    const baseSha = baseRef.object.sha
    
    // 2. Create new branch
    await octokit.rest.git.createRef({
        owner, repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha
    })
    
    // 3. Get base tree
    const { data: baseCommit } = await octokit.rest.git.getCommit({
        owner, repo, commit_sha: baseSha
    })
    
    // 4. Create blobs for each file
    const tree = await Promise.all(
        files.map(async (file) => {
            const { data: blob } = await octokit.rest.git.createBlob({
                owner, repo,
                content: Buffer.from(file.content).toString('base64'),
                encoding: 'base64'
            })
            return {
                path: file.path,
                mode: '100644' as const,
                type: 'blob' as const,
                sha: blob.sha
            }
        })
    )
    
    // 5. Create tree
    const { data: newTree } = await octokit.rest.git.createTree({
        owner, repo,
        base_tree: baseCommit.tree.sha,
        tree
    })
    
    // 6. Create commit
    const { data: newCommit } = await octokit.rest.git.createCommit({
        owner, repo,
        message: `${commitMessage}\n\n${commitBody}`,
        tree: newTree.sha,
        parents: [baseSha]
    })
    
    // 7. Update branch reference
    await octokit.rest.git.updateRef({
        owner, repo,
        ref: `heads/${branchName}`,
        sha: newCommit.sha
    })
    
    // 8. Create pull request
    const { data: pr } = await octokit.rest.pulls.create({
        owner, repo,
        title: commitMessage,
        body: commitBody,
        head: branchName,
        base: baseBranch
    })
    
    return {
        prUrl: pr.html_url,
        prNumber: pr.number
    }
}
```

**GitHub Timeline:**
1. ✅ Branch created: `feature/automation-platform/refresh-token-support`
2. ✅ Files committed: 3 files changed
3. ✅ Branch pushed to remote
4. ✅ PR opened: `feat: Refresh Token Support` → `main`

---

#### Step 8: Save Results to MongoDB

```typescript
// execute.orchestrator.ts lines 126-151
const result = { filesWritten, summary }

// Save code generation record
await CodeGeneration.findOneAndUpdate(
    { feature_id: featureId },
    { 
        feature_id: featureId, 
        status: 'completed', 
        result, 
        sessionId: 'bedrock' 
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
)

// Save pull request record
if (prUrl && branchName && repo?.repo_name) {
    const [owner, repoName] = repo.repo_name.split('/')
    await PullRequest.findOneAndUpdate(
        { feature_id: featureId },
        {
            feature_id: featureId,
            pr_number: prNumber,
            pr_url: prUrl,
            branch_name: branchName,
            status: 'open',
            title: `feat: ${feature.title}`,
            description: 'Generated by AI Code Gen',
            repository: { owner, name: repoName },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    )
}

// Advance feature status: PLAN_APPROVED → CODE_GEN
if (feature.status === FeatureStatusEnum.PLAN_APPROVED) {
    feature.status = FeatureStatusEnum.CODE_GEN
    feature.statusHistory.push({
        status: FeatureStatusEnum.CODE_GEN,
        changedBy: { id: 'system', email: 'system' },
        changedAt: new Date(),
    })
    await feature.save()
}
```

---

### What Makes Code Generation Context-Aware

#### Before (Without Repo Context):
```typescript
// Generated auth.controller.ts

export class AuthController {
    async refresh(req, res) {
        const token = req.body.token
        // TODO: Verify token
        // TODO: Generate new token
        res.json({ token: "new-token" })
    }
}
```
❌ **Generic, incomplete, wrong patterns, doesn't match codebase**

#### After (With Repo Context):
```typescript
// Generated auth.controller.ts

import { Request, Response, NextFunction } from 'express'
import { AuthService } from './auth.service'
import { HttpError } from '../common/errors/http-error'

export class AuthController {
    static async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const { refresh_token } = req.body
            if (!refresh_token) {
                throw new HttpError(400, 'Refresh token is required')
            }
            const result = await AuthService.refreshTokens(refresh_token)
            res.status(200).json(result)
        } catch (err) {
            next(err)
        }
    }
}
```
✅ **Matches existing patterns:**
- ✅ Uses TypeScript types from existing code
- ✅ Imports HttpError from correct path (seen in other controllers)
- ✅ Static methods (same as signup/login in existing auth.controller.ts)
- ✅ Try-catch with next(err) (existing error handling pattern)
- ✅ Calls AuthService (follows existing architecture)
- ✅ Response format matches existing endpoints

---

### Console Output Example

```bash
[CodeGen] Reading repository context from: /Users/usl-sz-1829/Desktop/Automation-Back-End
[CodeGen] Scanned 35 files, 87423 characters
[Bedrock] Sending prompt (94,521 characters) to Claude...
[Bedrock] Response received (8,734 characters)
[CodeGen] Parsed 3 files from AI response
[CodeGen] Writing files to disk:
  ✓ src/auth/auth.controller.ts (1,234 bytes)
  ✓ src/auth/auth.service.ts (2,456 bytes)
  ✓ src/auth/auth.router.ts (234 bytes)
[GitHub] Creating branch: feature/automation-platform/refresh-token-support
[GitHub] Committing 3 files...
[GitHub] Pushing to remote...
[GitHub] Creating pull request...
[GitHub] ✓ PR created: https://github.com/org/automation-backend/pull/42
[CodeGen] Done for feature 507f1f77bcf86cd799439011
[CodeGen] Files: src/auth/auth.controller.ts, src/auth/auth.service.ts, src/auth/auth.router.ts
[CodeGen] PR: https://github.com/org/automation-backend/pull/42
[CodeGen] Feature status updated: PLAN_APPROVED → CODE_GEN
```

---

## Repository Context System

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Repository Context Reader                      │
│          (src/common/utils/repo-context-reader.ts)          │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │    QA    │   │   Plan   │   │ CodeGen  │
  │Orchestr. │   │Orchestr. │   │Orchestr. │
  └──────────┘   └──────────┘   └──────────┘
```

### Scanning Configuration

| Setting | Default | Purpose |
|---------|---------|---------|
| `maxFiles` | 40 | Maximum files to read (prevents excessive context) |
| `maxCharsPerFile` | 8000 | Truncate files larger than 8KB (prevents token overflow) |
| `maxDepth` | 4 | Directory traversal depth (prevents deep recursion) |
| `includeExtensions` | `.ts`, `.js`, `.tsx`, `.jsx`, `.json`, `.md` | File types to include |
| `excludeDirs` | `node_modules`, `dist`, `build`, `coverage`, `.git` | Directories to skip |

### File Prioritization Logic

**Priority 1 (Read First):**
- `package.json` — Dependencies, scripts
- `tsconfig.json` — TypeScript config
- `README.md` — Project overview
- `CLAUDE.md` — AI-specific instructions
- `.env.example` — Environment variables
- `main.ts`, `index.ts`, `App.tsx` — Entry points
- Any root-level source files

**Priority 2 (Read After):**
- All other files matching `includeExtensions`
- Depth-first traversal (subdirectories before siblings)

### Why Scan Multiple Times?

Each orchestrator scans independently:

```
User creates feature
    ↓
QA Generation (t=0)
    └─ Scans repo (state at t=0)
    └─ Generates test cases
    ↓
User approves QA
    ↓
Plan Generation (t=60 seconds)
    └─ Scans repo (state at t=60)  ← Codebase may have changed!
    └─ Generates plan
    ↓
User approves Plan
    ↓
Code Generation (t=180 seconds)
    └─ Scans repo (state at t=180)  ← Developer may have added files!
    └─ Generates code
```

**Why not cache?**
- Developer may edit files between stages
- Other team members may push changes
- Git branch may be switched
- Always use **current** state for maximum accuracy

---

## Quality & Relevance

### Code Quality Improvements

#### 1. Real API Endpoints

**Without Context:**
```json
{
  "steps": ["Call the login API", "Submit credentials"]
}
```

**With Context:**
```json
{
  "steps": [
    "Send POST /api/auth/login with body: { email: 'test@example.com', password: 'pass123' }",
    "Verify response.status === 200",
    "Verify response.data contains: { access_token, refresh_token, user: { id, email } }"
  ]
}
```

---

#### 2. Actual Module Imports

**Without Context:**
```typescript
import { someFunction } from './utils'
```

**With Context:**
```typescript
import { HttpError } from '../common/errors/http-error'  // ← Seen in repo context
import { AuthService } from './auth.service'             // ← Existing file
```

---

#### 3. Consistent Error Handling

**Without Context:**
```typescript
if (error) {
    res.status(500).json({ error: "Something went wrong" })
}
```

**With Context:**
```typescript
try {
    // ... logic
} catch (err) {
    next(err)  // ← Matches existing pattern (error.middleware.ts handles it)
}
```

---

#### 4. Database Patterns

**Without Context:**
```typescript
const user = db.query("SELECT * FROM users WHERE id = ?", [userId])
```

**With Context:**
```typescript
const user = await User.findById(userId)  // ← Mongoose pattern from existing code
if (!user) {
    throw new HttpError(404, 'User not found')
}
```

---

### Relevance to Real Codebase

| Aspect | Without Context | With Context |
|--------|----------------|--------------|
| **File Paths** | Generic (`src/auth.ts`) | Exact (`src/auth/auth.controller.ts`) |
| **Imports** | Guessed | Observed from existing files |
| **Naming** | Inconsistent | Matches codebase conventions |
| **Architecture** | Generic MVC | Follows actual structure (controller/service/router) |
| **Error Handling** | Try-catch or none | Uses project's HttpError + next(err) |
| **Types** | Any or missing | TypeScript interfaces from existing code |
| **DB Queries** | Raw SQL or generic | Mongoose models with actual schema |
| **Status Transitions** | Direct assignment | Uses FeatureStateMachine.transition() |

---

### Small vs. Large Repository Behavior

#### Small Repository (< 50 files)

**Characteristics:**
- Total files: 20-40
- All files scanned (within `maxFiles` limit)
- Fast scanning: 100-300ms
- Context size: 30,000-80,000 chars

**Quality:**
- ✅ Complete picture of codebase
- ✅ All patterns captured
- ✅ No missing dependencies
- ✅ Accurate imports

**Example:**
```
Automation-Back-End/
  src/
    auth/           (4 files)
    feature/        (5 files)
    ai/             (8 files)
    github/         (4 files)
    common/         (6 files)
  package.json
  tsconfig.json
  
Total: 29 files → All scanned
```

---

#### Medium Repository (50-200 files)

**Characteristics:**
- Total files: 50-200
- Partial scanning (hits `maxFiles: 40` limit)
- Priority files included (package.json, entry points, root files)
- Moderate scanning: 300-800ms
- Context size: 80,000-150,000 chars

**Quality:**
- ✅ Core patterns captured
- ✅ Main modules included
- ⚠️ Some utility files skipped
- ✅ Architecture still clear

**Strategy:**
1. Read all priority files (package.json, main.ts, etc.)
2. Read root-level files
3. Read files in top-level directories (src/auth, src/feature)
4. Truncate deep nested files if limit reached

**Example:**
```
Automation-Back-End/
  src/
    auth/           (4 files)   ← All read
    feature/        (8 files)   ← All read
    ai/             (15 files)  ← Priority files read, some skipped
    github/         (6 files)   ← All read
    common/         (12 files)  ← Priority read, deep utils skipped
    utils/          (25 files)  ← Only priority read
    types/          (10 files)  ← Some read
  package.json      ← Read (priority)
  tsconfig.json     ← Read (priority)
  
Total: 82 files → 40 read (priority-based selection)
```

---

#### Large Repository (200+ files)

**Characteristics:**
- Total files: 200-1000+
- Selective scanning (limited to 40 files)
- Priority files heavily weighted
- Slower scanning: 800-2000ms
- Context size: 150,000-200,000 chars (near token limit)

**Quality:**
- ✅ Core architecture captured
- ⚠️ Many utility files missed
- ⚠️ Deep nested modules skipped
- ⚠️ May miss specialized patterns

**Mitigation Strategies:**

1. **Use `CLAUDE.md` file:**
   ```markdown
   # Project Structure
   - Auth: JWT tokens, bcrypt hashing, refresh tokens (15m/7d expiry)
   - Features: Status machine pattern, no direct status assignment
   - AI: All Bedrock calls via bedrock.client.ts
   - Errors: Use HttpError(code, message) + next(err)
   ```
   *(CLAUDE.md is priority file, always read)*

2. **Adjust scanning config:**
   ```typescript
   // For large repos, increase limits
   getRepositoryContext(repoPath, {
       maxFiles: 60,           // More files
       maxCharsPerFile: 6000,  // Smaller per file (more files fit)
       maxDepth: 5             // Deeper traversal
   })
   ```

3. **Manual context in prompts:**
   ```typescript
   // Add project-specific instructions to prompts
   const additionalContext = `
   IMPORTANT PATTERNS:
   - All errors: throw new HttpError(code, message)
   - Status transitions: FeatureStateMachine.transition()
   - DB: Mongoose models, no raw queries
   `
   ```

---

## Performance Characteristics

### Timing Breakdown

#### QA Generation (30-90 seconds)
```
Repo scanning:        0.5s  (read 40 files)
Format context:       0.1s  (build markdown)
Build prompt:         0.05s (template substitution)
Bedrock API call:     25-60s (Claude inference)
Parse JSON:           0.1s  (extract test cases)
Save to MongoDB:      0.2s  (upsert operation)
Update feature:       0.1s  (status transition)
─────────────────────────────
Total:                ~30-90s
```

#### Plan Generation (45-120 seconds)
```
Fetch test cases:     0.2s  (MongoDB query)
Repo scanning:        0.5s  (read 40 files)
Format context:       0.1s  (build markdown)
Build prompt:         0.1s  (include test cases)
Bedrock API call:     40-90s (larger prompt, longer plan)
Parse response:       0.05s (markdown, no JSON parsing)
Save to MongoDB:      0.2s  (upsert plan)
Update feature:       0.1s  (status transition)
─────────────────────────────
Total:                ~45-120s
```

#### Code Generation (60-180 seconds)
```
Fetch plan:           0.2s  (MongoDB query)
Repo scanning:        0.5s  (read 40 files)
Format context:       0.1s  (build markdown)
Build prompt:         0.1s  (include plan)
Bedrock API call:     40-100s (32K token limit, code generation)
Parse JSON:           0.2s  (extract files array)
Write files to disk:  0.3s  (create dirs, write 3-10 files)
GitHub branch:        1.5s  (create ref)
GitHub commit:        3.0s  (create blobs, tree, commit)
GitHub push:          2.0s  (update ref)
GitHub PR:            1.5s  (create PR)
Save to MongoDB:      0.3s  (save codegen + PR records)
Update feature:       0.1s  (status transition)
─────────────────────────────
Total:                ~60-180s
```

### Bottlenecks

1. **Bedrock API (80-90% of time)**
   - Inference time: 25-100s depending on complexity
   - Cannot be optimized (AWS Bedrock processing)
   - Larger prompts → longer inference

2. **GitHub API (5-10% of time, code gen only)**
   - Multiple API calls (branch, blobs, tree, commit, PR)
   - Network latency
   - Can fail (non-fatal, code still written to disk)

3. **File I/O (2-5% of time)**
   - Reading 40 files from disk: 200-800ms
   - Writing generated files: 100-500ms
   - Fast on SSD, slower on network drives

4. **MongoDB (< 1% of time)**
   - Queries are fast with proper indexes
   - Upserts are efficient

---

## Troubleshooting

### Common Issues

#### 1. Repository Not Found

**Error:**
```
HttpError 400: Repository directory not found at "/Users/.../Automation-Back-End"
```

**Causes:**
- `LOCAL_REPO_PATH` env variable not set
- Project `localPath` incorrect
- Repository not cloned locally

**Solution:**
```bash
# Set environment variable
export LOCAL_REPO_PATH=/Users/usl-sz-1829/Desktop

# Or add to .env
echo "LOCAL_REPO_PATH=/Users/usl-sz-1829/Desktop" >> .env

# Verify path exists
ls ${LOCAL_REPO_PATH}/Automation-Back-End
```

---

#### 2. No Files Scanned

**Error:**
```
[QA] Scanned 0 files, 0 characters
```

**Causes:**
- Repository is empty
- Wrong file extensions (no `.ts` or `.js` files)
- All files excluded (in `node_modules`, `dist`, etc.)

**Solution:**
```bash
# Check repo structure
ls -la /path/to/repo/

# Verify source files exist
find /path/to/repo -name "*.ts" -o -name "*.js"
```

---

#### 3. Bedrock Returns Invalid JSON

**Error:**
```
HttpError 400: AI returned invalid JSON
```

**Causes:**
- Prompt too large (exceeds token limit)
- Claude included markdown code fences
- Response truncated

**Solution:**
```typescript
// Check prompt size before sending
console.log(`Prompt size: ${prompt.length} characters`)

// Reduce maxFiles if too large
getRepositoryContext(repoPath, {
    maxFiles: 30,        // Reduce from 40
    maxCharsPerFile: 6000 // Reduce from 8000
})
```

---

#### 4. Generated Code Has Wrong Imports

**Error:**
```typescript
// Generated file tries to import from wrong path
import { User } from './models/user'  // ❌ File doesn't exist
```

**Causes:**
- Relevant files not included in scan
- Priority files missed
- Repository structure changed

**Solution:**
1. Add `CLAUDE.md` to repo root:
   ```markdown
   # Import Patterns
   - Models: `src/{module}/{module}.model.ts` (e.g., `src/auth/user.model.ts`)
   - Services: `src/{module}/{module}.service.ts`
   - Controllers: `src/{module}/{module}.controller.ts`
   ```

2. Ensure key files are scanned:
   ```typescript
   // Check logs
   [QA] Scanned 35 files, 87423 characters
   
   // If low, increase maxFiles
   maxFiles: 60
   ```

---

#### 5. GitHub PR Creation Fails

**Error:**
```
[GitHub] PR creation failed: Bad credentials
```

**Causes:**
- Missing or invalid GitHub token
- Token lacks required permissions
- Repository doesn't exist
- Branch already exists

**Solution:**
```bash
# Verify token in database
db.projects.findOne({ _id: ObjectId("...") }, { githubToken: 1 })

# Token needs permissions:
# - repo (full control)
# - workflow (if using GitHub Actions)

# Create new token at:
# https://github.com/settings/tokens
```

---

## Summary

### Key Points

1. **Three-Phase Process:**
   - QA: Generate test cases based on feature + repo context
   - Plan: Generate implementation plan based on test cases + repo context
   - Code: Generate code based on plan + repo context

2. **Repository Context is Critical:**
   - Scans 40 files (configurable)
   - Reads actual code (up to 8KB per file)
   - Formats as markdown with file tree + contents
   - Injected into every AI prompt

3. **Context-Aware Output:**
   - Test cases reference real API endpoints
   - Plans reference actual files and patterns
   - Generated code matches existing style

4. **Quality vs. Repository Size:**
   - Small repos (< 50 files): Complete coverage
   - Medium repos (50-200 files): Partial, priority-based
   - Large repos (200+ files): Core architecture only

5. **Performance:**
   - QA: ~30-90s (mostly Bedrock inference)
   - Plan: ~45-120s (longer inference)
   - Code: ~60-180s (inference + GitHub API)

6. **Output:**
   - QA: JSON array of test cases → MongoDB
   - Plan: Markdown development plan → MongoDB
   - Code: Files written to disk + GitHub PR opened

---

## Environment Variables Required

```bash
# AWS Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# Local Repository
LOCAL_REPO_PATH=/Users/usl-sz-1829/Desktop
PROJECT_ROOT=/Users/usl-sz-1829/Desktop  # Alternative name

# MongoDB
MONGO_URI=mongodb://localhost:27017/automation

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# GitHub (stored in project.githubToken, not env)
# Token needs: repo, workflow permissions
```

---

## Monitoring & Logs

### Expected Console Output

```bash
# QA Generation
[QA] Reading repository context from: /Users/usl-sz-1829/Desktop/Automation-Back-End
[QA] Scanned 35 files, 87423 characters
[Bedrock] Sending prompt (89,234 characters) to Claude...
[Bedrock] Response received (4,521 characters)
[QA] Generated 12 test cases for feature: User Authentication
[QA] Feature status updated: CREATED → QA

# Plan Generation
[Plan] Reading repository context from: /Users/usl-sz-1829/Desktop/Automation-Back-End
[Plan] Scanned 35 files, 87423 characters
[Bedrock] Sending prompt (96,734 characters) to Claude...
[Bedrock] Response received (6,234 characters)
[Plan] Generated development plan for feature: User Authentication
[Plan] Feature status updated: QA_APPROVED → DEV

# Code Generation
[CodeGen] Reading repository context from: /Users/usl-sz-1829/Desktop/Automation-Back-End
[CodeGen] Scanned 35 files, 87423 characters
[Bedrock] Sending prompt (94,521 characters) to Claude...
[Bedrock] Response received (8,734 characters)
[CodeGen] Parsed 3 files from AI response
[CodeGen] Writing files to disk:
  ✓ src/auth/auth.controller.ts (1,234 bytes)
  ✓ src/auth/auth.service.ts (2,456 bytes)
  ✓ src/auth/auth.router.ts (234 bytes)
[GitHub] Creating branch: feature/automation-platform/user-authentication
[GitHub] Committing 3 files...
[GitHub] Pushing to remote...
[GitHub] Creating pull request...
[GitHub] ✓ PR created: https://github.com/org/automation-backend/pull/42
[CodeGen] Done for feature 507f1f77bcf86cd799439011
[CodeGen] Feature status updated: PLAN_APPROVED → CODE_GEN
```

---

**Last Updated:** 2026-04-21  
**Version:** 1.0  
**Project:** AI SDLC Automation Platform
