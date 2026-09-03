# Data Flow Architecture: AiMemorySync

## 1. Overview & Data Movement Principles
Data in AiMemorySync moves through three primary pipelines:
1. **Ingestion (Flow A)**: Capturing and distilling knowledge from AI interactions into structured memory.
2. **Retrieval (Flow B)**: Querying, filtering, and assembling relevant project context for an AI prompt.
3. **Synchronization (Flow C)**: Propagating shared project context across disparate AI platforms and developer environments.

Every flow is anchored by strict **user consent checkpoints** and **isolation boundaries** to protect proprietary code, secrets, and private conversational data.

---

## 2. Flow A: Knowledge Ingestion & Memory Capture

This flow executes when a user has a conversation with an AI platform (e.g., ChatGPT, Claude web, or Antigravity IDE) and useful project knowledge (a decision, architectural plan, bug resolution) is produced.

### 2.1 Sequence Diagram
```text
User / Platform       Connector / Adapter       AiMemorySync API        Memory Engine       Storage
      │                        │                       │                      │                │
      │ 1. Interaction occurs  │                       │                      │                │
      ├───────────────────────►│                       │                      │                │
      │                        │ 2. Detect candidate   │                      │                │
      │                        │    knowledge          │                      │                │
      │ 3. Consent Prompt /    │                       │                      │                │
      │    Auto-Approve Check  │                       │                      │                │
      │◄───────────────────────┤                       │                      │                │
      │ 4. User Approves       │                       │                      │                │
      ├───────────────────────►│                       │                      │                │
      │                        │ 5. POST /api/ingest   │                      │                │
      │                        ├──────────────────────►│                      │                │
      │                        │                       │ 6. Validate & Token  │                │
      │                        │                       ├─────────────────────►│                │
      │                        │                       │    7. Extract &      │                │
      │                        │                       │       Structure      │                │
      │                        │                       │    8. Deduplicate    │                │
      │                        │                       │                      │ 9. Save Record │
      │                        │                       │                      ├───────────────►│
      │                        │                       │                      │ 10. Index Vec  │
      │                        │                       │                      ├───────────────►│
      │                        │ 11. Ingest ACK (201)  │                      │                │
      │                        │◄──────────────────────┤                      │                │
```

### 2.2 Step Details
1. **Interaction**: User and AI exchange messages.
2. **Detection**: The platform connector (browser extension or IDE plugin) detects potential high-value context (e.g., tags, explicit user commands like `@sync`, or heuristic pattern detection).
3. **Consent Boundary**: The connector verifies user consent. If manual review is configured, the user is prompted to confirm the payload before transmission.
4. **Transmission**: The payload (anonymized metadata, project ID, message content) is dispatched via secure HTTPS/TLS to the AiMemorySync API.
5. **Sanitization & Processing**: The API scrubs detected secrets (API keys, passwords, tokens) and passes content to the Memory Engine.
6. **Structuring & Storage**: The Memory Engine extracts structured entities, evaluates duplicate thresholds, increments versions if updating existing memories, stores records in the database, and generates vector embeddings.

---

## 3. Flow B: Context Retrieval & Prompt Injection

This flow executes when an AI platform begins a new task or conversation and requires up-to-date project context.

### 3.1 Sequence Diagram
```text
User / Agent          Connector / Adapter       AiMemorySync API      Retrieval Engine      Storage
      │                        │                       │                      │                │
      │ 1. Start task/prompt   │                       │                      │                │
      ├───────────────────────►│                       │                      │                │
      │                        │ 2. Identify Project   │                      │                │
      │                        │ 3. POST /api/context  │                      │                │
      │                        ├──────────────────────►│                      │                │
      │                        │                       │ 4. Authenticate &    │                │
      │                        │                       │    Verify Scope      │                │
      │                        │                       ├─────────────────────►│                │
      │                        │                       │    5. Hybrid Search  │ 6. Fetch Items │
      │                        │                       │       (Vector+Text)  ├───────────────►│
      │                        │                       │    7. Token Budget   │                │
      │                        │                       │    8. Format Bundle  │                │
      │                        │ 9. Return Context     │                      │                │
      │                        │◄──────────────────────┤                      │                │
      │                        │ 10. Inject context    │                      │                │
      │ 11. Augmented Prompt   │     into prompt       │                      │                │
      │◄───────────────────────┤                       │                      │                │
```

### 3.2 Step Details
1. **Trigger**: A user prompts an AI agent or opens a project workspace.
2. **Project Identification**: The connector resolves the target project ID via repository metadata, workspace settings, or user selection.
3. **Query Dispatch**: The connector sends a retrieval query containing the prompt summary, active file references, and requested token budget.
4. **Retrieval & Scoping**: The Retrieval Engine queries the storage layer strictly within the authenticated project boundary. It performs hybrid search (combining exact keyword matching and semantic cosine distance).
5. **Token Budgeting & Synthesis**: Retrieved memories are ranked by relevance score and truncated to fit within the designated prompt token limit.
6. **Prompt Augmentation**: The connector prefixes or inserts the structured context block into the prompt before the AI model responds.

---

## 4. Flow C: Multi-Platform Collaborative Synchronization *(Post-MVP Target)*

