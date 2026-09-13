# Phase 6B.4 — Integration Architecture Audit & Unified Agent Context

## 1. Existing Integration Architecture

The AiMemorySync repository features a modular, contract-driven architecture designed to support multiple AI platforms without duplicating storage or domain business logic.

```text
Platform Layer (MCP, Antigravity, VS Code, Cursor, CLI, Web)
    ↓  [Authenticated REST over HTTP / JSON-RPC over Stdio]
@aimemory/client-core (Universal SDK Transport, Resilient HTTP, In-Memory Cache)
    ↓  [Bearer API Key / Session Cookie + Platform Headers]
Next.js App Router API Routes (src/app/api/)
    ↓  [Dual-Mode Guard: requireAuth() -> AuthPrincipal]
Unified Agent Context (AgentContext: tenantId, projectId, integrationType, requestId)
    ↓  [Server-Authoritative Tenant & Project Isolation]
Domain Services (project.service, memory.service, context.service, identity.service, auth.service)
    ↓  [Prisma ORM with Parameterized Queries]
Supabase PostgreSQL (Multi-tenant schema: tenants, users, tenant_members, projects, memories, api_keys)
```

### Static Provider Registry (`src/lib/integrations/registry.ts`)
The integration registry manages developer onboarding metadata, setup wizard routes, configuration snippets, and feature descriptions for supported platforms:
- **`antigravity`**: Native MCP Plugin with event-driven context loading (`/integrations/antigravity/setup`).
- **`vscode`**: VS Code Extension with OS keychain integration (`/integrations/vscode/setup`).
- **`cursor`**: Cursor IDE integration using MCP server stdio bridge (`/integrations/cursor/setup`).
- **`claude`**: Claude Desktop integration using MCP (`/integrations/claude/setup`).
- **`chatgpt`**: ChatGPT custom action integration (`/integrations/chatgpt/setup`).

**Architectural Principle**: The provider registry is purely informational and presentation-driven. It is kept strictly decoupled from database-backed tenant authorization.

---

## 2. Existing Authentication Flow

