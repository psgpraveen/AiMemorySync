# Phase 5B Implementation Plan: Client Core SDK & First IDE Integration (VS Code)

## 1. Executive Summary & Architectural Overview

### 1.1 Objective
Phase 5A delivered the backend **Automatic Project Discovery & Identity Resolution Engine** (`POST /api/projects/resolve`). Phase 5B connects the real-world developer environment to this engine.

Rather than building fragmented, ad-hoc extensions for each individual tool, Phase 5B establishes a **two-layer architecture**:
1. **AiMemorySync Client Core SDK (`@aimemory/client-core`)**: A pure TypeScript, zero-IDE-dependency library containing all workspace inspection, Git remote discovery, manifest parsing, monorepo subpath detection, identity hashing, caching, and API communication logic.
2. **Platform Adapters (Thin Wrappers)**: Platform-specific extensions (starting with VS Code, followed by Cursor, Antigravity, and CLI) that map host IDE lifecycle events, UI status bars, and storage to the Client Core SDK.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Platform Adapters                                  │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────────────┐   │
│   │  VS Code Extension  │  │  Cursor Extension   │  │  Antigravity Plugin   │   │
│   └──────────┬──────────┘  └──────────┬──────────┘  └───────────┬───────────┘   │
└──────────────┼────────────────────────┼─────────────────────────┼───────────────┘
               ▼                        ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    AiMemorySync Client Core SDK (@aimemory/core)                │
│                                                                                 │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐  │
│  │  Workspace Detector   │ │  Git Remote Inspector │ │  Manifest Parser      │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────────┘  │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐  │
│  │  Monorepo Subpath     │ │  Local Project Cache  │ │  API Client & Auth    │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────────┘  │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ (HTTP POST /api/projects/resolve)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        AiMemorySync Cloud / Backend API                         │
│             (Multi-Tier Identity Engine, Memory Storage, Context API)           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.2 Terminology Alignment: Tiers vs. Database Identity Types
To eliminate any ambiguity between conceptual tiers and database types:
- **4 Primary Confidence Tiers**:
  - **Tier 1 (Confidence 100 / 95)**: Git Remote Repository (with Monorepo Subproject specialization).
  - **Tier 2 (Confidence 80)**: Package Manifest Identity (`pkg:<ecosystem>:<name>`).
  - **Tier 3 (Confidence 50)**: Workspace Digest Fallback (`ws:<clientId>:<folder>:<hash>`).
  - **Tier 4 (Confidence 30)**: Platform Session Fallback (`platform:<name>:<sessionId>`).
- **5 Discrete Database Identity Types (`ProjectIdentityType`)**:
  1. `GIT_REMOTE`
  2. `MONOREPO_SUBPROJECT`
  3. `PACKAGE_MANIFEST`
  4. `WORKSPACE_DIGEST`
  5. `PLATFORM_SESSION`

---

## 2. Phased Implementation Sequence

To ensure high reliability, security, and clean separation of concerns, Phase 5B is structured into 4 sequential sub-phases:

```text
Phase 5B.0: API Authentication & Security Foundation
  └─ Implement API Key / Personal Access Token authentication guard on /api/* routes.
  └─ Prevent unauthorized project resolution and context leakage.

Phase 5B.1: Client Core SDK Architecture (@aimemory/client-core)
  └─ Build pure TypeScript workspace inspector, git detector, manifest parser, cache, and HTTP client.

Phase 5B.2: VS Code Extension Adapter
  └─ Build VS Code extension lifecycle, background activation, status bar indicator, commands, and secret storage.

Phase 5B.3: Context Retrieval & Memory Capture Integration
  └─ Enable the extension to pull assembled context and submit candidate memories.
```

---

## 3. Detailed Sub-Phase Specifications

### 3.1 Phase 5B.0: API Authentication & Security Foundation

#### Audit Finding
Currently, all REST endpoints (`/api/projects`, `/api/projects/resolve`, `/api/memories`, `/api/projects/:id/context`) are open. When external IDE extensions begin connecting, open endpoints present severe risks of unauthorized memory injection, context extraction, and project enumeration.

#### Authentication Architecture Plan
1. **API Key Authentication Guard**:
   - Model: `ApiKey` in database or environment-backed token for single-tenant / local deployments.
   - Format: `aimem_live_<32_random_bytes>` (stored as SHA-256 hash in database).
   - Header: `Authorization: Bearer <api_key>`.
2. **Middleware / Route Guard Utility**:
   - Create `src/lib/api/auth-guard.ts` providing `requireApiKey(request: NextRequest)`.
   - Returns typed `AuthContext` or throws `401 Unauthorized` (`UNAUTHORIZED`).
   - For local test suites, provide a deterministic test token bypass.
