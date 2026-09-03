# Phase 5B.0 Implementation Plan: API Authentication & Client Security Foundation

## 1. Executive Summary & Security Objectives

### 1.1 Problem Statement
In Phases 1–5A, AiMemorySync developed core database models, domain services, Context Assembly, and the Automatic Project Discovery & Identity Resolution Engine (`POST /api/projects/resolve`).

However, all `/api/*` endpoints currently lack authentication and authorization enforcement. As external client extensions (VS Code, Cursor, Antigravity, browser extensions, terminal agents) begin connecting over HTTP/HTTPS, leaving endpoints unauthenticated exposes the system to:
1. **Context & Memory Data Exfiltration**: Unauthorized retrieval of proprietary architecture decisions, coding rules, and project context.
2. **Memory Poisoning & Hallucination Injection**: Malicious or unauthorized creation/editing of project memories, misleading developer AI agents.
3. **Project Enumeration & Denial of Service**: Unbounded database querying, slug collision attacks, and project deletion.

### 1.2 Phase 5B.0 Goal
Establish a **hardened, production-grade authentication and client security foundation** across all existing and future API routes before any IDE extension or external client connects.

---

## 2. Comprehensive Threat Model & Security Audit

### 2.1 Threat Vectors & Mitigations Matrix

| Threat Vector | Target Endpoints | Risk Level | Mitigation Strategy |
| :--- | :--- | :---: | :--- |
| **Unauthenticated Data Exfiltration** | `GET /api/projects`, `GET /api/projects/:id/context`, `GET /api/projects/:id/memories` | **CRITICAL** | Enforce cryptographic API Key / Bearer Token on all data retrieval routes. |
| **Memory Poisoning & Context Tampering** | `POST /api/projects/:id/memories`, `PATCH /api/memories/:id`, `POST /api/memories/:id/deprecate` | **CRITICAL** | Require write-permission authentication; validate payload schemas with strict Zod bounds; log author metadata. |
| **Unauthorized Project Deletion / Archival** | `DELETE /api/projects/:id`, `DELETE /api/memories/:id` | **HIGH** | Require authenticated admin/owner credentials; soft-delete with audit timestamps. |
| **Project & Workspace Enumeration** | `GET /api/projects/:id`, `POST /api/projects/resolve` | **HIGH** | Rate-limit requests per token/IP; generic 404 responses for non-existent IDs without leaking schema existence. |
| **Credential & Token Leakage in Git** | Extension source code, local `.env` files | **HIGH** | Zero hardcoded keys; prompt user for API token; store via OS Keychain (`vscode.SecretStorage`); automated secret scanner prefixes (`aimem_live_`). |
| **Denial of Service / Unbounded Ingestion** | All `POST`/`PATCH` endpoints | **MEDIUM** | In-memory token-bucket rate limiting; payload size caps (64KB JSON body limit); strict timeout enforcement. |

---

## 3. Authentication Architecture & Credential Model

### 3.1 Token Format & Cryptographic Standard
AiMemorySync API keys follow high-entropy, scanner-friendly standards:

```text
Format:
aimem_<environment>_<32_random_bytes_base64url>

Examples:
aimem_live_9f8a2b4c1d6e8f0a2b4c1d6e8f0a2b4c   (Production API Key)
aimem_test_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d   (Automated Testing Key)
```

- **Prefix (`aimem_live_` / `aimem_test_`)**: Detectable by secret scanners (GitHub Secret Scanning, Trufflehog, GitGuardian) to prevent accidental git commits.
- **Entropy**: 256 bits of cryptographically secure random entropy (`crypto.randomBytes(32)`).
- **Storage at Rest**: The server **NEVER** stores plaintext API keys. Keys are hashed using **SHA-256** before database insertion:
  ```text
  Key Ingestion:
  Token string: aimem_live_abc...1234
          │
          ▼
  Compute SHA-256(token) ──> keyHash (64-char hex)
          │
          ▼
  Store in DB: { keyHash, prefix: "aimem_live_", last4: "1234", name: "MacBook VS Code" }
  ```