Authentication is unified in [`src/lib/api/auth-guard.ts`](file:///d:/Freelance/AiMemorySync/src/lib/api/auth-guard.ts) via `requireAuth(request, options)`:

```text
Incoming Request
    │
    ├─► Header: "Authorization: Bearer aimem_live_..." or "x-api-key: ..."
    │     │
    │     ▼
    │   validateApiKey() -> Hash token with SHA-256
    │   Query database "api_keys" table by key_hash
    │   Verify: not revoked, not expired, scopes valid
    │   Rate limit check (by apiKeyId)
    │   Resolve AuthPrincipal (authType: "machine", tenantId, projectId, scopes)
    │
    └─► Cookie: "aimem_session=..."
          │
          ▼
        verifyCsrfOrigin() (Origin/Referer verification against Host)
        validateSession() -> Hash token with SHA-256
        Query database "sessions" table by sessionTokenHash
        Verify: not expired, membership in active tenant
        Rate limit check (by userId)
        Resolve AuthPrincipal (authType: "human", tenantId, tenantRole, scopes)
```

---

## 3. Existing Tenant & Project Context Propagation

Tenant and project boundaries are enforced strictly on the server:
1. **Authoritative Server Derivation**: `tenantId` is never read from untrusted client payloads (JSON body or URL query parameters). It originates solely from the verified API key record or human session record.
2. **Project Scoping**: If an API key has `projectId !== null`, the key is restricted exclusively to that project:
   - Any query specifying a different project ID fails with `403 Forbidden` via `enforceProjectScope()`.
   - Project creation and cross-project listing are strictly prohibited.
3. **Domain Service Enforcement**:
   - `project.service.ts`: Filters all reads and writes by `where: { id, tenantId }`.
   - `memory.service.ts`: Queries memories and joins parent project to verify `memory.project.tenantId === principal.tenantId`. If a user attempts to access another tenant's memory ID, the system returns `404 Not Found` (IDOR defense) rather than leaking resource existence.

---

## 4. MCP Flow

The Model Context Protocol server operates as an external process communicating with client agents over `stdio` and with the AiMemorySync backend via HTTP REST:

```text
AI Agent (Antigravity / Cursor / Claude Desktop)
    │  stdio (JSON-RPC)
    ▼
@aimemory/mcp-server (packages/mcp-server/src/server.ts)
    │  Calls typed SDK methods
    ▼
@aimemory/client-core (packages/client-core/src/client.ts)
    │  HTTP POST/GET with Bearer Key & "x-aimemory-platform: MCP"
    ▼
AiMemorySync App Router (/api/projects, /api/memories, /api/projects/[id]/context)
    │  requireAuth() -> AuthPrincipal
    ▼
Domain Services (memory.service, context.service)
    │  Tenant & Project Scoped Queries
    ▼
PostgreSQL Database
```

**Key Characteristics**:
- Zero database access in MCP server; communicates purely over HTTP REST.
- Caches active project in session memory (`McpSessionManager`) after initial resolution.
- Dynamic Resource `aimemory://projects/{id}/context` reuses the exact same backend context engine.

---

## 5. Antigravity Flow

Antigravity integrates through the official plugin structure at [`.agents/plugins/aimemory/`](file:///d:/Freelance/AiMemorySync/.agents/plugins/aimemory):
1. **Configuration**: `.agents/plugins/aimemory/mcp_config.json` launches `packages/mcp-server/dist/index.js` with `AIMEMORY_API_URL` and `AIMEMORY_API_KEY`.
2. **Safety & Guardrails**: `.agents/plugins/aimemory/rules/aimemory-guardrails.md` instructs the Antigravity agent on:
   - Strict anti-poisoning (zero credentials/secrets in memory).
   - Local path privacy (relative paths only, never raw drive letters).
   - Event-driven, budget-conscious context loading.
3. **Workflow Skills**:
   - `aimemory-context`: Prompts agent to fetch project context when starting complex tasks.
   - `aimemory-capture`: Prompts agent to record verified architectural decisions.

---

## 6. VS Code Flow

The VS Code extension at [`packages/vscode-extension/`](file:///d:/Freelance/AiMemorySync/packages/vscode-extension) provides a graphical sidebar and automated workspace synchronization:
1. **Secure Storage**: Reads `aimemory_api_key` from VS Code's OS-backed `ExtensionContext.secrets` (Keychain / DPAPI).
2. **SDK Facade**: Instantiates `AiMemoryClient` with `platform: "vscode"` and `x-aimemory-client-id`.
3. **Workspace Lifecycle**: Automatically extracts workspace signals (`gitRemoteUrl`, package manifests) and invokes `client.projects.resolve()` on folder open.
4. **Interactive Views**: Populates Tree Views (`ProjectsTreeDataProvider`, `MemoriesTreeDataProvider`, `ContextTreeDataProvider`) and Status Bar.

---

## 7. Unified Context Decision

### Analysis
The repository already possesses `AuthPrincipal` in [`src/lib/api/auth-guard.ts`](file:///d:/Freelance/AiMemorySync/src/lib/api/auth-guard.ts). Creating a separate, redundant auth system would violate the Minimum Change Principle. 

However, to cleanly represent the operational context across various AI integrations (tracking platform metadata and request tracing without polluting core credential verification), we establish a lightweight, server-derived `AgentContext`:

```typescript
export interface AgentContext {
  tenantId: string;
  projectId?: string;
  integrationId?: string;
  integrationType: string;
  userId?: string;
  permissions: string[];
  requestId: string;
  principal: AuthPrincipal;
}
```

### Derivation Pipeline
```text
HTTP Request
    ↓
requireAuth(request) ──► AuthPrincipal (Cryptographic identity & permissions)
    ↓
createAgentContext(principal, request) ──► AgentContext (Operational context with transport metadata)
    ↓
Domain Services / Auditing
```

This design:
- Preserves 100% backward compatibility for existing callers of `AuthPrincipal`.
- Automatically maps `x-aimemory-platform` (e.g. `MCP`, `VSCODE`, `CURSOR`) to `integrationType`.
- Automatically tracks `x-aimemory-client-id` or key ID as `integrationId`.
- Propagates or generates `x-request-id` for distributed request correlation.

---

## 8. Changes Made

1. **`src/lib/api/auth-guard.ts`**:
   - Added `AgentContext` interface.
   - Added `createAgentContext(principal, request)` factory function.
2. **`src/app/api/integrations/test/route.ts`**:
   - Updated diagnostic response `details` to return `tenantId` and `projectId` upon successful key validation.
3. **`docs/PHASE_6B4_INTEGRATION_CONTEXT_AUDIT.md`**:
   - Authored this architectural audit document.
4. **`scratch/test-integration-context.mjs`**:
   - Created test suite verifying integration authentication, `AgentContext` derivation, tenant isolation, and project scoping.

---

## 9. Security Invariants

1. **Server-Authoritative Tenant Boundary**: `tenantId` always originates from the server-validated API key or session cookie. Client-supplied `tenantId` in payloads is strictly ignored for authorization.
2. **IDOR Defense**: Querying memories or projects belonging to another tenant returns `404 Not Found`, preventing attackers from verifying resource existence.
3. **Project-Scoped Key Containment**: API keys restricted to a specific `projectId` cannot access or mutate resources in other projects (`403 Forbidden`).
4. **Secret Sanitization**: Plaintext API keys and passwords are never persisted in the database; only SHA-256 or Argon2id hashes are stored. Raw keys and tokens are never logged.

---

## 10. Compatibility Verification

| Consumer | Transport | Auth Credential | Compatibility Status |
| :--- | :--- | :--- | :--- |
| **Antigravity IDE** | stdio -> HTTP | Bearer API Key | **Verified & Compatible** |
| **MCP Server** | stdio -> HTTP | Bearer API Key | **Verified & Compatible** |
| **VS Code Extension** | OS Keychain -> HTTP | Bearer API Key | **Verified & Compatible** |
| **Cursor IDE** | stdio -> HTTP | Bearer API Key | **Verified & Compatible** |
| **Web Dashboard** | Browser Fetch | HttpOnly Cookie + CSRF | **Verified & Compatible** |

---

## 11. Remaining Gaps & Future Roadmap

1. **Integration Token Scoping UI**: The Web Dashboard currently generates workspace-wide or project-scoped API keys; future phases will add granular UI toggles for custom integration metadata.
2. **Platform Source Sync**: `ProjectSource` records last-seen platforms (e.g., `MCP`, `VSCODE`); this telemetry can be displayed on the Project detail page in future UI updates.
