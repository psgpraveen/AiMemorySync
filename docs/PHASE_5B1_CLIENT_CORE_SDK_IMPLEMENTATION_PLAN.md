# Phase 5B.1: Client Core SDK (`@aimemory/client-core`) Architecture & Implementation Plan (Revised)

---

## 1. Executive Summary & Review Revisions

This revised implementation plan incorporates the architectural review for **Phase 5B.1**:
1. **Zero Cryptographic Dependency in Core**: Removed `crypto.subtle` from SDK core requirements. The server handles all identity hashing, credential stripping, and token hashing. The SDK requires only standard `fetch` (injectable) and `AbortController`.
2. **Explicit API Protocol Types**: Replaced internal domain model mirroring with explicit client-facing API protocol types organized cleanly under `types/api.ts`, `types/project.ts`, `types/memory.ts`, `types/context.ts`, and `types/discovery.ts`.
3. **Zero Production Runtime Dependencies**: Clarified that zero runtime dependencies applies strictly to production bundle size. Development/build dependencies (`typescript`, `tsup`, test tooling) are used for compilation and testing.
4. **Simple In-Memory Cache (No Premature LRU)**: Replaced premature LRU complexity with a clean `InMemoryCache` supporting TTL and an optional maximum entry limit.
5. **Refined Auth Responsibilities**: Auth module does NOT validate tokens locally. It delegates credential storage to platform `SecureStorageAdapter`, attaches the `Authorization: Bearer <apiKey>` header, handles 401/403 responses, and emits auth events.
6. **Decoupled Workspace Lifecycle**: The SDK provides explicit resolution primitives (`client.projects.resolve(signals)`). The platform integration orchestrates when to detect and trigger resolution upon workspace lifecycle changes.
7. **Strict Backend API Alignment**: Memory module implements only existing, verified backend endpoints (`list`, `create`, `get`, `update`, `deprecate`, `archive`). No unsupported search endpoints are included.
8. **Standardized Namespaced Events**: Standardized on colon-separated lowercase event identifiers (`project:resolved`, `memory:created`, `auth:unauthorized`, `rate-limit:exceeded`, etc.).
9. **Log Safety by Construction**: Diagnostic logs prevent secret leakage by never emitting API keys, authorization headers, raw credentials, or raw memory contents in debug messages.

---

## 2. Current Architecture Audit & Backend Compatibility Matrix

The following matrix documents the exact backend API contracts verified against the codebase:

