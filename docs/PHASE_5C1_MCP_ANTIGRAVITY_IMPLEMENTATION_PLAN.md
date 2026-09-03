# Phase 5C.1: Universal MCP Server & Antigravity Plugin Integration — Architecture Audit & Implementation Plan

**Author**: Antigravity AI  
**Date**: 2026-09-03  
**Status**: APPROVED WITH CORRECTIONS  
**Target Milestone**: Phase 5C.1 — Universal Model Context Protocol (MCP) Server & Antigravity Plugin Integration  

---

## 1. Executive Summary & Strategic Objective

AiMemorySync is evolving into an **ecosystem-agnostic persistent memory layer** for all AI coding environments.

The objective of Phase 5C.1 is to:
1. Build a standalone, platform-independent **AiMemorySync MCP Server** (`packages/mcp-server`) powered by `@modelcontextprotocol/sdk` and `@aimemory/client-core`.
2. Connect **Antigravity** as the first consumer via an official, lightweight plugin structure (`.agents/plugins/aimemory/`).
3. Ensure the exact same MCP server can be reused seamlessly by **ChatGPT, Claude Desktop, Cursor, VS Code AI agents, Gemini CLI**, and future MCP clients without backend or protocol modifications.

---

## 2. Architecture Audit & Verified Platform Standards

### A. Client-Core SDK (`packages/client-core`)
`packages/client-core` provides all necessary domain abstractions with zero duplicate logic:
- `AiMemoryClient`: Unified client with retry logic, timeout enforcement, request tracing, and event dispatching.
- `ProjectsModule`: `resolve`, `list`, `get`, `create`, `update`, `archive`.
- `MemoriesModule`: `list`, `get`, `create`, `update`, `deprecate`, `archive`.
- `ContextModule`: `get` (character budgeting, greedy knapsack selection, clean markdown rendering).
- Error Hierarchy: `AuthenticationError` (401), `AuthorizationError` (403), `NotFoundError` (404), `ConflictError` (409), `ValidationError` (400), `RateLimitError` (429), `NetworkError`, `TimeoutError`, `ServerError` (500).

### B. Dependency & Compatibility Verification
- **Model Context Protocol SDK**: `@modelcontextprotocol/sdk@^1.30.0`.
- **`zod` Compatibility**: Verified via `npm view @modelcontextprotocol/sdk peerDependencies`:
  ```json
  { "zod": "^3.25 || ^4.0" }
  ```
  The workspace's `zod@^4.5.4` is natively compatible with `@modelcontextprotocol/sdk`.
- **Stdio Transport**: `@modelcontextprotocol/sdk/server/stdio.js` (`StdioServerTransport`).
  - **CRITICAL STDIO RULE**: Standard output (`process.stdout`) is strictly reserved for JSON-RPC messages. All internal diagnostic logs, warnings, and errors **must** be written exclusively to standard error (`process.stderr`).

### C. Antigravity Customization Architecture
- Customization root: `.agents/`
- Plugin structure: `.agents/plugins/aimemory/`
- **Lightweight Architecture**: No unnecessary `package.json` inside the plugin. Contains only:
  - `mcp_config.json` (MCP server definition)
  - `skills/aimemory-context/SKILL.md` (Context retrieval workflow)
  - `skills/aimemory-capture/SKILL.md` (Memory capture workflow)
  - `rules/aimemory-guardrails.md` (Security, anti-poisoning, and usage guardrails)

---

## 3. Target Universal Architecture

```text
                               AiMemorySync Cloud / Local API
                                     (http://localhost:3000)
                                               │
                                               │ HTTPS
                                               ▼
                                     @aimemory/client-core
                                               │
                                               ▼
                                      @aimemory/mcp-server
                                       (Node.js process)
                                               │
                                  Stdio Transport (JSON-RPC)
                                               │
                      ┌────────────────────────┼────────────────────────┐
                      │                        │                        │
                      ▼                        ▼                        ▼
                 Antigravity            ChatGPT / Claude             Cursor /
              (.agents/plugins)          Desktop Client            Future Clients
```

