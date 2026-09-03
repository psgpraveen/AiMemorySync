# Phase 5B.2 — VS Code Extension Integration Implementation Plan

## Overview & Goal

The goal of **Phase 5B.2** is to build the first official IDE integration for **AiMemorySync**: a production-ready, native Visual Studio Code extension located in `packages/vscode-extension/`.

The extension consumes the zero-runtime-dependency `@aimemory/client-core` SDK implemented in Phase 5B.1. It provides automatic project discovery, secure authentication via VS Code `SecretStorage`, resilient background synchronization, explicit AI context assembly, and a clean, native TreeView interface in the VS Code Activity Bar.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        VS Code Extension Host                          │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │               AiMemoryExtension Controller                     │   │
│   └──────┬──────────────────┬───────────────────┬──────────────┬───┘   │
│          ▼                  ▼                   ▼              ▼       │
│    WorkspaceTrust     SecretStorage       Workspace        StatusBar   │
│        Guard             Adapter          Lifecycle         Manager    │
│          │                  │                 │                │       │
│          │                  ▼                 ▼                │       │
│          │           VS Code Secrets   Signal Extractor        │       │
│          │          (Encrypted OS)     (Git/Manifest)          │       │
│          │                  │                 │                │       │
│          └──────────────────┼─────────────────┼────────────────┘       │
│                             ▼                 ▼                        │
│                 ┌──────────────────────────────────────┐               │
│                 │        @aimemory/client-core         │               │
│                 │          (AiMemoryClient)            │               │
│                 └──────────────────┬───────────────────┘               │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │ HTTPS / Bearer Token
                                     ▼
                          AiMemorySync Cloud API
                   (/api/projects/resolve, /api/memories)
```

---

## 1. Architecture & Component Responsibilities

### 1.1 Folder Structure (`packages/vscode-extension/`)

```text
packages/vscode-extension/
├── package.json                   # Extension manifest, contribution points, commands, views
├── tsconfig.json                  # TypeScript compiler options (Node16 / ES2022)
├── tsup.config.ts                 # Fast bundler packaging into single dist/extension.js
├── README.md                      # Extension documentation & setup guide
├── media/                         # Extension icons and assets
│   ├── icon.png                   # Main extension icon (128x128)
│   ├── view-icon.svg              # Activity Bar container icon
│   └── dark/ / light/             # Theme-aware tree view item icons
├── src/
│   ├── extension.ts               # Extension entrypoint (activate, deactivate)
│   ├── constants.ts               # Configuration keys, command IDs, view IDs
│   ├── client/
│   │   ├── client-factory.ts      # Instantiates AiMemoryClient with VS Code adapters
│   │   └── client-holder.ts       # Singleton manager for active SDK client instance
│   ├── adapters/
│   │   ├── secret-storage.adapter.ts # Bridges VSCode SecretStorage to SecureStorageAdapter
│   │   └── output-channel.logger.ts  # Bridges VSCode OutputChannel to LoggerAdapter (sanitized)
│   ├── services/
│   │   ├── workspace-discovery.ts    # Extracts Git remotes, monorepo subpaths, manifests
│   │   ├── workspace-lifecycle.ts    # Debounces changes, tracks active project, prevents duplicate requests
│   │   ├── status-bar.manager.ts     # Status bar lifecycle indicator (Connected/Resolving/Error)
│   │   └── workspace-trust.guard.ts  # Enforces VS Code Workspace Trust policy
│   ├── providers/
│   │   ├── projects-tree.provider.ts # TreeDataProvider for active project identity & status
│   │   ├── memories-tree.provider.ts # TreeDataProvider for project memories (grouped by type/status)
│   │   └── context-tree.provider.ts  # TreeDataProvider for assembled context summary & budget
│   ├── commands/
│   │   ├── auth.commands.ts          # Connect, Disconnect, Check Connection
│   │   ├── project.commands.ts       # Resolve Project, Open Dashboard, Copy Context, Preview Context
│   │   └── memory.commands.ts        # Add Memory, Edit Memory, Deprecate, Archive, Refresh
│   ├── utils/
│   │   ├── ui-feedback.ts            # Standardized notification banners with actionable buttons
│   │   └── git-detector.ts           # Safe local Git remote reader (.git/config & CLI fallback)
│   └── index.ts
└── test/
    ├── suite/
    │   ├── discovery.test.ts         # Unit tests for discovery signal extraction
    │   ├── lifecycle.test.ts         # Tests for debounce & deduplication logic
    │   ├── secret-storage.test.ts    # Tests for SecretStorage adapter
    │   └── commands.test.ts          # Tests for command dispatching
    └── run-tests.ts                  # Test runner entrypoint