| Endpoint | Method | Required Scope | Rate Limit | SDK Module Method | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/projects/resolve` | `POST` | `write` | 60/min | `client.projects.resolve(input)` | **Active** |
| `/api/projects` | `GET` | `read` | 120/min | `client.projects.list(filters)` | **Active** |
| `/api/projects` | `POST` | `write` | 60/min | `client.projects.create(payload)` | **Active** |
| `/api/projects/:id` | `GET` | `read` | 120/min | `client.projects.get(id)` | **Active** |
| `/api/projects/:id` | `PATCH` | `write` | 60/min | `client.projects.update(id, payload)` | **Active** |
| `/api/projects/:id` | `DELETE` | `admin` | 60/min | `client.projects.archive(id)` | **Active** |
| `/api/projects/:id/memories` | `GET` | `read` | 120/min | `client.memories.list(projectId, filters)` | **Active** |
| `/api/projects/:id/memories` | `POST` | `write` | 60/min | `client.memories.create(projectId, payload)`| **Active** |
| `/api/projects/:id/context` | `GET` | `read` | 120/min | `client.context.get(projectId, options)` | **Active** |
| `/api/memories/:id` | `GET` | `read` | 120/min | `client.memories.get(id)` | **Active** |
| `/api/memories/:id` | `PATCH` | `write` | 60/min | `client.memories.update(id, payload)` | **Active** |
| `/api/memories/:id/deprecate`| `POST` | `write` | 60/min | `client.memories.deprecate(id)` | **Active** |
| `/api/memories/:id` | `DELETE` | `admin` | 60/min | `client.memories.archive(id)` | **Active** |
| `/api/auth/keys` | `GET` | `admin` | 120/min | `client.auth.listKeys()` | **Active** |
| `/api/auth/keys` | `POST` | `admin` | 60/min | `client.auth.createKey(payload)` | **Active** |
| `/api/auth/keys/:id/revoke` | `POST` | `admin` | 60/min | `client.auth.revokeKey(id)` | **Active** |
| `/api/memories/search` | `GET` | `read` | — | *Not in SDK Phase 5B.1* | **Future** |

---

## 3. Package Structure

```text
packages/
└── client-core/
    ├── package.json               # Dual ESM/CJS exports, zero runtime deps
    ├── tsconfig.json              # ES2022 target, strict mode
    ├── tsup.config.ts             # Fast dual bundle generator (.mjs, .cjs, .d.ts)
    ├── README.md                  # SDK developer guide
    │
    ├── src/
    │   ├── index.ts               # Root exports facade
    │   ├── client.ts              # AiMemoryClient root facade class
    │   ├── config.ts              # Client configuration & URL normalization
    │   │
    │   ├── adapters/              # Platform adapter interfaces & default fallbacks
    │   │   ├── index.ts
    │   │   ├── storage.ts         # SecureStorageAdapter (OS Keychains / Secrets)
    │   │   ├── workspace.ts       # WorkspaceProvider (Platform signal source)
    │   │   ├── cache.ts           # CacheAdapter & InMemoryCache (Simple TTL)
    │   │   └── logger.ts          # LoggerAdapter & SafeLogMetadata
    │   │
    │   ├── transport/             # Resilient HTTP transport
    │   │   ├── index.ts
    │   │   ├── http-client.ts     # Fetch wrapper with timeout & envelope unwrapping
    │   │   ├── retry.ts           # Exponential backoff with jitter & 429 Retry-After
    │   │   └── errors.ts          # Typed SDK error hierarchy
    │   │
    │   ├── modules/               # Domain API modules
    │   │   ├── index.ts
    │   │   ├── auth.ts            # Key reference storage & header attachment
    │   │   ├── projects.ts        # Resolution & project operations
    │   │   ├── memories.ts        # Project-scoped memory operations
    │   │   └── context.ts         # Assembled context retrieval
    │   │
    │   ├── events/                # Event system
    │   │   ├── index.ts
    │   │   ├── event-emitter.ts   # Cross-environment TypedEventEmitter
    │   │   └── event-types.ts     # Standardized namespaced event map
    │   │
    │   └── types/                 # Pure client API protocol contracts
    │       ├── index.ts
    │       ├── api.ts             # Envelope & common protocol types
    │       ├── project.ts         # Project entity & payload types
    │       ├── memory.ts          # Memory entity & filter types
    │       ├── context.ts         # Context assembly & section types
    │       └── discovery.ts       # Signal & resolution types
    │
    └── test/                      # Automated unit & integration tests
        ├── client.test.ts
        ├── config.test.ts
        ├── transport.test.ts
        ├── retry.test.ts
        ├── events.test.ts
        └── modules/
            ├── projects.test.ts
            ├── memories.test.ts
            └── context.test.ts
```

---

## 4. API Protocol Types (`types/`)

### 4.1 Common API Protocol (`types/api.ts`)
```typescript
export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}
```

### 4.2 Project Protocol Types (`types/project.ts`)
```typescript
export type ProjectStatus = "ACTIVE" | "ARCHIVED";
export type ProjectCreationSource = "MANUAL" | "AUTO_DISCOVERY";

export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  creationSource: ProjectCreationSource;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPayload {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  slug?: string;
  description?: string;
  status?: ProjectStatus;
}

export interface ListProjectsFilter {
  status?: ProjectStatus;
}
```

### 4.3 Discovery & Resolution Types (`types/discovery.ts`)
```typescript
export type ProjectIdentityType =
  | "GIT_REMOTE"
  | "MONOREPO_SUBPROJECT"
  | "PACKAGE_MANIFEST"
  | "WORKSPACE_DIGEST"
  | "PLATFORM_SESSION";

export interface PackageManifestSignal {
  ecosystem: string;
  name: string;
}

export interface DiscoverySignals {
  gitRemoteUrl?: string;
  monorepoSubPath?: string;
  packageManifest?: PackageManifestSignal;
  workspaceName?: string;
  localPath?: string;
}