### Architectural Guarantees:
1. **Zero Database Access**: MCP server connects exclusively through `@aimemory/client-core` via HTTP.
2. **Zero Duplicate Logic**: Caching, retries, token budgeting, and deduplication remain centralized in `@aimemory/client-core` and the backend.
3. **Strict Privacy**: Raw absolute local machine paths (`D:\Freelance\...`) are completely redacted by discovery tools prior to signal transmission.
4. **Memory Poisoning Defense**: Clear separation of `READ` (safe/automatic) vs `WRITE` (deliberate, audited tool action with guardrails).
5. **Session-Level Project Awareness**: Server maintains `currentProject` in memory so AI clients do not have to repeatedly pass or track project UUIDs.

---

## 4. Phase 5C.1A — Universal MCP Server Design (`packages/mcp-server`)

### Directory Layout
```text
packages/mcp-server/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
├── src/
│   ├── index.ts                      # Entrypoint: loads config, starts StdioServerTransport
│   ├── server.ts                     # McpServer instance & tool/resource registrations
│   ├── config.ts                     # Resolves AIMEMORY_API_KEY, AIMEMORY_API_URL
│   ├── session.ts                    # Session state: cached currentProject & workspace signals
│   ├── tools/
│   │   ├── resolve-project.ts        # Tool: aimemory_resolve_project
│   │   ├── get-current-project.ts    # Tool: aimemory_get_current_project (NEW)
│   │   ├── get-context.ts            # Tool: aimemory_get_context (projectId optional, uses current)
│   │   ├── list-memories.ts          # Tool: aimemory_list_memories
│   │   ├── create-memory.ts          # Tool: aimemory_create_memory
│   │   ├── update-memory.ts          # Tool: aimemory_update_memory
│   │   ├── deprecate-memory.ts       # Tool: aimemory_deprecate_memory
│   │   └── archive-memory.ts         # Tool: aimemory_archive_memory
│   ├── resources/
│   │   └── project-context.ts        # Resource: aimemory://projects/{id}/context
│   ├── security/
│   │   └── logger.ts                 # Stderr-only logger with pattern-based regex redaction
│   └── types/
│       └── mcp.ts                    # Shared MCP types and tool response shapes
└── test/
    ├── tools.test.ts                 # Unit tests with mocked client-core
    ├── auth.test.ts                  # Credential handling & regex pattern sanitization tests
    └── integration.test.ts           # Live E2E tests against http://localhost:3000
```

### MCP Tools Specification (8 Tools)

| Tool Name | Action Type | Input Parameters | Output Payload | Safety Guardrails |
| :--- | :--- | :--- | :--- | :--- |
| **`aimemory_resolve_project`** | Read / Identity | `workspaceName?: string`, `gitRemoteUrl?: string`, `monorepoSubPath?: string`, `packageManifest?: { name: string, ecosystem: string }` | `{ projectId, projectName, canonicalIdentity, matchedBy, confidence, isNewlyCreated }` | Strips all absolute paths (`D:`, `/Users/...`). Automatically caches resolved project in session state. |
| **`aimemory_get_current_project`** | Read / State | *(None)* | `{ status: "RESOLVED" \| "NOT_RESOLVED", project?: ProjectDto }` | Enables AI to inspect current project context without tracking UUIDs. |
| **`aimemory_get_context`** | Read / Context | `projectId?: string` (defaults to current project), `budget?: number` (default: 8000), `types?: MemoryType[]` | Markdown text formatted with category sections and budget statistics | Conservative default budget; zero internal UUIDs or hashes exposed. |
| **`aimemory_list_memories`** | Read / Query | `projectId?: string` (defaults to current project), `status?: "ACTIVE" \| "DEPRECATED" \| "ARCHIVED"`, `type?: MemoryType`, `priority?: MemoryPriority` | Filtered list of memory items | Scoped strictly to resolved or specified project. |
| **`aimemory_create_memory`** | **Write / Mutation** | `projectId?: string` (defaults to current project), `type: MemoryType`, `title: string`, `content: string`, `priority?: MemoryPriority` | Created memory item | Description explicitly forbids saving secrets, API keys, transient errors, or conversational filler. |
| **`aimemory_update_memory`** | **Write / Mutation** | `memoryId: string`, `title?: string`, `content?: string`, `priority?: MemoryPriority`, `type?: MemoryType` | Updated memory item | Prevents accidental overwrites; invalidates context cache. |
| **`aimemory_deprecate_memory`** | **Write / Mutation** | `memoryId: string` | Deprecated memory item (`status: "DEPRECATED"`) | Soft-state transition; retains history for auditability. |
| **`aimemory_archive_memory`** | **Write / Mutation** | `memoryId: string` | Archived memory item (`status: "ARCHIVED"`) | Excludes record from active context queries. |

