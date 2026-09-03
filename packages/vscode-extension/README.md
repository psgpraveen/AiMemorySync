# AiMemorySync VS Code Extension

Automatic AI project memory for VS Code. AiMemorySync automatically detects your project identity, fetches relevant decisions, conventions, requirements, and solutions, and lets you manage memories directly from your editor.

---

## Features

- **Zero-Config Project Identity**: Automatically resolves project canonical identity using Git remotes, monorepo subpaths, and package manifests.
- **Assembled Context on Demand**: Generate deterministic, character-budgeted Markdown AI context ready for your prompt or clipboard.
- **In-Editor Memory Management**: Create, edit, deprecate, or soft-archive project decisions and bug solutions without leaving your workflow.
- **Enterprise-Grade Security**: API keys are stored exclusively in your operating system's keychain via VS Code `SecretStorage`. Zero plaintext secrets in workspace files.
- **Workspace Trust Enforcement**: Automatically honors VS Code Restricted Mode — background network calls and discovery remain disabled until you trust the workspace.
- **Resilient & Offline-Ready**: In-memory TTL caching, exponential backoff retries, and rate limit countdown indicators.

---

## Getting Started

1. **Install the Extension**: Install from the VS Code Marketplace or from the `.vsix` package.
2. **Connect your API Key**:
   - Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
   - Run `AiMemory: Connect / Set API Key`.
   - Paste your API key (starts with `aimem_live_`).
3. **Open a Project**:
   - The status bar in the bottom right will show your connected project name.
   - Click the **AiMemory** icon in the Activity Bar to view project details, memory items, and assembled context.

---

## Extension Views

- **Project Identity**: Shows current project name, slug, match method (`GIT_REMOTE`, `PACKAGE_MANIFEST`, etc.), and match confidence.
- **Project Memories**: Categorized tree view of all active memories (`DECISION`, `REQUIREMENT`, `CONVENTION`, `BUG_SOLUTION`) with priority badges.
- **Context Preview**: Visual character budget indicator and quick actions to copy or preview assembled Markdown context.

---

## Commands

| Command | Description |
|---|---|
| `AiMemory: Connect / Set API Key` | Stores your API key securely in VS Code SecretStorage |
| `AiMemory: Disconnect / Remove API Key` | Removes stored credentials and disconnects |
| `AiMemory: Check API Connection` | Validates API connectivity with the AiMemorySync server |
| `AiMemory: Resolve Current Project` | Manually forces project resolution for the active workspace |
| `AiMemory: Copy Project Context to Clipboard` | Assembles AI context and copies Markdown to clipboard |
| `AiMemory: Preview Project Context (Markdown)` | Opens an in-editor virtual preview of assembled context |
| `AiMemory: Add Memory to Current Project` | Creates a new structured memory item |
| `AiMemory: Refresh All Project Data` | Clears local cache and re-fetches project details and memories |

---

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `aimemory.apiUrl` | `http://localhost:3000` | Base URL of the AiMemorySync backend service |
| `aimemory.autoResolve` | `true` | Automatically resolve projects when switching folders |
| `aimemory.contextBudget` | `8000` | Default character budget for assembled context |
| `aimemory.enableStatusBar` | `true` | Show project status in the status bar |
| `aimemory.logLevel` | `INFO` | Output channel verbosity (`DEBUG`, `INFO`, `WARN`, `ERROR`) |

---

## License

MIT