```

---

## 2. Core Subsystems Specification

### 2.1 Extension Activation Strategy

To ensure zero impact on VS Code startup latency while providing automatic project context when needed, the extension uses deliberate activation events:

```json
"activationEvents": [
  "onStartupFinished",
  "onCommand:aimemory.setApiKey",
  "onCommand:aimemory.resolveProject",
  "onCommand:aimemory.openDashboard",
  "onView:aimemory-projects",
  "onView:aimemory-memories",
  "onView:aimemory-context"
]
```

**Rationale**:
- `onStartupFinished` ensures the extension initializes gracefully after critical workbench services have loaded without blocking the UI thread.
- Direct command/view activations ensure instant availability if the user interacts with the sidebar immediately.

### 2.2 Secure Authentication via `VSCodeSecretStorageAdapter`

The extension delegates token storage strictly to VS Code's OS-backed encrypted keychain via `vscode.ExtensionContext.secrets`.

```typescript
import * as vscode from "vscode";
import type { SecureStorageAdapter } from "@aimemory/client-core";

export class VSCodeSecretStorageAdapter implements SecureStorageAdapter {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(key: string): Promise<string | null> {
    const value = await this.secrets.get(key);
    return value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.secrets.store(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.secrets.delete(key);
  }
}
```

**Security Rules**:
1. API keys are **NEVER** stored in `settings.json`, workspace configuration files, or `.vscode/` folders.
2. Tokens are stored under the key `aimemory.apiKey` inside OS Keychain / Windows Credential Manager / macOS Keychain / Linux Secret Service.
3. If an API key is missing or invalidated (HTTP 401), the extension presents a non-intrusive warning notification with an **"Enter API Key"** button that invokes `vscode.window.showInputBox({ password: true })`.

### 2.3 Workspace Discovery Provider

The discovery provider inspects opened workspace folders and extracts platform signals without exposing raw local machine paths in remote network payloads:

```text
Workspace Opened
       │
       ▼
1. Is Workspace Trusted? (vscode.workspace.isTrusted)
       ├─ No  ──► Halt automatic resolution (Status: Untrusted Workspace)
       └─ Yes ──► Proceed
       │
       ▼
2. Extract Primary Signals:
       ├─ Git Remote URL: Read from .git/config (e.g. "git@github.com:org/repo.git")
       ├─ Subproject Path: If root is in a monorepo (e.g. "packages/frontend")
       ├─ Manifest Metadata:
       │    ├─ package.json (name, version)
       │    ├─ Cargo.toml (name)
       │    ├─ pyproject.toml / setup.py
       │    └─ go.mod
       └─ Workspace Name: Folder display name
       │
       ▼
3. Construct ResolveProjectInput:
       {
         signals: { gitRemoteUrl, subprojectPath, packageJson, workspaceName },
         source: { platform: "VSCODE", clientVersion: "0.1.0" }
       }
```

### 2.4 Workspace Lifecycle & Concurrency Protection

To eliminate race conditions, excessive API polling, and duplicate project provisioning:

1. **Debounced Triggers**: Folder open and switch events are debounced by `400ms`.
2. **In-Flight Deduplication**: If a project resolution request for a workspace folder URI is currently pending, subsequent triggers attach to the existing Promise rather than dispatching a duplicate HTTP request.
3. **Workspace Project Cache**: The active project result is cached in memory per workspace folder URI. Re-focusing an already-resolved folder performs an instant local lookup and refreshes context asynchronously in the background.

```typescript
export class WorkspaceLifecycleService {
  private inFlightResolutions = new Map<string, Promise<ResolveProjectResult>>();
  private activeProjectCache = new Map<string, ResolveProjectResult>();
  private debounceTimer?: NodeJS.Timeout;

