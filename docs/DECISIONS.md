# Architecture and Technical Decisions

This file tracks important technical decisions throughout the lifecycle of the AiMemorySync project.

---

### DECISION 001
- **Title**: Main Application Framework
- **Status**: APPROVED
- **Context**: The project requires a modern, full-stack web framework supporting server-rendered UI, API endpoints, and efficient compilation.
- **Decision**: Next.js (App Router with Turbopack) is the main application framework.
- **Reasoning**: Next.js provides a unified runtime for frontend interfaces and backend API routes, native TypeScript support, and high performance with Turbopack.
- **Consequences**: Architecture follows Next.js App Router conventions and file structure.

---

### DECISION 002
- **Title**: Programming Language
- **Status**: APPROVED
- **Context**: Codebase consistency, type safety, and maintainability across frontend, API, and adapters.
- **Decision**: TypeScript is the official programming language.
- **Reasoning**: TypeScript ensures strong compile-time guarantees, clear interfaces for core entities, and prevents runtime type errors.
- **Consequences**: All source code must be strictly typed without unnecessary `any` usages.

---

### DECISION 003
- **Title**: User Interface Framework
- **Status**: APPROVED
- **Context**: The web application requires a reactive component-based UI framework.
- **Decision**: React (React 19 with React Compiler enabled) is the UI framework.
- **Reasoning**: Standard Next.js foundation, rich component ecosystem, and automated memoization via React Compiler.
- **Consequences**: Components follow functional React patterns with strict hydration hygiene.

---

### DECISION 004
- **Title**: Styling System
- **Status**: APPROVED
- **Context**: Styling solution needed for consistent, responsive, and maintainable UI design.
- **Decision**: Tailwind CSS v4 is used for styling.
- **Reasoning**: Utility-first CSS provides rapid styling, zero CSS runtime overhead, and a unified design token system.
- **Consequences**: Avoid custom ad-hoc CSS or external heavy UI libraries in base setup.

---

### DECISION 005
- **Title**: Development Philosophy
- **Status**: APPROVED
- **Context**: Guiding principle for changes, refactoring, and code maintenance.
- **Decision**: The project follows a consistency-first and minimum-change development philosophy.
- **Reasoning**: Prevents architectural drift, unnecessary rewrites of working code, and premature optimization.
- **Consequences**: Every modification must inspect existing code first, reuse established patterns, and make only the smallest necessary scope of change.

---

### DECISION 006
- **Title**: Independent Shared Memory Layer
- **Status**: APPROVED
- **Context**: Determining how AiMemorySync interfaces with external AI platforms (ChatGPT, Antigravity, Claude, Gemini).
- **Decision**: AiMemorySync operates an independent, user-governed memory store and does not assume direct access to private internal memory of external AI platforms.
- **Reasoning**: External platforms do not expose internal model weights or private cross-vendor memory APIs. User sovereignty requires an independent, platform-agnostic persistence layer.
- **Consequences**: System relies on platform adapters and explicit, user-approved data exchange.

---

### DECISION 007
- **Title**: Adapter Pattern for Platform Integrations
- **Status**: APPROVED
- **Context**: Supporting multiple disparate AI platforms without coupling core memory engine logic to specific vendor APIs or DOM quirks.
- **Decision**: Implement an abstract `PlatformAdapter` standard interface that isolates platform-specific discovery, extraction, and prompt injection logic.
- **Reasoning**: DOM structures, token conventions, and capabilities differ drastically across platforms. Encapsulating these quirks in adapters shields core business logic from breaking changes.
- **Consequences**: Each external platform integration requires a dedicated adapter adhering to the standard lifecycle contract.

---

### DECISION 008
- **Title**: Explicit User Consent and Non-Silent Capture
- **Status**: APPROVED
- **Context**: Privacy, security, and developer trust during automated and semi-automated context capture.
- **Decision**: All conversational capture, memory ingestion, and context injection require affirmative user consent (explicit commands, interactive approval modals, or user-configured domain opt-in).
- **Reasoning**: Silent background scraping risks capturing proprietary secrets, credentials, or irrelevant conversational chatter. Trust requires explicit developer control.
- **Consequences**: Client connectors must incorporate visible active indicators and review checkpoints before transmitting data.

---

### DECISION 009
- **Title**: Strict Project and Tenant Boundary Partitioning
- **Status**: APPROVED
- **Context**: Multi-project and multi-workspace data organization and preventing context contamination.
- **Decision**: All memories, conversations, and retrieval queries must be scoped strictly by workspace and project IDs.
- **Reasoning**: Cross-project context leakage causes AI hallucinations, conflicting architectural guidance, and security risks.
- **Consequences**: Context queries must enforce project-scoping predicates; multi-project sharing is restricted to explicitly tagged Global Memory.

---

