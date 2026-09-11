# AiMemorySync

<div align="center">

![AiMemorySync Logo](public/images/logo.png)

### Universal, Deterministic AI Memory & Context Synchronization Engine
*Architected, Designed & Developed by **[PSG Praveen](https://github.com/psgpraveen)** (`@psgpraveen`)*

[![CI Quality Gates](https://github.com/psgpraveen/AiMemorySync/actions/workflows/ci.yml/badge.svg)](https://github.com/psgpraveen/AiMemorySync/actions)
[![Extension Release](https://github.com/psgpraveen/AiMemorySync/actions/workflows/extension-release.yml/badge.svg)](https://github.com/psgpraveen/AiMemorySync/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node: >=18.0.0](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript: 5](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js: 16](https://img.shields.io/badge/Next.js-16.3.4-black.svg)](https://nextjs.org/)

</div>

---

## 🌟 Executive Overview

**AiMemorySync** is an ecosystem-agnostic, deterministic memory and context synchronization system for AI-assisted software engineering. It bridges AI coding agents and IDEs—including **Antigravity IDE**, **VS Code**, **Cursor**, **Claude Desktop**, and **ChatGPT**—by maintaining a single, persistent source of truth for architectural decisions, requirements, conventions, and bug solutions.

### The Problem
Modern AI coding assistants operate in conversational silos. When a new session begins or an engineer switches from Antigravity to VS Code or Cursor, the AI loses architectural context, re-suggests previously rejected patterns, and repeats known errors.

### The Solution
AiMemorySync introduces:
1. **Deterministic Workspace Discovery**: Zero-configuration project mapping using Git remote hashing, manifest parsing, and workspace tree digests.
2. **Dynamic Context Assembly**: Token- and character-budgeted Markdown context generation prioritizing critical decisions and conventions.
3. **Universal MCP Server**: Standard Model Context Protocol (over `stdio`) enabling seamless integration into any MCP-compliant AI client.
4. **Native VS Code & Antigravity Extension**: Real-time project identity resolution, memory exploration, and live context previews directly in the Activity Bar.
5. **Zero-Trust Security**: SHA-256 hashed Bearer API tokens, pre-flight anti-poisoning scans, and strict least-privilege scoping (`read`, `write`, `admin`).

---

## 🏗️ Monorepo Architecture

AiMemorySync is organized as an npm monorepo with strict isolation between packages:

```
AiMemorySync/
├── packages/
│   ├── client-core/         # Zero-dependency TypeScript SDK (@aimemory/client-core)
│   ├── mcp-server/          # Stdio Universal MCP Server (@aimemory/mcp-server)
│   └── vscode-extension/    # VS Code & Antigravity IDE Extension (aimemory-vscode)
├── src/                     # Next.js 16 App Router web application & REST API
│   ├── app/                 # Web dashboard, onboarding wizard, & REST endpoints
│   ├── components/          # Reusable UI design system (Clean White & Radiant Mesh)
│   ├── lib/                 # Core utilities, API client, normalizers & auth guards
│   └── services/            # Domain services & PostgreSQL Prisma data repositories
├── prisma/                  # Relational schema, migrations & PostgreSQL client
├── docs/                    # Architectural specs, security blueprints & phase reports
└── .github/workflows/       # Automated CI testing and Extension release workflows
```

### Monorepo Workspaces & Responsibilities

| Package | Responsibility | Dependencies | Runtime |
| :--- | :--- | :--- | :--- |
| **`@aimemory/client-core`** | Isomorphic TypeScript client SDK with event emission, retry logic, and error hierarchy. | Zero runtime dependencies | Node.js & Browser (ESM + CJS) |
| **`@aimemory/mcp-server`** | Stdio-based MCP server bridging AI agents to AiMemorySync via standard JSON-RPC. | `@aimemory/client-core`, `@modelcontextprotocol/sdk` | Node.js (`stdio`) |
| **`aimemory-vscode`** | Native Activity Bar extension for Antigravity IDE and VS Code with OS SecretStorage. | `@aimemory/client-core`, `vscode` | VS Code Extension Host |
| **`src/` (Root App)** | Next.js 16 dashboard, guided onboarding wizard, and REST API routes. | React 19, Tailwind CSS v4, Prisma ORM | Node.js (App Router) |

---

## 🗺️ Project Roadmap & Phase Status

| Phase | Description | Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1-4** | Core Platform Engine | REST API, PostgreSQL schema, context packing, Prisma models | **Completed** |
| **Phase 5A** | Project Discovery Engine | 3-tier deterministic workspace resolution algorithm | **Completed** |
| **Phase 5B.0** | Auth & Token Security | SHA-256 hashed API keys, scoped permissions, rate limiting | **Completed** |
| **Phase 5B.1** | Client Core SDK | Isomorphic TypeScript SDK with event-driven architecture | **Completed** |
| **Phase 5B.2** | VS Code Extension | Activity bar views, status bar manager, OS SecretStorage | **Completed** |
| **Phase 5B.3** | E2E Runtime Validation | 26 unit & integration tests against live backend | **Completed** |
| **Phase 5C.0** | Real-World Pilot Audit | End-to-end multi-workspace identity and credential verification | **Completed** |
| **Phase 5C.1** | Universal MCP Server | Stdio MCP server, anti-poisoning guardrails, Antigravity plugin | **Completed** |
| **Phase 5C.2** | Integration Onboarding UI | Guided 6-step wizard, one-time token reveal, connection test | **Completed** |
| **Phase 5C.3** | Extension Release & CI/CD | SemVer scripts, pre-flight quality gates, Open VSX packaging | **Completed** |
| **Phase 6** | Extended Platform Rollout | Cursor IDE integration, JetBrains plugin, Claude Desktop bundle | *Upcoming* |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: `>= 18.0.0`
- **PostgreSQL**: PostgreSQL database (or hosted instance on Supabase)
- **npm**: `>= 9.0.0`

### 2. Clone & Install
```bash
git clone https://github.com/psgpraveen/AiMemorySync.git
cd AiMemorySync

# Install dependencies across all monorepo workspaces
npm install
```

### 3. Configure Environment
Create a `.env` file in the root directory (based on `.env.example`):
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/aimemorysync"
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Database Setup & Initial Key Generation
```bash
# Run Prisma migrations
npm run db:migrate

# Generate an initial developer Bearer API key
npm run key:generate
```

### 5. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to access the Web Dashboard.

---

## 🛠️ Monorepo Orchestration Commands

All packages can be tested, linted, and built from the repository root:

| Command | Purpose |
| :--- | :--- |
| **`npm run dev`** | Start Next.js development server with Turbopack |
| **`npm run build:all`** | Build SDK, MCP server, VS Code extension, and Next.js web application |
| **`npm run typecheck:all`** | Run TypeScript typechecking across root and all packages (`tsc --noEmit`) |
| **`npm run test:all`** | Run all 71 unit & integration tests across the entire monorepo |
| **`npm run lint`** | Run ESLint across web application and core sources |
| **`npm run package:extension`** | Run quality gates (typecheck, lint, 26 tests) and package versioned VSIX |
| **`npm run version:extension:patch`** | Increment extension patch version (`0.1.x`) and sync workspace metadata |
| **`npm run db:migrate`** | Apply Prisma schema migrations to the database |
| **`npm run db:studio`** | Launch visual Prisma Studio database manager |

---

## 🔌 IDE & Platform Integrations

### A. Antigravity IDE & VS Code Extension
The `aimemory-vscode` extension runs natively in Antigravity IDE and VS Code:
1. **Package or Download**:
   ```bash
   npm run package:extension
   ```
2. **Install**:
   - In Antigravity/VS Code: `Ctrl+Shift+P` &rarr; `Extensions: Install from VSIX...`
   - Select `packages/vscode-extension/releases/aimemory-vscode-0.1.2.vsix`
3. **Connect**:
   - Run `Ctrl+Shift+P` &rarr; `AiMemory: Set API Key`
   - Enter your Bearer token (`aimem_live_...`)
   - Your active workspace is resolved automatically with real-time status bar updates (`✓ AiMemory: <project>`).

### B. Universal Model Context Protocol (MCP) Server
For Claude Desktop, Cursor, Antigravity AI, or ChatGPT:
Add the server to your MCP configuration file (`mcp_config.json`):
```json
{
  "mcpServers": {
    "aimemory": {
      "command": "npx",
      "args": ["-y", "@aimemory/mcp-server"],
      "env": {
        "AIMEMORY_API_URL": "http://localhost:3000",
        "AIMEMORY_API_KEY": "aimem_live_your_token_here"
      }
    }
  }
}
```

#### Available MCP Tools
- `aimemory_resolve_project`: Resolves workspace identity without exposing local machine paths.
- `aimemory_get_current_project`: Returns the project active in the current session.
- `aimemory_get_context`: Formats token-bounded Markdown AI context blocks.
- `aimemory_create_memory`: Persists decisions, requirements, or conventions with anti-poisoning credential redaction.
- `aimemory_list_memories`: Lists project memories with status/type filtering.
- `aimemory_deprecate_memory`: Soft-deprecates superseded decisions.

---

## 🎨 UI Design System

Designed by lead architect **PSG Praveen**, the AiMemorySync interface follows a **Clean Pure White & Radiant Ambient Mesh** design philosophy:
- **Canvas**: Pure crisp white (`#ffffff` / `bg-slate-50/50`) eliminating gloomy dark containers.
- **Accents**: Subtle radiant ambient gradients in indigo (`#4f46e5`), violet (`#7c3aed`), and sky blue (`#0284c7`).
- **Typography**: Clean, high-legibility geometric sans-serif font stack.
- **Micro-Interactions**: Smooth 150ms hover transitions, active ring glows, and intuitive empty states.

---

## 🔒 Security & Anti-Poisoning Architecture

- **Token Storage**: Plaintext API tokens are displayed **only once** upon generation. The database stores strictly SHA-256 cryptographic hashes.
- **Credential Redaction**: Outgoing and incoming memory captures are processed through targeted regex scrubbers to prevent secret leakage (`aimem_live_*`, `aimem_test_*`, AWS/GitHub keys, Bearer tokens).
- **Process Isolation**: The MCP server strictly isolates `process.stdout` for JSON-RPC messages and routes all diagnostics to `process.stderr`.
- **Git Protection**: Local agent memories (`.antigravity/`), runtime credentials, and temporary test scripts are strictly excluded from version control via `.gitignore`.

---

## 👨‍💻 Author & Lead Architect

**PSG Praveen**  
- **GitHub**: [@psgpraveen](https://github.com/psgpraveen)  
- **Repository**: [https://github.com/psgpraveen/AiMemorySync](https://github.com/psgpraveen/AiMemorySync)  
- **Role**: Lead Architect, System Designer & Full-Stack Engineer  

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
