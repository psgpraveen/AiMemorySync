# System Architecture: AiMemorySync

## 1. System Purpose & Vision
AiMemorySync is an independent, shared memory and context synchronization layer designed to enable diverse AI platforms and autonomous coding agents (e.g., ChatGPT, Antigravity IDE, Claude, Gemini) to collaborate on shared projects while preserving consistent, structured, and long-term project context.

AiMemorySync **does not assume or require direct access to the private internal memory or proprietary backends** of external AI platforms. Instead, it operates an independent, user-governed context layer that captures user-approved insights, structures them, and provides timely, relevant context back to any connected AI platform.

---

## 2. Implementation Status: Current Phase vs. Future Components

To ensure complete architectural honesty, components are strictly categorized by their current status:

| Component | Status | Description |
|---|---|---|
| **Project Foundation** | **CURRENT IMPLEMENTATION** | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Turbopack, ESLint baseline. |
| **System Blueprints & Docs** | **CURRENT IMPLEMENTATION** | Conceptual architectures, data models, memory lifecycles, and security specifications. |
| **Database Foundation** | **CURRENT IMPLEMENTATION** | Prisma ORM 6.4.1, PostgreSQL on Supabase, `Project` and `Memory` models, migration `20260903053609_init`. |
| **Core Domain Layer** | **CURRENT IMPLEMENTATION** | Zod 4 validation, typed errors, deterministic normalization, SHA-256 memory hashing, domain services (`project.service`, `memory.service`). |
| **Core REST API Layer** | **CURRENT IMPLEMENTATION** | Next.js App Router route handlers for Projects and Memories (`GET`, `POST`, `PATCH`, `DELETE`), safe request parsing, centralized error handling. |
| **Web Application UI** | Future Component | User dashboard, manual memory curation, workspace settings, consent manager. |
| **Platform Adapter Layer** | Future Component | Pluggable interface translating between external AI platforms and standard schemas. |
| **Browser Extension** | Future Component | User-controlled capture and context injection for web-based AI chats (e.g., ChatGPT, Claude web). |
| **Context Retrieval Engine** | Future Component | Semantic search, relevance ranking, project scoping, and context packaging. |
| **Synchronization Engine** | Future Component | Multi-client event handling, conflict resolution, offline queueing. |
| **Vector Store** | Future Component | Vector embeddings storage and pgvector semantic indexing. |
| **Remote Coding / Agent Bridge** | Future Concept | Optional daemon bridging local IDE environments and remote execution. |

---

## 3. High-Level Conceptual Architecture

```text
       [ External AI Platforms ]
  (ChatGPT, Claude, Antigravity, Gemini)
                  ↕
       [ Platform Adapter Layer ]
  (Browser Extension, IDE Plugins, Webhooks)
                  ↕
═════════════════════════════════════════════════
          AiMemorySync Core System
═════════════════════════════════════════════════
   ┌────────────────────────────────────────┐
   │            API Gateway / Router        │
   │  (Authentication, Rate Limits, Consent)│
   └───────────────────┬────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌─────────────────────┐     ┌─────────────────────┐
│    Memory Engine    │     │  Context Retrieval  │
│ - Raw Ingestion     │     │ - Semantic Query    │
│ - Structuring       │     │ - Relevance Filter  │
│ - Deduplication     │     │ - Token Budgeting   │
│ - Versioning        │     │ - Context Formatter │
└──────────┬──────────┘     └──────────▲──────────┘
           │                           │
           └───────────┬───────────────┘
                       ▼
           ┌───────────────────────┐
           │  Sync & Event Engine  │
           │ - Event Broadcast     │
           │ - Conflict Resolution │
           └───────────┬───────────┘
                       ▼
           ┌───────────────────────┐
           │     Storage Layer     │
           │ - Relational Store    │
           │ - Vector Index        │
           │ - Audit / Event Log   │
           └───────────────────────┘
```

---

## 4. Main System Components & Responsibilities

### 4.1 Web Application (Dashboard)
- **Role**: Presentation and management surface.
- **Responsibilities**:
  - Provide users with full visibility into captured memories, active projects, and connected agents.
  - Allow users to manually view, edit, tag, search, export, or permanently delete memories.
  - Provide consent and privacy controls (e.g., domain whitelists, sensitive keyword redaction).

### 4.2 Platform Adapter Layer & Browser Extension
- **Role**: Translation boundary between external AI interfaces and AiMemorySync.
- **Responsibilities**:
  - Detect active AI sessions and determine corresponding project context (with explicit user approval).
  - Extract relevant conversation snippets or user-prompted context.
  - Format and inject retrieved AiMemorySync context into external AI prompts.
  - Ensure zero passive or unconsented recording of user activity.