- **One-Time Display**: Plaintext keys are returned to the user **exactly once** upon generation.

---

### 3.2 Database Schema (`ApiKey` Model)

Add the `ApiKey` model additively to [`prisma/schema.prisma`](file:///d:/Freelance/AiMemorySync/prisma/schema.prisma):

```prisma
model ApiKey {
  id          String    @id @default(uuid()) @db.Uuid
  name        String    @db.VarChar(100)
  keyHash     String    @unique @map("key_hash") @db.VarChar(64)
  prefix      String    @db.VarChar(16)
  last4       String    @db.VarChar(4)
  scopes      String[]  @default(["read", "write"])
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  lastUsedAt  DateTime? @map("last_used_at") @db.Timestamptz
  expiresAt   DateTime? @map("expires_at") @db.Timestamptz
  revokedAt   DateTime? @map("revoked_at") @db.Timestamptz

  @@index([keyHash])
  @@map("api_keys")
}
```

---

### 3.3 Credential Lifecycle Management

```text
┌──────────────┐     Create Token     ┌──────────────┐
│  Developer/  │ ───────────────────> │  Dashboard/  │ ──> Generates Token & Hashes
│    Admin     │                      │   CLI Tool   │ ──> Stores SHA-256 in DB
└──────────────┘                      └──────┬───────┘
                                             │
                                             ▼ Displays token once to user
                                      ┌──────────────┐
                                      │ Copy Token   │
                                      └──────┬───────┘
                                             │
                                             ▼ Store in OS Keychain
                                      ┌──────────────┐
                                      │  VS Code /   │
                                      │  IDE Secret  │
                                      └──────┬───────┘
                                             │
                      Every Request          ▼ (Authorization: Bearer aimem_live_...)
                 ┌──────────────────────────────────────┐
                 │          Next.js Route Guard         │
                 │  - Computes SHA-256(receivedToken)   │
                 │  - Matches keyHash in api_keys DB    │
                 │  - Verifies: revokedAt == null       │
                 │  - Verifies: expiresAt > now()       │
                 │  - Updates lastUsedAt async          │
                 └──────────────────┬───────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
        [Valid Token]                             [Invalid/Revoked]
               │                                         │
        200 OK Execution                          401 Unauthorized
```

1. **Creation**: Dashboard / CLI generates key with custom label (e.g. `"Work VS Code"`), optional expiration TTL (e.g. 30 days, 90 days, or Never).
2. **Storage**: User inputs token into VS Code extension setting; extension writes to `vscode.SecretStorage`.
3. **Usage**: Extension sends `Authorization: Bearer <token>` with every HTTP request.
4. **Validation**: Server computes `SHA-256` of incoming token and verifies existence, active status, expiration date, and required scope.
5. **Rotation**: User creates new token, updates IDE settings, and revokes old token.
6. **Instant Revocation**: Setting `revokedAt = NOW()` immediately invalidates all active sessions using that key.

---

## 4. Route Protection Matrix & Authorization Boundaries

### 4.1 Route Protection Matrix

| Route | HTTP Method | Auth Required | Required Scope | Description |
| :--- | :---: | :---: | :---: | :--- |
| `/api/projects/resolve` | `POST` | **YES** | `write` | Automatic project discovery & identity resolution |
| `/api/projects` | `GET` | **YES** | `read` | List active projects |
| `/api/projects` | `POST` | **YES** | `write` | Manual project creation |
| `/api/projects/:id` | `GET` | **YES** | `read` | Get project details |
| `/api/projects/:id` | `PATCH` | **YES** | `write` | Update project metadata |
| `/api/projects/:id` | `DELETE` | **YES** | `admin` | Soft-archive project |
| `/api/projects/:id/memories` | `GET` | **YES** | `read` | List project memories |
| `/api/projects/:id/memories` | `POST` | **YES** | `write` | Create project memory |
| `/api/memories/:id` | `PATCH` | **YES** | `write` | Update memory content |
| `/api/memories/:id/deprecate` | `POST` | **YES** | `write` | Deprecate memory |
| `/api/memories/:id` | `DELETE` | **YES** | `admin` | Soft-archive memory |
| `/api/projects/:id/context` | `GET` | **YES** | `read` | Assemble optimized context |
| `/api/health` (Future) | `GET` | **NO** | `none` | System liveness probe |

---

## 5. Middleware & Route Guard Implementation Architecture

### 5.1 Route Guard Helper (`src/lib/api/auth-guard.ts`)
To maintain high performance and avoid Edge runtime limitations on Node/Prisma native drivers, we use a centralized route guard pattern:

```typescript
export interface AuthPrincipal {
  keyId: string;
  name: string;
  scopes: string[];
}

export async function requireAuth(
  request: NextRequest,
  requiredScope: "read" | "write" | "admin" = "read"
): Promise<AuthPrincipal> {
  // 1. Extract Bearer token from Authorization header or x-api-key header
  const authHeader = request.headers.get("authorization") || request.headers.get("x-api-key");
  if (!authHeader) {
    // Local dev anonymous bypass ONLY if explicitly enabled via environment variable
    if (process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_ANONYMOUS_AUTH === "true") {
      return { keyId: "dev-local-key", name: "Development Local Principal", scopes: ["read", "write", "admin"] };
    }
    throw new UnauthorizedError("Authentication token is missing. Provide 'Authorization: Bearer <api_key>'");
  }

  // 2. Normalize and hash token
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : authHeader.trim();
  const keyHash = crypto.createHash("sha256").update(token).digest("hex");

  // 3. Query active API key
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });

  if (!apiKey || apiKey.revokedAt !== null) {
    throw new UnauthorizedError("Invalid or revoked API key");
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new UnauthorizedError("API key has expired");
  }

  // 4. Scope authorization check
  if (!apiKey.scopes.includes(requiredScope) && !apiKey.scopes.includes("admin")) {
    throw new ForbiddenError(`API key lacks required '${requiredScope}' permission`);
  }

  // 5. Asynchronous lastUsedAt touch (fire-and-forget)
  void prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return { keyId: apiKey.id, name: apiKey.name, scopes: apiKey.scopes };
}
```

---

## 6. Rate Limiting & Abuse Prevention Strategy

### 6.1 In-Memory Sliding Window Rate Limiter (`src/lib/api/rate-limiter.ts`)
- **Bucket Policy**:
  - **Resolution (`/api/projects/resolve`)**: 60 requests / minute per API key.
  - **Context Reads (`/api/projects/:id/context`)**: 120 requests / minute per API key.
  - **Mutations (`POST/PATCH/DELETE`)**: 60 requests / minute per API key.
- **Headers Returned**:
  - `X-RateLimit-Limit`: Maximum allowed requests in window
  - `X-RateLimit-Remaining`: Remaining request quota
  - `X-RateLimit-Reset`: UTC epoch timestamp when quota resets
- **Excess Traffic Response**: HTTP `429 Too Many Requests` with structured JSON error payload:
  ```json
  {
    "error": {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "Too many requests. Please retry after 30 seconds."
    }
  }
  ```

---

## 7. Client Credential Storage Across Platforms

| Client Platform | Storage Mechanism | Security Level | Failure / Recovery Handling |
| :--- | :--- | :---: | :--- |
| **VS Code Extension** | `vscode.ExtensionContext.secrets` | **Highest** (OS Keychain) | Prompt user via QuickPick if key is missing or revoked. |
| **Cursor Extension** | `vscode.ExtensionContext.secrets` | **Highest** (OS Keychain) | Identical to VS Code. |
| **Antigravity Plugin** | `~/.aimemory/credentials.json` (chmod 0600) / Env Var | **High** (User-isolated filesystem) | Status bar warning if file is world-readable. |
| **Browser Extension** | `chrome.storage.session` / `chrome.storage.local` | **High** (Browser sandbox) | Disconnects on browser restart if session-only. |
| **Web Dashboard** | HTTP-only, Secure, SameSite=Strict Cookie | **High** (Anti-XSS / CSRF) | Auto-redirects to login on 401. |
| **CI / Automated Agents** | `AIMEMORY_API_KEY` environment variable | **High** (Secret manager) | Exits cleanly with non-zero code on auth failure. |

---

## 8. Development vs. Production Environment Strategy

```text
┌───────────────────────────────────────┬───────────────────────────────────────┐
│       Development Environment         │        Production Environment         │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ • ALLOW_DEV_ANONYMOUS_AUTH=true       │ • ALLOW_DEV_ANONYMOUS_AUTH=false      │
│   (Allows quick local curl testing)   │ • Strict API key enforcement on all   │
│ • Local SQLite / Postgres support     │   protected endpoints                 │
│ • Full debug logging in console       │ • Hashed token lookup via Supabase    │
│ • Key prefix: aimem_test_...          │ • Sanitized error messages (no stack) │
│                                       │ • Key prefix: aimem_live_...          │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 9. Non-Destructive Migration & Rollback Strategy

### 9.1 Migration Steps
1. Add `ApiKey` model to `prisma/schema.prisma`.
2. Generate migration: `npx prisma migrate dev --name add_api_key_authentication`.
3. Apply migration to Supabase PostgreSQL.
4. Auto-generate default initial development key if no keys exist.

### 9.2 Rollback Plan
- The migration is 100% additive (`CREATE TABLE api_keys`).
- If rollback is required, existing `projects`, `memories`, `project_identities`, and `project_sources` tables are completely unaffected and continue working normally.
- Rollback SQL: `DROP TABLE IF EXISTS api_keys CASCADE;`.

---

## 10. Automated Security & Verification Test Plan

The automated test suite (`scratch/verify-phase5b0-auth.ts`) will test:
1. **Unauthenticated Request Rejection**: Requests without `Authorization` header receive `401 Unauthorized` with `UNAUTHORIZED` error code.
2. **Malformed Bearer Header**: Invalid prefixes, empty strings, or garbage tokens receive `401 Unauthorized`.
3. **Invalid Token Rejection**: Syntactically valid tokens that do not exist in the database receive `401 Unauthorized`.
4. **Revoked Token Rejection**: Keys with `revokedAt != null` receive `401 Unauthorized`.
5. **Expired Token Rejection**: Keys with `expiresAt < now()` receive `401 Unauthorized`.
6. **Valid Token Acceptance**: Active keys successfully authenticate across all endpoints.
7. **Scope Enforcement**: Keys with `read` scope cannot execute `POST`, `PATCH`, or `DELETE`.
8. **Rate Limiter Enforcement**: Exceeding 60 requests in sliding window receives `429 Too Many Requests`.
9. **Zero Plaintext Key Storage**: Database verification confirms `api_keys` table stores only SHA-256 hashes.
10. **Backward Compatibility**: Project resolution and memory operations continue functioning seamlessly when authenticated.

---

## 11. Critical Architecture Review & Unresolved Risks

### Identified Considerations Before Execution:
1. **Initial Bootstrap Key Requirement**:
   - Once authentication is enforced, the first API request will fail unless an initial API key exists.
   - **Recommendation**: Provide a lightweight database seed helper (`npm run seed:key` or automatic fallback creation for `dev` environments) so developers can easily generate their initial API key upon migration.
2. **Web Dashboard Auth Bridge**:
   - The web dashboard (`/projects`, `/projects/[id]`) currently communicates with backend APIs via `src/lib/api-client.ts`.
   - **Recommendation**: Provide cookie-based or internal session header forwarding in `src/lib/api-client.ts` so the web UI continues to load smoothly alongside external API key clients.

---

## 12. Verification & Completion Criteria

Phase 5B.0 will be considered complete when:
- `ApiKey` Prisma model is migrated and applied to PostgreSQL.
- `requireAuth` guard and `UnauthorizedError`/`ForbiddenError` domain errors are implemented.
- All `/api/projects/*` and `/api/memories/*` endpoints enforce authentication and scope validation.
- Rate limiting middleware is active.
- Automated security integration test suite passes with 100% assertions and cleans up test keys.
- Static checks pass: `npx prisma validate`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