### DECISION 010
- **Title**: Two-Tier Deduplication and Relation Strategy
- **Status**: APPROVED
- **Context**: Preventing context window saturation, redundant memories, and contradictory guidance across sessions.
- **Decision**: Implement a two-tier deduplication and association strategy:
  1. Exact Match (Syntactic): Deterministic text/content hash match automatically flags duplicates (discards or increments observation frequency).
  2. Semantic Similarity: Vector cosine distance flags candidate memories as *related* or *potential duplicates*. Semantic similarity alone does NOT trigger an automatic merge.
  3. Safe Merging: Automatic merging is permitted only when strict, deterministic criteria are met (same project, identical subject/category, and monotonic non-contradictory extension). All conflicting or ambiguous semantic matches are preserved as distinct or flagged for user review.
- **Reasoning**: Semantic similarity does not equal equivalence. Merging solely on vector closeness risks corrupting distinct architectural nuances and destroying valid alternative solutions.
- **Consequences**: Avoids accidental data corruption; ensures high-fidelity memory records while keeping the ingestion pipeline safe.

---

### DECISION 011
- **Title**: Database and Vector Storage Selection
- **Status**: PROPOSED
- **Context**: Determining the production persistence backend and vector indexing solution for future implementation phases.
- **Decision**: Deferred to Phase 3. Potential approaches under consideration include PostgreSQL with `pgvector` for unified relational and vector storage, or SQLite with `sqlite-vec` for lightweight local development.
- **Reasoning**: Phase 2 is an architecture and blueprint phase; premature database dependency installation violates project phase boundaries.
- **Consequences**: No database dependencies are installed in Phase 2.

---

### DECISION 012
- **Title**: User Authentication Provider Selection
- **Status**: PROPOSED
- **Context**: Determining the user authentication and session management architecture.
- **Decision**: Deferred to a future phase. Candidate approaches include native session-based authentication or lightweight auth libraries evaluated alongside the database selection.
- **Reasoning**: Authentication dependencies must align with the persistence layer selected in future phases.
- **Consequences**: No authentication libraries are installed in Phase 2 or Phase 3A.

---

### DECISION 013
- **Title**: Primary Database Selection (PostgreSQL)
- **Status**: APPROVED
- **Context**: Selecting the primary relational database backend for the AiMemorySync shared memory layer.
- **Decision**: PostgreSQL will be the primary database for AiMemorySync.
- **Reasoning**: The product is expected to support a web application, future browser extension, multiple clients, synchronization, cloud deployment, relational integrity, and future semantic capabilities. SQLite is intentionally not selected because the product architecture is expected to evolve beyond a single local process.
- **Consequences**: Requires a PostgreSQL instance or cloud connection string during implementation phases; eliminates future database migration when vector search is introduced.

---

### DECISION 014
- **Title**: Database Access Layer (Prisma ORM)
- **Status**: APPROVED
- **Context**: Choosing a type-safe database access layer and migration manager for Next.js App Router.
- **Decision**: Prisma ORM will be used as the database access and schema layer. (Revised from Drizzle ORM prior to implementation).
- **Reasoning**: Prisma offers declarative schema modeling (`schema.prisma`), robust auto-generated migrations (`prisma migrate`), strong relations handling, built-in visual data inspection via Prisma Studio, and seamless integration with Next.js App Router. The decision was revised before implementation; no database implementation had started with Drizzle.
- **Consequences**: Schema definitions reside in `prisma/schema.prisma`; client types are generated via `prisma generate`; migrations are tracked via `prisma/migrations`.

---

### DECISION 015
- **Title**: MVP Core Data Model (`Project` & `Memory`)
- **Status**: APPROVED
- **Context**: Defining the minimum conceptual schema required to fulfill the MVP product boundary without premature overengineering.
- **Decision**: The MVP database model will initially contain only two core entities: `Project` and `Memory` (`Project 1 ──< * Memory`).
  1. `Project`: Root anchor for codebase context (id, name, slug, description, status, timestamps).
  2. `Memory`: Discrete engineering knowledge item (id, project_id, type, title, content, priority, content_hash, status, timestamps).
  3. Exact duplicate detection is enforced at ingestion time via a deterministic SHA-256 hash of normalized content, scoped strictly by project.
  4. Entities like `User`, `Workspace`, `MemoryVersion`, `MemorySource`, and `SyncEvent` are intentionally deferred to Post-MVP phases.
- **Reasoning**: Adheres to the minimum change and YAGNI principles; eliminates speculative tables while preserving complete structural readiness for non-breaking future migrations.
- **Consequences**: Simpler initial implementation, rapid delivery, zero dead tables in the MVP schema.

---

### DECISION 016
- **Title**: Automatic Project Discovery & Identity Resolution as Primary Workflow
- **Status**: APPROVED
- **Context**: Clarifying product workflow priority and multi-platform project identity architecture.
- **Decision**: Automatic Project Discovery & Identity Resolution is the primary production workflow for AiMemorySync. The web dashboard serves as an inspection, management, debugging, and administrative fallback interface. Project identity will be anchored to a 3-tier identity model (Primary: Canonical Git Remote Hash; Secondary: Package/Manifest; Fallback: Local Workspace Hash) with multi-platform source separation (`ProjectIdentity` and `ProjectSource` planned for Phase 5).
- **Reasoning**: Developers work across different IDEs, terminals, and AI platforms. Manual project creation in a web dashboard causes friction and fragmentation. Canonical Git remote normalization ensures that distinct clones on different machines or IDEs resolve deterministically to the same internal project without duplicate creation.
- **Consequences**: Architecture documentation formalized in `docs/AUTOMATIC_PROJECT_DISCOVERY.md`. Schema migration (`ProjectIdentity`, `ProjectSource`) and resolution endpoints (`POST /api/projects/resolve`) are scheduled for Phase 5 without breaking current Phase 4 Project/Memory contracts.

