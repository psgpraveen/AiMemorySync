# AiMemorySync

> **Universal, Deterministic AI Memory & Context Synchronization Engine**  
> Architected, Designed & Developed by **[PSG Praveen](https://github.com/psgpraveen)** (`@psgpraveen`).

---

## 🌟 Overview

**AiMemorySync** bridges AI developer workflows across diverse IDEs and platforms (**Antigravity**, **VS Code**, **Cursor**, **Claude Desktop**, and **ChatGPT**). It provides persistent, centralized project memory with deterministic workspace resolution, token-budgeted markdown context assembly, and an isolated Model Context Protocol (MCP) server.

### Key Capabilities

- **Deterministic Identity Resolution**: Maps active workspaces to canonical project identities using a 3-tier algorithm:
  1. Git remote origin URL hash (stripping authentication credentials)
  2. Workspace package manifest name/digest (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`)
  3. Workspace tree SHA-256 digest fallback
- **Universal MCP Server**: Compliant with standard Model Context Protocol over `stdio`, featuring zero direct database access, pre-flight anti-poisoning credential redaction, and strict Bearer authentication.
- **Context Budget Packing**: Dynamically synthesizes and prioritizes project conventions, architectural decisions, specifications, and bug fixes into token-bounded markdown context blocks.
- **Zero-Trust Security**: Uses SHA-256 hashed API tokens (`aimem_live_...`), least-privilege scopes (`read`, `write`, `admin`), and zero-leakage diagnostic loggers.

---

## 🏗️ Architecture & Monorepo Structure

```
AiMemorySync/
├── packages/
│   ├── client-core/         # Platform-independent TypeScript client SDK
│   ├── mcp-server/          # Stdio-based Universal Model Context Protocol server
│   └── vscode-extension/    # Native VS Code & Antigravity Activity Bar extension
├── src/
│   ├── app/                 # Next.js 16 App Router web dashboard & REST API
│   │   ├── (api)/api/       # Secure REST endpoints for auth, projects, & memories
│   │   ├── projects/        # Project & Memory management UI
│   │   ├── integrations/    # Integrations directory & 6-step guided wizard
│   │   ├── settings/        # API key generation & revocation management
│   │   └── login/           # Bearer token connection & dev bootstrapper
│   ├── components/          # Reusable Tailwind CSS UI components
│   └── services/            # Core backend business logic & Prisma ORM repositories
└── prisma/                  # PostgreSQL schema and relational models
```

---

## 🚀 Quick Start

### 1. Requirements

- Node.js >= 18.x
- PostgreSQL database
- npm / npx

### 2. Installation & Setup

```bash
# Clone the repository
git clone https://github.com/psgpraveen/AiMemorySync.git
cd AiMemorySync

# Install dependencies across all monorepo packages
npm install

# Run database migrations
npx prisma migrate dev

# Generate initial developer API key
npm run key:generate

# Start development server
npm run dev
```

The web dashboard will be accessible at `http://localhost:3000`.

---

## 🔌 Integrating with Antigravity / Cursor / VS Code

### Option A: VS Code Extension

1. Package the extension:
   ```bash
   npm run --workspace=aimemory-vscode package
   ```
2. Install the `.vsix` file in VS Code or Antigravity via **Extensions > Install from VSIX...**
3. Configure your API key using the command: `AiMemory: Set API Key`.

### Option B: Antigravity MCP Plugin

Add to `.agents/mcp_config.json`:

```json
{
  "mcpServers": {
    "aimemory": {
      "command": "npx",
      "args": ["-y", "@aimemory/mcp-server"],
      "env": {
        "AIMEMORY_API_URL": "http://localhost:3000",
        "AIMEMORY_API_KEY": "aimem_live_your_secret_key"
      }
    }
  }
}
```

---

## 👨‍💻 Author & Ownership

- **Lead Architect & Author**: **PSG Praveen**
- **GitHub**: [@psgpraveen](https://github.com/psgpraveen)
- **Project**: AiMemorySync Universal AI Memory Engine

---

## 📄 License

This project is licensed under the MIT License.