### 4.3 API Layer
- **Role**: Entry point for all clients (web app, extensions, plugins, CLI).
- **Responsibilities**:
  - Authenticate requests, validate tokens/sessions, enforce tenant/workspace isolation.
  - Expose endpoints for memory ingestion, structured querying, and project context assembly.
  - Validate and sanitize all incoming payloads before processing.

### 4.4 Memory Engine
- **Role**: Core intelligence for processing and organizing knowledge.
- **Responsibilities**:
  - Classify incoming memory candidates into distinct categories (raw, structured, project, global).
  - Extract structured items (decisions, requirements, technical constraints, bugs, solutions).
  - Detect duplicates and merge incremental insights into existing records.
  - Maintain historical versions and provenance records for each memory entry.

### 4.5 Context Retrieval Engine
- **Role**: Query processor that matches user/agent task needs with pertinent project knowledge.
- **Responsibilities**:
  - Perform hybrid retrieval (exact match, lexical keyword, semantic vector search).
  - Filter results strictly by active project, workspace, and user permissions.
  - Apply token budgeting algorithms to condense retrieved memories into prompt-ready context blocks.

### 4.6 Synchronization Engine
- **Role**: Real-time event coordinator.
- **Responsibilities**:
  - Broadcast memory updates to connected agents and active client sessions.
  - Handle concurrent write conflicts using deterministic precedence and version checks.
  - Manage offline queueing and eventual consistency when clients temporarily disconnect.

### 4.7 Database & Storage Layer
- **Role**: Persistence mechanism.
- **Responsibilities**:
  - Store core entities, relational links, and audit histories.
  - Maintain vector indices for semantic context search.
  - Enforce referential integrity and strict workspace/project data partitioning.

---

## 5. System Boundaries & Separation of Concerns

1. **Client Boundary**: External AI platforms and client extensions communicate strictly via defined API contracts. External clients never have direct database access.
2. **Platform Isolation**: Platform adapters translate platform-specific quirks into standardized AiMemorySync schemas. The internal core is completely agnostic of whether an interaction came from ChatGPT, Antigravity, or Claude.
3. **Project Isolation**: Every memory, conversation, and sync event is strongly bound to a project and workspace. Cross-project context leakage is prevented by default at the data retrieval boundary.
4. **Consent Boundary**: Capture and context injection require explicit user authorization. No background automated scraping occurs without user enablement.

---

## 6. Conceptual Core Entities (Data Model)

The conceptual data model defines the core entities, their ownership, relationships, and scope:

```text
[User] ──(owns/belongs to)──► [Workspace] ──(contains)──► [Project]
                                                              │
                     ┌────────────────────────────────────────┼────────────────────────┐
                     ▼                                        ▼                        ▼
               [Conversation]                             [Memory]                [Sync Event]
                     │                                        │                        │
                     ▼                                        │                        │
                 [Message] ◄──── [Memory Source] ─────────────┘                        │
                                        │                                              │
                                        ▼                                              ▼
                                   [AI Agent] ◄─────────────────────────────────── [Device]
                                        │
                                        ▼
                                  [AI Platform]
```

### 6.1 Entity Definitions

#### User
- **Purpose**: Represents an authenticated human individual using the system.
- **Ownership**: Top-level identity.
- **Relationships**: Owns or belongs to one or more Workspaces; owns Devices and API tokens.
- **Scope**: Global.

#### Workspace
- **Purpose**: High-level organizational tenant (e.g., Personal, Team, Organization).
- **Ownership**: Owned by a User or Organization.
- **Relationships**: Contains multiple Projects, Users (collaborators), and platform configurations.
- **Scope**: Global / Tenant boundary.

#### Project
- **Purpose**: Represents a specific codebase, product, or development effort (e.g., AiMemorySync).
- **Ownership**: Belongs to a Workspace.
- **Relationships**: Contains Conversations, Memories, Context packages, and Sync Events.
- **Scope**: Project-specific.

#### AI Platform
- **Purpose**: Metadata entity identifying an external AI provider (e.g., OpenAI, Anthropic, Google).
- **Ownership**: System-defined catalog or user-defined configuration.
- **Relationships**: Associated with Platform Adapters and AI Agents.
- **Scope**: Global.

#### AI Agent
- **Purpose**: Represents an active AI participant or persona (e.g., ChatGPT-4o, Antigravity Coding Assistant, Claude 3.7 Sonnet).
- **Ownership**: Configured within a Workspace or Project.
- **Relationships**: Executes Conversations, produces Messages, generates Memory Sources.
- **Scope**: Global / Workspace-specific.