This flow illustrates the conceptual architecture for multiple disparate AI platforms (e.g., ChatGPT web and Antigravity IDE) collaborating on the same project without direct vendor-to-vendor connections. In the MVP, this synchronization occurs sequentially via shared project memory; automated real-time background propagation is a Post-MVP enhancement.

```text
┌────────────────────────┐                   ┌────────────────────────┐
│  AI Platform A (Web)   │                   │ AI Platform B (IDE)    │
│       (ChatGPT)        │                   │     (Antigravity)      │
└───────────┬────────────┘                   └───────────▲────────────┘
            │                                            │
            ▼                                            │
┌────────────────────────┐                   ┌───────────┴────────────┐
│ Browser Ext. Connector │                   │  IDE Plugin Connector  │
└───────────┬────────────┘                   └───────────▲────────────┘
            │                                            │
            │ 1. Capture Decision                        │ 5. Retrieve Context
            │    ("Switch to Turbopack")                 │    ("Project uses
            ▼                                            │     Turbopack")
┌────────────────────────────────────────────────────────┴────────────┐
│                       AiMemorySync Core                             │
│                                                                     │
│  2. Ingest & Validate Decision                                      │
│  3. Update Project Memory Store                                     │
│  4. Emit Sync Event / Invalidate Cache (Post-MVP)                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.1 Scenario Walkthrough
1. **Interaction on Platform A**: A developer discussions architectural trade-offs on ChatGPT web. They decide to adopt Turbopack for local development.
2. **Capture**: The browser extension captures the agreed decision upon user confirmation and sends it to AiMemorySync.
3. **Storage**: AiMemorySync registers `DECISION: Adopt Turbopack for local dev` and links it to Project `AiMemorySync`.
4. **Transition to Platform B**: Later, the developer opens Antigravity IDE and asks the coding agent: *"Add a development script to package.json."*
5. **Retrieval**: Before generating the code, the IDE connector requests active project context from AiMemorySync.
6. **Consistent Generation**: AiMemorySync returns the active decision. The coding agent generates `"dev": "next dev --turbopack"` rather than a generic webpack script, preventing regressions without the user having to re-explain the prior conversation.

---

## 5. Trust, Consent & Security Checkpoints

| Checkpoint | Location | Enforcement Mechanism |
|---|---|---|
| **Capture Consent** | Client Connector (Browser/IDE) | User must explicitly approve capture mode (Manual confirm per interaction, or Opt-in domain whitelist). |
| **Payload Sanitization** | Client & API Ingestion Gateway | Regex and entropy-based secret scanning detects and redacts tokens, private keys, and passwords before storage. |
| **Tenant / Project Scoping** | API Layer & Database Query | Every read/write requires authenticated user credentials and verifies project membership. Cross-tenant queries return 403 Forbidden. |
| **Context Egress Control** | Platform Adapter | Outbound context to external LLMs contains only distilled project context; sensitive personal or out-of-scope files are excluded. |

---

## 6. Failure & Disconnected State Handling
- **Offline Ingestion**: If AiMemorySync API is temporarily unreachable, connectors queue captured memory candidates locally in encrypted persistent storage until connectivity is restored.
- **Retrieval Fallback**: If real-time retrieval fails or times out (exceeding a user-configured timeout threshold), connectors fall back gracefully to local cached project memory without blocking the developer's conversation turn.
- **Conflict Resolution**: If two platforms submit conflicting memory updates simultaneously, the engine relies on monotonically increasing version timestamps, flags the discrepancy, and queues a conflict resolution task in the user dashboard.

---

## 7. Core REST API Lifecycle (Implemented in Phase 3D)

The concrete HTTP request-response pipeline for Project and Memory endpoints:

```text
HTTP Client (Browser / Extension / IDE)
               │
               ▼
[ Next.js App Router Route Handlers ] (src/app/api/*)
  - Method routing (GET, POST, PATCH, DELETE)
  - Async parameter resolution (`await params`)
               │
               ▼
[ Request Parsing & Zod Validation ] (src/lib/api/response.ts & src/validations/*)
  - Safe JSON body parsing (syntax errors return 400 VALIDATION_ERROR)
  - URL query parameter validation (invalid query returns 400)
  - UUID format validation
               │
               ▼
[ Domain Service Layer ] (src/services/*)
  - Project business logic (uniqueness checks, slug normalization)
  - Memory business logic (normalization, SHA-256 hashing, project-isolated duplicate checks)
  - Domain error throwing (ValidationError, NotFoundError, ConflictError)
               │
               ▼
[ Prisma ORM Client Singleton ] (src/lib/prisma.ts)
               │
               ▼
[ Managed PostgreSQL Database ] (Supabase hosting)
               │
               ▼
[ Standardized API Response / Error Mapper ] (src/lib/api/error-handler.ts)
  - Success: 200/201 `{ "data": ... }`
  - Validation: 400 `{ "error": { "code": "VALIDATION_ERROR", ... } }`
  - Not Found: 404 `{ "error": { "code": "PROJECT_NOT_FOUND" | "MEMORY_NOT_FOUND", ... } }`
  - Conflict: 409 `{ "error": { "code": "PROJECT_SLUG_CONFLICT" | "MEMORY_DUPLICATE", ... } }`
  - Internal: 500 `{ "error": { "code": "INTERNAL_ERROR", "message": "An unexpected error occurred" } }`
```
