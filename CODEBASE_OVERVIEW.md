# Codebase Overview: Automation Back-End

This document provides a comprehensive overview of the `automation-back-end` repository. It is a Node.js + Express backend designed to power an AI SDLC Automation Platform (a Jira replacement using Amazon Bedrock / Claude + GitHub to automate software development workflows).

---

## 1. Tech Stack

- **Runtime & Framework**: Node.js, Express (REST API)
- **Database**: MongoDB (via Mongoose)
- **Language**: TypeScript (`ts-node` for local dev)
- **AI Integration**: Amazon Bedrock (`@aws-sdk/client-bedrock-runtime`)
- **Authentication**: JWT (JSON Web Tokens) with `bcrypt` for password hashing
- **Deployment & Cloud**: Configured targeting AWS (ECS, API Gateway, S3)

---

## 2. Directory Structure

The project code resides in the `src/` directory, following a feature-based, self-contained modular architecture.

```
src/
├── ai/                # AI infrastructure & prompting layer
│   ├── models/        # Data structures for code-gen, plan, QA
│   ├── orchestrators/ # Complex AI workflows (QA, Planning, CodeGen)
│   ├── prompts/       # Raw AI system instructions and templates
│   ├── ai.router.ts, ai.controller.ts, bedrock.client.ts
│
├── auth/              # Authentication & User Management
│   ├── auth.controller.ts, auth.router.ts, auth.service.ts
│   └── user.model.ts  # Mongoose model for User
│
├── feature/           # "Feature" (Task/Issue) Core Logic
│   ├── feature.controller.ts, feature.router.ts, feature.service.ts
│   ├── feature.model.ts
│   └── feature.state-machine.ts # Handles state transitions (e.g. QA -> DEV -> PR_CREATED)
│
├── common/            # Shared cross-cutting components
│   ├── errors/        # Error definition classes (HttpError etc.)
│   └── middleware/    # Express middlewares (auth, error handled globally, not_found)
│
├── routes/            # Route aggregator
│   └── index.ts       # Maps all feature routers and applies auth middleware appropriately
│
├── demo/              # Demonstration / Playgrounds
│
└── main.ts            # Entrypoint: Express app initialization & MongoDB connect
```

---

## 3. Key Components & Architecture

### **3.1 Routing & Middleware (`src/routes/` & `src/common/middleware/`)**
- `registerRoutes`: All module routers (`auth.router.ts`, `feature.router.ts`, etc.) are aggregated here. It determines whether routes are public or protected.
- Protected routes automatically receive `authMiddleware.ts` to attach `req.user`.
- API endpoints are generally prefixed (e.g. `/api/auth`, `/api/features`).
- Errors are unhandled in routes, caught and processed by `error.middleware.ts`.

### **3.2 Modular Services & Controllers**
Every major domain (e.g., Auth, Feature) has:
- A `.router.ts` referencing a `.controller.ts`.
- A `.controller.ts` processing requests, validating inputs, and delegating to a `.service.ts`.
- A `.model.ts` which is fully owned by its domain. No centralized "models" folder exists, ensuring strict separation.

### **3.3 The Core State Machine (`feature.state-machine.ts`)**
Instead of allowing arbitrary status updates, a feature ticket's lifecycle must go through predefined transitions defined within the state machine.
- Path: `CREATED → QA → QA_APPROVED → DEV → PLAN_APPROVED → CODE_GEN → PR_CREATED → DONE`
- Transition calls trigger hooks (`validate`, `execute`, `postExecute`).

### **3.4 AI Bedrock Integration (`src/ai/`)**
Interactions with Amazon's Claude models are heavily orchestrated here.
- `bedrock.client.ts` centralizes API calls (and streaming).
- `orchestrators/` (like `qa.orchestrator.ts`) piece together the business need (read conversation history, gather feature description, pass into specific prompts).
- `prompts/` define the explicit instructional boundaries given to the LLM.

---

## 4. Workflows

### **Code Execution Workflow:**
- `$ npm run dev`: Boots server via `nodemon` mapping `main.ts` using `ts-node`.
- MongoDB connection is established globally; Express opens `PORT` (default `3000`).

### **AI Generation Workflow (Example: QA Generation):**
1. User requests QA cases. The API routes to `ai.controller.ts`.
2. Controller initializes `qa.orchestrator.ts`.
3. Orchestrator looks at the feature, reads constraints, grabs system messages from `qa.prompt.ts`.
4. Executes the unified API call via `bedrock.client.ts`.
5. Upon AI response, parses/validates the returned schema before persisting it to the database mapping it to the feature.
6. `feature.state-machine.ts` moves ticket to `QA` state.

---

## 5. Development Guidelines
- Always route database interactions through the specific `.model.ts` within the respective feature folder.
- Ensure all endpoints respond consistently. Avoid inline error catching where the global `errorMiddleware.ts` is more appropriate.
- When generating AI text, heavily constrain outputs inside `src/ai/prompts` to yield structural valid JSON.