3. **Client Secret Storage**:
   - Extension stores the API key in VS Code `SecretStorage` (encrypted via OS Keychain: macOS Keychain, Windows Credential Manager, Linux Secret Service).

---

### 3.2 Phase 5B.1: Client Core SDK (`@aimemory/client-core`)

#### Directory & Package Structure
```text
src/client-core/
├── index.ts                      # Public SDK entry point
├── client.ts                     # AiMemoryClient class orchestrating discovery & API calls
├── detector/
│   ├── workspace-detector.ts     # Root directory & environment scanner
│   ├── git-detector.ts           # Pure Node fs .git/config parser + CLI fallback
│   ├── manifest-detector.ts      # package.json, Cargo.toml, pyproject.toml, go.mod scanner
│   └── monorepo-detector.ts      # Parent git root traversal & subpath calculator
├── cache/
│   ├── storage-interface.ts      # IStorageProvider abstract contract
│   ├── memory-storage.ts         # In-memory storage implementation (testing)
│   └── resolution-cache.ts       # TTL-based project resolution cache & invalidation manager
├── http/
│   ├── api-client.ts             # Typed HTTP fetch wrapper with retry & exponential backoff
│   └── types.ts                  # Signal payloads, responses, and error definitions
└── utils/
    ├── path-sanitizer.ts         # Path normalization & privacy hash generator
    └── logger.ts                 # Safe client logger (strips tokens and private paths)
```

#### Core SDK Capabilities
1. **Git Remote Inspector (`git-detector.ts`)**:
   - **Fast-Path (No child processes)**: Directly reads and parses `.git/config` using Node `fs`. Extracts `[remote "origin"] url` or first available remote.
   - **Fallback (Submodules/Worktrees)**: If `.git` is a pointer file or git directory is external, executes `git config --get remote.origin.url` via non-blocking `execFile`.
2. **Monorepo Subpath Detector (`monorepo-detector.ts`)**:
   - Traverses parent directories from the workspace folder looking for `.git`.
   - If `.git` is found at `/repo` and workspace is at `/repo/packages/api`, automatically sets `monorepoSubPath = "packages/api"`.
3. **Package Manifest Detector (`manifest-detector.ts`)**:
   - Checks workspace root for:
     - `package.json` &rarr; ecosystem: `"npm"`, name: `pkg.name`
     - `Cargo.toml` &rarr; ecosystem: `"cargo"`, name: `package.name`
     - `pyproject.toml` &rarr; ecosystem: `"pypi"`, name: `project.name`
     - `go.mod` &rarr; ecosystem: `"go"`, name: `module`
4. **Resolution Cache (`resolution-cache.ts`)**:
   - Computes a local workspace fingerprint: `SHA-256(gitRemote + monorepoSubPath + manifestName + workspaceRoot)`.
   - Caches resolved `projectId`, `name`, `slug`, and `canonicalIdentity` with a configurable TTL (e.g. 24 hours).
   - Invalidation: Cache is immediately invalidated if `.git/config` or workspace root changes.

---

### 3.3 Phase 5B.2: VS Code Extension Adapter

#### Extension Responsibilities
1. **Activation (`onStartupFinished`)**:
   - Activates asynchronously in the background. **Never blocks VS Code startup or UI threads**.
2. **Storage Binding**:
   - Implements `IStorageProvider` using `vscode.ExtensionContext.workspaceState` (workspace-scoped cache) and `vscode.ExtensionContext.secrets` (API token).
3. **Status Bar Item**:
   - `$(sync~spin) AiMemory: Resolving...` (during background discovery)
   - `$(check) AiMemory: <ProjectName>` (connected successfully)
   - `$(cloud-offline) AiMemory: Offline` (cached resolution / backend unreachable)
   - `$(key) AiMemory: Set API Key` (when unauthenticated)
4. **Commands Registered**:
   - `aimemory.resolveProject`: Manually trigger workspace re-resolution.
   - `aimemory.setApiKey`: Prompt user to store/update API key securely.
   - `aimemory.openDashboard`: Open web dashboard for active project in browser.
   - `aimemory.copyContext`: Fetch and copy assembled project context to clipboard.

---

## 4. Addressing the 10 Critical Architecture Decisions