### Targeted Pattern-Based Logger Redaction
Instead of overly aggressive substring matching on the word `key`, `logger.ts` uses targeted regex patterns:
- API Keys: `/(aimem_[a-zA-Z0-9_-]{20,})/g` -> `[REDACTED_API_KEY]`
- Bearer Tokens: `/(Bearer\s+)[a-zA-Z0-9_.-]+/gi` -> `$1[REDACTED_TOKEN]`
- Auth Headers & Fields: `/"(?:apiKey|token|password|secret|authorization)"\s*:\s*"[^"]+"/gi` -> `"$1": "[REDACTED]"`
- Legitimate diagnostic terms like `"project key resolution"`, `"memory key identifier"`, or `"package manifest key"` remain completely intact.

---

## 5. Phase 5C.1B — Antigravity Plugin Design (`.agents/plugins/aimemory`)

### Layout
```text
.agents/
└── plugins/
    └── aimemory/
        ├── mcp_config.json                   # Official Antigravity MCP config
        ├── rules/
        │   └── aimemory-guardrails.md        # Antigravity rule for AI memory usage & safety
        └── skills/
            ├── aimemory-context/
            │   └── SKILL.md                  # Workflow for retrieving project context
            └── aimemory-capture/
                └── SKILL.md                  # Workflow for persisting verified architectural decisions
```

### Context Retrieval Lifecycle (No Per-Edit Token Waste)
Context is NOT loaded before every code edit. The lifecycle is strictly event-driven:
```text
Antigravity session starts
        ↓
1. Resolve workspace once (or verify current project)
        ↓
2. Cache project ID in MCP session
        ↓
3. Retrieve context only when:
   - A new substantial task begins
   - User explicitly asks about project architecture/conventions
   - Architecture or cross-module codebase reasoning begins
   - Context cache expires (15 min TTL)
```

### Skills & Rules
1. **`aimemory-context/SKILL.md`**:
   - Instructs the AI agent to call `aimemory_get_current_project` or `aimemory_resolve_project` once at the start of a feature/task, then fetch `aimemory_get_context` to guide reasoning.
2. **`aimemory-capture/SKILL.md`**:
   - Instructs the AI agent to explicitly save verified architecture decisions, project conventions, and bug solutions using `aimemory_create_memory`.
   - Explicitly forbids saving credentials, session chatter, or transient build errors.
3. **`rules/aimemory-guardrails.md`**:
   - Enforces read vs write separation, privacy (no local machine paths), priority selection (`CRITICAL` vs `HIGH` vs `NORMAL`), and prompt injection defense.

---

## 6. Revised Definition of Done

* [x] MCP protocol compatibility verified against actual SDK (`@modelcontextprotocol/sdk@^1.30.0` with `zod@^4.5.4`).
* [ ] No stdout logging except MCP JSON-RPC messages; all diagnostics go to stderr.
* [ ] Pattern-based regex redaction in logger (no false-positive stripping of `key`).
* [ ] Server starts successfully as a standalone stdio MCP process (`node packages/mcp-server/dist/index.js`).
* [ ] All 8 tools appear, register, and validate schemas correctly.
* [ ] `aimemory_get_current_project` maintains session-level project state.
* [ ] Tool errors map domain errors to clean MCP responses without leaking secrets.
* [ ] API key never appears in stdout or stderr.
* [ ] Antigravity plugin structure deployed cleanly under `.agents/plugins/aimemory/` without redundant `package.json`.
* [ ] Context retrieval follows the selective lifecycle (no wasteful per-edit calls).
* [ ] Real multi-session continuity test passes:
  - **Session 1**: AI saves architectural decision via `aimemory_create_memory`.
  - **Session 2**: Brand new conversation retrieves the memory and demonstrates awareness of the decision.
* [ ] Project resolution redacts raw local drive paths (`D:\Freelance\...`).
* [ ] Existing VS Code extension and monorepo packages pass all regression tests.
* [ ] Test data and ephemeral credentials are clean.
* [ ] Documentation updated in `docs/PHASE_5C1_MCP_ANTIGRAVITY_IMPLEMENTATION_REPORT.md` and `.antigravity/`.