  async handleWorkspaceChange(folder: vscode.WorkspaceFolder): Promise<void> {
    const key = folder.uri.toString();
    if (this.inFlightResolutions.has(key)) {
      await this.inFlightResolutions.get(key);
      return;
    }

    const resolutionPromise = this.executeResolution(folder);
    this.inFlightResolutions.set(key, resolutionPromise);
    try {
      const result = await resolutionPromise;
      this.activeProjectCache.set(key, result);
    } finally {
      this.inFlightResolutions.delete(key);
    }
  }
}
```

---

## 3. VS Code User Interface Design

### 3.1 Native Activity Bar & Tree Views

Rather than introducing heavyweight Webview panels with DOM styling overhead, the extension implements high-performance, native VS Code **`TreeDataProvider`** views inside a custom Activity Bar container (`AiMemory`).

```text
Activity Bar [AiMemory Icon]
│
├── VIEW 1: PROJECT IDENTITY (aimemory-projects)
│   ├── 📦 Name: my-web-app
│   ├── 🔗 Matched By: GIT_REMOTE (github.com/org/my-web-app)
│   ├── 🎯 Confidence: 100% (Tier 1)
│   ├── 🏷️ Slug: my-web-app
│   └── 🌐 Status: ACTIVE
│
├── VIEW 2: PROJECT MEMORIES (aimemory-memories)
│   ├── 📁 Decisions (3)
│   │   ├── 🔹 Use PostgreSQL with Prisma ORM [CRITICAL]
│   │   ├── 🔹 Strict zero runtime dependency SDK [HIGH]
│   │   └── 🔹 Exact SHA-256 syntactic deduplication [NORMAL]
│   ├── 📁 Conventions (2)
│   │   ├── 🔹 Use Next.js App Router for all endpoints
│   │   └── 🔹 Strict Zod schema validation
│   └── 📁 Requirements (1)
│       └── 🔹 All API calls require Bearer authentication
│
└── VIEW 3: PROJECT CONTEXT PREVIEW (aimemory-context)
    ├── 📊 Budget Usage: 2,450 / 8,000 chars (30%)
    ├── 📑 Sections (3)
    │   ├── 📄 Architecture & Tech Stack (850 chars)
    │   ├── 📄 Core Conventions (600 chars)
    │   └── 📄 Active Decisions (1,000 chars)
    └── 📋 [Action] Copy Context to Clipboard
```

### 3.2 Tree View Item Actions & Inline Buttons

- **Memories View**:
  - `+` (Add Memory) on view header.
  - `🔄` (Refresh Memories) on view header.
  - `✏️` (Edit Memory) inline on memory item.
  - `⚠️` (Deprecate Memory) inline on memory item.
  - `🗑️` (Archive Memory) inline on memory item.
- **Context View**:
  - `📋` (Copy Context to Clipboard) inline and on view header.
  - `👁️` (Preview Context in Markdown Editor) on view header.

### 3.3 Status Bar Indicator

A compact, non-intrusive status item in the lower-right status bar:

| State | Status Bar Display | Tooltip | Click Action |
| :--- | :--- | :--- | :--- |
| **Disconnected** | `$(circle-slash) AiMemory` | AiMemorySync: No API Key Configured | `aimemory.setApiKey` |
| **Connecting** | `$(sync~spin) AiMemory: Connecting` | Validating API Key... | Open Logs |
| **Resolving** | `$(sync~spin) AiMemory: Resolving` | Resolving project identity for workspace... | Open Logs |
| **Connected** | `$(check) AiMemory: <project-name>` | Project: <name> (Matched by GIT_REMOTE) | `aimemory.openDashboard` |
| **Rate Limited** | `$(history) AiMemory: Rate Limited` | Rate limit active. Resuming in Xs | Open Logs |
| **Error** | `$(alert) AiMemory: Offline` | AiMemorySync: Backend unreachable | `aimemory.resolveProject` |

---

## 4. Command Matrix

| Command ID | Title | Palette | Explorer Context | View Header | Status Bar |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `aimemory.setApiKey` | **AiMemory: Connect / Set API Key** | Yes | No | Yes | Yes (when disconnected) |
| `aimemory.removeApiKey` | **AiMemory: Disconnect / Remove API Key** | Yes | No | No | No |
| `aimemory.checkConnection` | **AiMemory: Check API Connection** | Yes | No | Yes | No |
| `aimemory.resolveProject` | **AiMemory: Resolve Current Project** | Yes | Yes | Yes | Yes |
| `aimemory.copyContext` | **AiMemory: Copy Project Context to Clipboard** | Yes | Yes | Yes | No |
| `aimemory.previewContext` | **AiMemory: Preview Project Context (Markdown)** | Yes | No | Yes | No |
| `aimemory.addMemory` | **AiMemory: Add New Memory** | Yes | No | Yes | No |
| `aimemory.editMemory` | **AiMemory: Edit Memory** | No | No | Inline Item | No |
| `aimemory.deprecateMemory` | **AiMemory: Deprecate Memory** | No | No | Inline Item | No |
| `aimemory.archiveMemory` | **AiMemory: Archive Memory** | No | No | Inline Item | No |
| `aimemory.refreshAll` | **AiMemory: Refresh All Project Data** | Yes | No | Yes | No |
| `aimemory.openDashboard` | **AiMemory: Open Project in Web Dashboard** | Yes | Yes | Yes | Yes (when connected) |

---

## 5. VS Code API Verification (Stable vs Proposed)

To ensure the extension installs and runs on standard VS Code installations without experimental flags or developer build constraints:

### 5.1 Strictly Stable APIs Used
- `vscode.ExtensionContext.secrets`: OS-level secure storage (Stable since VS Code 1.53).
- `vscode.workspace.isTrusted`: Workspace Trust security boundary (Stable since VS Code 1.57).
- `vscode.window.createTreeView` & `vscode.TreeDataProvider`: Native sidebar navigation (Stable since VS Code 1.14).
- `vscode.window.createStatusBarItem`: Status indicator (Stable).
- `vscode.window.createOutputChannel`: Diagnostics logging (Stable).
- `vscode.env.clipboard.writeText`: Clipboard export (Stable).
- `vscode.workspace.openTextDocument` with `viewColumn`: Markdown context preview (Stable).

### 5.2 AI & Copilot Integration Strategy (Forward Compatibility)
- **Phase 5B.2 Scope (Stable Baseline)**:
  - Users access context via native commands (`aimemory.copyContext`, `aimemory.previewContext`), which formats markdown perfectly for pasting into GitHub Copilot Chat, ChatGPT, Claude, or Cursor prompts.
- **Future AI Tool APIs (Documented Extension Points)**:
  - `vscode.lm.registerTool`: When VS Code finalizes Language Model Tools, the extension will register `@aimemory_get_context` and `@aimemory_search_memories`.
  - `vscode.chat.createChatParticipant`: Registers `@aimemory` participant in Copilot Chat.

---

## 6. Configuration Schema

Configured via standard VS Code Settings (`settings.json`):

```json
{
  "aimemory.apiUrl": {
    "type": "string",
    "default": "http://localhost:3000",
    "description": "Base URL of the AiMemorySync backend server (e.g. https://api.aimemorysync.com or http://localhost:3000)."
  },
  "aimemory.autoResolve": {
    "type": "boolean",
    "default": true,
    "description": "Automatically discover and resolve project identity when opening a workspace folder."
  },
  "aimemory.contextBudget": {
    "type": "number",
    "default": 8000,
    "minimum": 500,
    "maximum": 64000,
    "description": "Default maximum character budget for assembled AI context."
  },
  "aimemory.enableStatusBar": {
    "type": "boolean",
    "default": true,
    "description": "Show the AiMemorySync project status indicator in the status bar."
  },
  "aimemory.logLevel": {
    "type": "string",
    "enum": ["DEBUG", "INFO", "WARN", "ERROR"],
    "default": "INFO",
    "description": "Logging verbosity written to the AiMemorySync Output Channel."
  }
}
```

> [!CAUTION]
> API keys are **NEVER** exposed as settings keys. Attempting to add an `aimemory.apiKey` configuration property in `package.json` is strictly forbidden.

---

## 7. Security & Privacy Audit

| Security Domain | Mitigation / Enforcement |
| :--- | :--- |
| **Credential Storage** | Handled exclusively via OS-backed `vscode.ExtensionContext.secrets`. Tokens are never written to disk files or settings. |
| **Workspace Trust** | The extension checks `vscode.workspace.isTrusted`. In untrusted workspaces, automatic signal extraction and backend network resolution are paused until the user explicitly trusts the workspace. |
| **Data Leak Prevention** | `OutputChannelLogger` uses structured sanitization by construction: request bodies, authorization headers, and raw memory text are excluded from debug traces. |
| **Path Exposure** | Local filesystem paths (e.g. `C:\Users\Alice\Projects\app`) are never transmitted in discovery signals. Only relative monorepo subpaths (`packages/core`) and standard remote URLs (`github.com/org/repo`) are sent. |
| **Command Injection** | Git signal extraction uses structured argument execution or direct `.git/config` parsing; shell evaluation (`exec`) is strictly forbidden. |

---

## 8. Testing Strategy

### 8.1 Unit Testing (`packages/vscode-extension/test/`)
- **Discovery Provider**: Test signal extraction across simulated Git repos, monorepo subprojects, standalone folders, and package manifest fixtures (`package.json`, `Cargo.toml`).
- **SecretStorage Adapter**: Test token storage, retrieval, and removal against a mocked `vscode.SecretStorage`.
- **Workspace Lifecycle**: Test debounce timing, in-flight request cancellation, and active project caching.
- **Tree Providers**: Test hierarchy generation, badge formatting, and empty states.

### 8.2 Integration Testing (Mocked SDK Transport)
- Simulate full workspace open &rarr; signal extraction &rarr; project resolution &rarr; context assembly &rarr; TreeView update.
- Simulate HTTP 401 &rarr; `auth:unauthorized` event &rarr; status bar updates to Disconnected &rarr; user enters key &rarr; automatic reconnection.
- Simulate HTTP 429 &rarr; `rate-limit:exceeded` event &rarr; status bar displays retry countdown.

### 8.3 Manual Verification in VS Code Extension Host
1. **Scenario 1: Clean Installation & Setup**:
   - Launch Extension Development Host (`F5`).
   - Verify Status Bar shows `$(circle-slash) AiMemory`.
   - Run `AiMemory: Set API Key`, paste key, verify instant connection.
2. **Scenario 2: Automatic Git Project Resolution**:
   - Open `AiMemorySync` workspace in Extension Host.
   - Verify Project View resolves to `aimemorysync` (`GIT_REMOTE`, Confidence: 100%).
   - Verify Memories View displays all active decisions and conventions.
3. **Scenario 3: Context Copy & Preview**:
   - Run `AiMemory: Copy Project Context`. Paste into an editor; verify formatted Markdown with header, conventions, and decisions.
   - Run `AiMemory: Preview Project Context`. Verify read-only Markdown preview opens.
4. **Scenario 4: Interactive Memory Creation & Modification**:
   - Click `+` on Memories View, input type, title, and content via QuickPick/InputBox.
   - Verify memory immediately appears in TreeView and Web Dashboard.

---

## 9. Implementation Sequence

```text
Step 1: Workspace & Package Scaffolding
  ├── Add packages/vscode-extension to root workspaces
  ├── Create package.json with commands, views, and configuration points
  ├── Create tsconfig.json and tsup.config.ts (ESM/CJS bundling)
  └── Create launch.json for VS Code Extension Host debugging (F5)

Step 2: Adapters & Client Initialization
  ├── Implement VSCodeSecretStorageAdapter
  ├── Implement OutputChannelLogger (safe logging)
  └── Implement ClientFactory singleton

Step 3: Signal Extraction & Lifecycle Service
  ├── Implement Git & Package Manifest detector
  ├── Implement WorkspaceLifecycleService (debounce + deduplication)
  └── Implement WorkspaceTrustGuard

Step 4: Tree View Providers & Status Bar
  ├── Implement ProjectsTreeDataProvider
  ├── Implement MemoriesTreeDataProvider
  ├── Implement ContextTreeDataProvider
  └── Implement StatusBarManager

Step 5: Commands & User Interactions
  ├── Implement Auth commands (Set API Key, Remove API Key, Check Connection)
  ├── Implement Project commands (Resolve, Copy Context, Preview Context, Open Dashboard)
  └── Implement Memory commands (Add, Edit, Deprecate, Archive, Refresh)

Step 6: Automated Testing & Verification
  ├── Author unit tests in packages/vscode-extension/test/
  ├── Run build, test, lint, and typecheck across entire monorepo
  └── Execute manual test scenarios in VS Code Extension Host
```

---

## 10. Risk Register & Mitigation

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **High startup CPU / slow activation** | Medium | Use `onStartupFinished` and lazy-load client instances. Never perform synchronous disk I/O in the activation path. |
| **Git API extension unavailability** | Low | Implement fallback `.git/config` parser so Git signals are resolved even if the built-in VS Code Git extension is disabled. |
| **Multi-root workspace confusion** | Medium | Scope resolution per `WorkspaceFolder` and maintain an active folder switch listener (`vscode.window.onDidChangeActiveTextEditor`). |
| **SecretStorage unavailability (e.g. headless Linux)** | Low | Catch secret storage failures and present clear diagnostic instructions to the developer. |
| **API rate limiting during rapid folder switching** | Medium | Strict 400ms debounce on workspace changes + in-flight Promise reuse. |