export interface DiscoverySource {
  platform: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface ResolveProjectInput {
  signals: DiscoverySignals;
  source: DiscoverySource;
}

export interface ResolveProjectResult {
  project: ProjectDto;
  matchedBy: ProjectIdentityType;
  canonicalIdentity: string;
  confidence: number;
  isNewlyCreated: boolean;
}
```

### 4.4 Memory Protocol Types (`types/memory.ts`)
```typescript
export type MemoryType = "DECISION" | "REQUIREMENT" | "CONVENTION" | "BUG_SOLUTION";
export type MemoryPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
export type MemoryStatus = "ACTIVE" | "DEPRECATED" | "ARCHIVED";

export interface MemoryDto {
  id: string;
  projectId: string;
  type: MemoryType;
  title: string;
  content: string;
  priority: MemoryPriority;
  contentHash: string;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryPayload {
  type: MemoryType;
  title: string;
  content: string;
  priority?: MemoryPriority;
}

export interface UpdateMemoryPayload {
  title?: string;
  content?: string;
  type?: MemoryType;
  priority?: MemoryPriority;
  status?: MemoryStatus;
}

export interface ListMemoriesFilter {
  status?: MemoryStatus;
  type?: MemoryType;
  priority?: MemoryPriority;
}
```

### 4.5 Context Assembly Protocol Types (`types/context.ts`)
```typescript
export interface ContextOptions {
  budget?: number; // characters, min 1000, max 50000, default 8000
  types?: MemoryType[];
}

export interface AssembledContextSection {
  memoryId: string;
  type: MemoryType;
  title: string;
  priority: MemoryPriority;
  characters: number;
  content: string;
}

export interface AssembledContextResult {
  projectId: string;
  projectName: string;
  budget: {
    requested: number;
    usedCharacters: number;
    remainingCharacters: number;
    itemCount: number;
  };
  markdown: string;
  includedMemories: AssembledContextSection[];
}
```

---

## 5. Platform Adapter Architecture

### 5.1 SecureStorageAdapter
```typescript
export interface SecureStorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
```
*Platform implementations:*
- VS Code / Cursor: `context.secrets`
- Browser: `IndexedDB` with WebCrypto encryption or `chrome.storage.local`
- In-Memory Fallback: `MemorySecureStorage` (provided out-of-the-box for tests / CLI)

### 5.2 WorkspaceProvider
```typescript
export interface WorkspaceInfo {
  workspaceName?: string;
  localPath?: string;
  gitRemoteUrl?: string;
  monorepoSubPath?: string;
  packageManifest?: PackageManifestSignal;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceProvider {
  getWorkspace(): Promise<WorkspaceInfo | null>;
}
```

### 5.3 CacheAdapter & Simple InMemoryCache
```typescript
export interface CacheOptions {
  ttlMs?: number;
}

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryCache implements CacheAdapter {
  private store = new Map<string, { value: unknown; expiresAt: number | null }>();

  constructor(private maxEntries: number = 200) {}

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    const expiresAt = options?.ttlMs ? Date.now() + options.ttlMs : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
```

### 5.4 LoggerAdapter
```typescript
export interface SafeLogMetadata {
  clientId?: string;
  platform?: string;
  projectId?: string;
  memoryId?: string;
  status?: number;
  durationMs?: number;
  [key: string]: unknown;
}

export interface LoggerAdapter {
  debug(message: string, metadata?: SafeLogMetadata): void;
  info(message: string, metadata?: SafeLogMetadata): void;
  warn(message: string, metadata?: SafeLogMetadata): void;
  error(message: string, metadata?: SafeLogMetadata): void;
}
```

---

## 6. Transport & Resilience Architecture

### 6.1 HttpClient Configuration
```typescript
export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  platform: string;
  clientId?: string;
  timeoutMs?: number;              // default: 10000 (10s)
  maxRetries?: number;             // default: 3
  fetch?: typeof globalThis.fetch; // injectable fetch implementation
  storage?: SecureStorageAdapter;
  cache?: CacheAdapter;
  logger?: LoggerAdapter;
}
```

### 6.2 Retry Strategy
- Retries on network disconnection, timeout, and HTTP `502`, `503`, `504` errors using exponential backoff with full jitter:
  $$\text{sleep} = \min(\text{maxBackoff}, \text{baseBackoff} \times 2^{\text{attempt}}) \times \text{random}(0.5, 1.5)$$
- On `429 Too Many Requests`:
  - Parses `Retry-After` header (seconds or RFC 2822 date).
  - Emits `rate-limit:exceeded` event.
  - Throws `RateLimitError` (does not lock thread in unbounded retry loop).

---

## 7. Standardized Namespaced Event Dictionary

```typescript
export interface AiMemoryEvents {
  "workspace:detected": { workspace: WorkspaceInfo };
  "workspace:changed": { previous?: WorkspaceInfo; current?: WorkspaceInfo };
  "project:resolved": { result: ResolveProjectResult };
  "project:changed": { previousProjectId?: string; newProject: ProjectDto };
  "memory:created": { memory: MemoryDto };
  "memory:updated": { memory: MemoryDto };
  "memory:deprecated": { memoryId: string };
  "context:updated": { projectId: string };
  "auth:unauthorized": { error: AuthenticationError };
  "auth:changed": { hasKey: boolean };
  "network:offline": { error: NetworkError };
  "network:online": void;
  "rate-limit:exceeded": { retryAfterSecs?: number };
}
```

---

## 8. Typed Error Hierarchy

```typescript
export class AiMemoryError extends Error {
  constructor(
    message: string,
    public readonly code: string = "SDK_ERROR",
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends AiMemoryError {
  constructor(message = "Authentication required. Invalid or missing API key.", details?: unknown) {
    super(message, "UNAUTHORIZED", 401, details);
  }
}

export class AuthorizationError extends AiMemoryError {
  constructor(message = "Access forbidden. Insufficient permissions or scopes.", details?: unknown) {
    super(message, "FORBIDDEN", 403, details);
  }
}

export class RateLimitError extends AiMemoryError {
  constructor(message = "Rate limit exceeded. Please slow down.", public readonly retryAfterSecs?: number, details?: unknown) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, details);
  }
}

export class NotFoundError extends AiMemoryError {
  constructor(message = "Requested resource not found.", details?: unknown) {
    super(message, "NOT_FOUND", 404, details);
  }
}

export class ConflictError extends AiMemoryError {
  constructor(message = "Resource conflict or duplicate detected.", details?: unknown) {
    super(message, "CONFLICT", 409, details);
  }
}

export class ValidationError extends AiMemoryError {
  constructor(message = "Request validation failed.", details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class NetworkError extends AiMemoryError {
  constructor(message = "Network request failed. Host unreachable.", details?: unknown) {
    super(message, "NETWORK_ERROR", undefined, details);
  }
}

export class TimeoutError extends AiMemoryError {
  constructor(message = "Request timed out.", details?: unknown) {
    super(message, "TIMEOUT", 408, details);
  }
}
```

---

## 9. Public Facade API (`AiMemoryClient`)

```typescript
import { AiMemoryClient } from "@aimemory/client-core";

const client = new AiMemoryClient({
  baseUrl: "https://api.yourdomain.com",
  apiKey: "aimem_live_...",
  platform: "VSCODE",
  clientId: "macbook-work-01",
});

// 1. Resolve Project
const resolution = await client.projects.resolve({
  signals: {
    gitRemoteUrl: "git@github.com:antigravityteam/aimemorysync.git",
    monorepoSubPath: "packages/client-core",
    packageManifest: { ecosystem: "npm", name: "@aimemory/client-core" },
    workspaceName: "AiMemorySync",
  },
  source: {
    platform: "VSCODE",
    metadata: { ideVersion: "1.98.0" },
  },
});

// 2. Fetch Assembled Context for AI Prompt
const context = await client.context.get(resolution.project.id, {
  budget: 8000,
  types: ["DECISION", "REQUIREMENT", "CONVENTION"],
});

// 3. Project-Scoped Memory CRUD
const memories = await client.memories.list(resolution.project.id, {
  status: "ACTIVE",
});

const newMemory = await client.memories.create(resolution.project.id, {
  type: "DECISION",
  title: "Client-Core Architecture",
  content: "All client integrations consume @aimemory/client-core.",
  priority: "HIGH",
});

// 4. Token & Credential Operations
await client.auth.setApiKey("aimem_live_newkey...");
await client.auth.clearApiKey();

// 5. Events
client.events.on("project:resolved", ({ result }) => {
  console.log(`Connected to ${result.project.name}`);
});
```

---

## 10. Step-by-Step Implementation Roadmap

1. **Step 1: Workspace & Build Configuration**:
   - Add `"workspaces": ["packages/*"]` to root `package.json`.
   - Scaffold `packages/client-core` with `package.json`, `tsconfig.json`, and `tsup.config.ts`.
2. **Step 2: Core Contracts & Types (`types/`)**:
   - Create `types/api.ts`, `types/project.ts`, `types/memory.ts`, `types/context.ts`, and `types/discovery.ts`.
3. **Step 3: Adapters & Defaults (`adapters/`)**:
   - Implement `storage.ts` (with `MemorySecureStorage`), `workspace.ts`, `cache.ts` (with `InMemoryCache`), and `logger.ts`.
4. **Step 4: Transport & Errors (`transport/`)**:
   - Implement `HttpClient`, `retry.ts` (exponential backoff & jitter), and `errors.ts` (typed SDK errors).
5. **Step 5: Event System (`events/`)**:
   - Implement zero-dependency `TypedEventEmitter` and `event-types.ts`.
6. **Step 6: Domain Modules (`modules/`)**:
   - Implement `AuthModule`, `ProjectsModule`, `MemoriesModule`, and `ContextModule`.
7. **Step 7: Facade Entrypoint (`client.ts` & `index.ts`)**:
   - Build `AiMemoryClient` connecting all modules, transport, and adapters.
8. **Step 8: Automated Test Suite (`test/`)**:
   - Author unit tests for config, retry logic, error mapping, event dispatching, resolution, and memory CRUD.
9. **Step 9: Dual Bundle Build & Verification**:
   - Run `tsup` build, producing `.mjs`, `.cjs`, and `.d.ts` bundles; verify type completeness and clean build output.
10. **Step 10: Documentation & Project Memory Sync**:
    - Update `.antigravity/` files and project documentation.