| # | Architectural Question | Decision & Technical Specification |
| :-: | :--- | :--- |
| **1** | **Monorepo Detection** | Traverse parent directories upwards until `.git` is found. If `.git` is in an ancestor folder, compute relative subpath (`path.relative(gitRoot, workspaceFolder)`) and populate `signals.monorepoSubPath`. |
| **2** | **Multi-Root Workspaces** | In multi-root workspaces, the extension resolves each folder independently, maintaining a `Map<folderUri, ResolvedProject>`. Active editor events determine which project context is active. |
| **3** | **Git Discovery Mechanism** | Two-tier discovery: (1) Direct Node `fs` parsing of `.git/config` (instant, zero child process overhead), with (2) `git remote get-url origin` CLI fallback for submodules/worktrees. |
| **4** | **Local Cache Architecture** | SDK defines abstract `IStorageProvider`. VS Code adapter implements it via `workspaceState`. Cache stores `projectId`, `canonicalIdentity`, `identityHash`, `apiUrl`, and timestamp. Invalidation occurs on `.git/config` mtime change. |
| **5** | **API Authentication MVP** | Phase 5B.0 introduces Bearer API Key authentication (`Authorization: Bearer <key>`). The extension stores the key securely in VS Code `SecretStorage` (OS Keychain). |
| **6** | **Offline Behavior** | If the backend is unreachable: (1) Use cached resolution if available; (2) If no cache, enter `OFFLINE_UNRESOLVED` state without throwing uncaught errors; (3) Status bar shows `AiMemory: Offline`. |
| **7** | **Retry & Backoff Strategy** | Exponential backoff with jitter: initial delay 1s, factor 2, max delay 30s, max 3 retries. After 3 failures, activate circuit breaker and wait for user trigger or workspace change. |
| **8** | **Activation Events** | Activate via `onStartupFinished` or `workspaceContains:*`. Core logic executes in a detached background promise to guarantee zero editor blocking. |
| **9** | **Decoupled Platform Adapters** | The Client Core SDK (`src/client-core/`) contains 100% of detection, hashing, resolution, and caching logic without referencing `vscode.*` APIs. Adapters simply supply `IStorageProvider` and handle UI. |
| **10** | **Reuse for Cursor, Antigravity & CLI** | Cursor directly reuses the VS Code extension bundle. Antigravity and CLI agents import `@aimemory/client-core` directly and supply file-based or in-memory storage providers. |

---

## 5. Security & Privacy Boundary

### Strict Data Egress Boundary
The extension and Client Core SDK enforce a strict data egress rule:

```text
ALLOWED TO SEND TO CLOUD:
✔ Canonical Git Remote (credentials stripped)
✔ Monorepo Subpath (e.g. "packages/core")
✔ Package Manifest Name (e.g. "@company/api")
✔ Workspace Root Folder Name (e.g. "AiMemorySync")
✔ Local Path SHA-256 Digest (raw path is NEVER sent)
✔ Platform Identifier (e.g. "VSCODE")

STRICTLY FORBIDDEN FROM LEAVING MACHINE:
❌ Source code files or file contents
❌ Git credentials, passwords, or personal tokens
❌ Raw local filesystem paths (/Users/alice/SecretClient/...)
❌ Environment variables or .env file contents
❌ Workspace directory trees or filenames
```

---

## 6. End-to-End Resolution Sequence Diagram

```text
VS Code Startup / Workspace Open
        │
        ▼ (onStartupFinished)
Extension Activates
        │
        ▼
Read API Key from SecretStorage
        │
        ├── [No Key] ──> Status Bar: "AiMemory: Set API Key" (Wait for user)
        │
        └── [Key Present]
                │
                ▼
        Client Core: Inspect Workspace
                ├── 1. Check .git/config ──> origin = "git@github.com:org/repo.git"
                ├── 2. Check Monorepo ──> subPath = null
                ├── 3. Check Manifest ──> package.json name = "aimemorysync"
                └── 4. Workspace Name ──> "AiMemorySync"
                │
                ▼
        Check Local Cache (workspaceState)
                │
                ├── [Valid Cache Exists] ──> Status Bar: "AiMemory: <ProjectName>" (Ready)
                │
                └── [Cache Miss / Expired]
                        │
                        ▼
                POST /api/projects/resolve (Bearer <key>)
                        │
                        ├── [Network Error] ──> Fallback to Cache or Status Bar: "Offline"
                        │
                        └── [200 OK / 201 Created]
                                │
                                ├── Save to Local Cache (TTL 24h)
                                └── Status Bar: "AiMemory: <ProjectName>"
```

---

## 7. Testing & Verification Strategy

1. **Client Core Unit Tests (`src/client-core/__tests__/`)**:
   - Workspace detection for standard Git repo, monorepos, and non-git folders.
   - Manifest detection across `package.json`, `Cargo.toml`, `pyproject.toml`, and `go.mod`.
   - Git remote parser handling SSH, HTTPS, token-embedded, and SCP formats from raw `.git/config` content.
   - Cache storage and invalidation triggers.
2. **Authentication Integration Tests**:
   - Valid API key allows resolution.
   - Missing/invalid API key returns 401 `UNAUTHORIZED`.
3. **End-to-End Extension Simulation**:
   - Automated test opening simulated workspace directories and verifying resolution payload, cache hit, and background execution safety.
4. **Static Checks**:
   - `npx prisma validate`
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run build`