---

### DECISION 017
- **Title**: Cryptographic API Key Authentication & Route Guard Middleware
- **Status**: APPROVED
- **Context**: Securing REST API endpoints against unauthenticated data exfiltration, memory tampering, and abuse before external IDE client integrations connect.
- **Decision**: Enforce Bearer token API key authentication across all `/api/*` endpoints (with optional development-only anonymous bypass `ALLOW_DEV_ANONYMOUS_AUTH=true`).
  1. API keys use a scanner-detectable prefix (`aimem_live_...` / `aimem_test_...`) and 256 bits of cryptographic entropy.
  2. Only the SHA-256 hash (`keyHash`) is stored in the database (`api_keys` table); plaintext keys are displayed strictly once upon generation.
  3. Enforce scope authorization (`read`, `write`, `admin`) and in-memory sliding window rate limiting (60–120 req/min).
  4. IDE extensions store tokens securely via OS Keychain (`vscode.SecretStorage`).
- **Reasoning**: Prevents memory poisoning and unauthorized context extraction while avoiding permanent hardcoded secrets or complex premature RBAC.
- **Consequences**: Additive migration applied (`20260903103353_add_api_keys_and_auth`). All external clients must supply `Authorization: Bearer <api_key>` header.

---

### DECISION 021
- **Title**: Cursor IDE Dual-Tier Integration Architecture via Universal MCP and Modern Rules (.cursor/rules/*.mdc)
- **Status**: APPROVED
- **Context**: Enabling Cursor IDE to participate in the AiMemorySync shared memory ecosystem alongside Antigravity, VS Code, and Web.
- **Decision**: Adopt a dual-tier integration pattern for Cursor:
  1. **Tier 1 (Agentic MCP Engine)**: Connect Cursor Composer and Chat to the existing universal MCP server (`@aimemory/mcp-server`) over stdio via `.cursor/mcp.json`. Cursor's AI Agent gains autonomous access to all 8 memory tools and the dynamic context resource (`aimemory://projects/{id}/context`).
  2. **Tier 2 (Visual IDE Extension)**: Allow installation of `aimemory-vscode` in Cursor for visual sidebar and status bar monitoring.
  3. **Behavioral Governance**: Author `.cursor/rules/aimemory.mdc` with frontmatter (`alwaysApply: true`, `globs: ["**/*"]`) instructing the Cursor agent on selective context loading and explicit memory capture protocols.
- **Reasoning**: Maximizes code reuse, avoids duplicate server infrastructure, leverages standard Model Context Protocol, and preserves cross-platform memory consistency without modifying core database models or backend APIs.
- **Consequences**: Documented in `docs/PHASE_6A_CURSOR_INTEGRATION_ARCHITECTURE.md`. Unlocks Phase 6B onboarding wizard and Phase 6C rules distribution.

---

### DECISION 022
- **Title**: Tenant-First SaaS Architecture & Separation of Human Web Sessions from Machine API Keys
- **Status**: APPROVED
- **Context**: The web application login at `/login` currently prompts humans for raw `aimem_live_*` API secret tokens and stores them in browser `localStorage`. API keys are machine credentials for IDEs and agents (Cursor, Antigravity, VS Code, MCP, CLI) and lack human lifecycle capabilities, user identification, and tenant scoping. Furthermore, the database lacks multi-tenancy, permitting any valid API key to access all projects and memories across the system.
- **Decision**: Transform AiMemorySync into a tenant-first SaaS platform:
  1. **Strict Separation of Concerns**: Human authentication uses Email + Password (with standard secure sessions via `HttpOnly`, `SameSite=Lax` cookies). Machine authentication uses scoped Bearer API keys (`aimem_live_*`).
  2. **Hierarchical Multi-Tenancy**: Introduce `Tenant`, `User`, `TenantMember` (with roles: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`), and `Session` models. All projects, memories, and API keys are strictly partitioned under a parent `tenantId`.
  3. **Scoped Machine Keys**: API keys belong to a `tenantId` and can optionally be restricted to a specific `projectId` and least-privilege permission scopes.
  4. **Dual-Mode Auth Guard**: Update `requireAuth` to accept either an active human web session cookie or a valid machine Bearer key, resolving a unified `AuthContext` with enforced tenant and project boundary checks on all queries.
- **Reasoning**: Solves the bootstrapping paradox for web users, prevents cross-tenant data leakage (IDOR), eliminates XSS token exposure from `localStorage`, and provides enterprise-grade isolation for AI agent memory access.
- **Consequences**: Documented in `docs/AUTHENTICATION_TENANT_ARCHITECTURE.md`. Precedes Phase 6B implementation.