#### Conversation
- **Purpose**: A recorded dialogue or session between a User and an AI Agent.
- **Ownership**: Belongs to a Project and a User.
- **Relationships**: Contains Messages; links to Memory Sources.
- **Scope**: Project-specific (or Global if unattached).

#### Message
- **Purpose**: An individual turn (prompt or response) within a Conversation.
- **Ownership**: Belongs to a Conversation.
- **Relationships**: Has an author (User or AI Agent); referenced by Memory Sources.
- **Scope**: Project-specific.

#### Memory
- **Purpose**: A discrete, persistent unit of preserved knowledge (decision, pattern, bug, requirement, architectural rule).
- **Ownership**: Belongs to a Project (or Workspace/User if categorized as Global).
- **Relationships**: Originates from one or more Memory Sources; linked to Categories and Tags.
- **Scope**: Project-specific or Global depending on category.

#### Memory Source
- **Purpose**: Provenance tracking documenting where, when, and by whom a memory was produced.
- **Ownership**: Belongs to a Memory.
- **Relationships**: References a Message, Conversation, external document, or manual user input.
- **Scope**: Project-specific.

#### Context
- **Purpose**: A compiled, filtered bundle of relevant memories prepared for injection into a specific AI prompt.
- **Ownership**: Ephemeral; generated on behalf of a User and AI Agent for a specific task.
- **Relationships**: Aggregates multiple Memories; attached to a Project.
- **Scope**: Project-specific and session-ephemeral.

#### Sync Event
- **Purpose**: An audit and distribution record indicating that memory was created, updated, or invalidated.
- **Ownership**: Belongs to a Project.
- **Relationships**: References the affected Memory and the originating Device/Agent.
- **Scope**: Project-specific.

#### Device
- **Purpose**: A client endpoint (e.g., Developer Workstation, Laptop, Browser instance) running an adapter or IDE extension.
- **Ownership**: Owned by a User.
- **Relationships**: Initiates Sync Events; holds local cache.
- **Scope**: User-specific.

---

## 7. Future Scalability & Extensibility Direction
- **Modular Monolith to Distributed Services**: The core starts inside Next.js (App Router API routes and server actions), designed cleanly so that compute-heavy services (embedding generation, semantic retrieval, real-time synchronization) can be split into dedicated background workers in the future without redesigning contracts.
- **Pluggable Vector Backends**: Retrieval abstractions will support pluggable backends (local vector indices for self-hosting, hosted vector services for cloud scale).
- **Offline-First Capabilities**: Local adapter caches and sync event logs will allow coding agents to query project context even during intermittent network connectivity.

---

## 8. Implementation Roadmap & MVP Scope Boundary

To prevent overengineering and keep Phase 3 focused on proving core value, system components are strictly partitioned:

### 8.1 MVP Required (Phase 3 Scope)
- **Minimal Web Interface**: Project selection, view active memories, manual memory creation/editing/deletion.
- **Project-Scoped Memory Engine**: Deterministic storage for structured project memory (decisions, requirements, conventions, architecture notes).
- **Minimal Core API**:
  - `POST /api/memory`: Ingest user-confirmed memory record.
  - `GET /api/context`: Retrieve active project context formatted for prompt injection.
- **Syntactic Deduplication**: Deterministic exact-match content hashing (SHA-256) to prevent identical duplicate entries.
- **Deterministic Context Assembly**: Filter memories by active `project_id`, sort by recency/importance, and format into a clean Markdown block within a token budget.
- **Baseline IDE / File Adapter**: Support file-based context grounding (e.g., generating or updating local workspace context files).

### 8.2 Post-MVP Scope
- **Vector Storage & Semantic Retrieval**: Vector embeddings and cosine similarity search for relevant memory discovery.
- **Semantic Candidate Duplicate Detection**: Surfacing potential duplicates and related memories based on embedding distance.
- **Browser Extension (Web Adapter)**: Initial browser extension for ChatGPT / Claude web context injection and capture.
- **User Authentication & Workspaces**: Multi-user accounts, workspace management, and API access tokens.
- **Automated Memory Extraction**: NLP/LLM extraction of structured memory candidates from raw conversation transcripts.

### 8.3 Future / Experimental
- **Real-Time Synchronization Engine**: Push notifications and WebSocket/SSE broadcast across active clients.
- **Distributed Multi-Device State Coordination**: Sync event queueing across multiple physical developer machines.
- **Automatic Complex Conflict Resolution**: Multi-agent divergent state reconciliation.
- **Global Cross-Project Memory Mesh**: Sharing user-level coding habits across disconnected projects.
- **Remote Coding Agent / PC Control**: Autonomous agent bridge and remote desktop interaction.
