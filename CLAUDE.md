# CLAUDE.md — Developer & AI Assistant Guidelines

> **AiMemorySync Monorepo**  
> Architected, Designed & Developed by **PSG Praveen** (`@psgpraveen`).

---

## 🏗️ Monorepo Workspaces

- **Root (`/`)**: Next.js 16.3.4 (App Router, Turbopack, React 19, Tailwind CSS v4, Prisma ORM 6.4.1).
- **`packages/client-core`**: Isomorphic TypeScript SDK with zero runtime dependencies.
- **`packages/mcp-server`**: Universal Model Context Protocol server over `stdio`.
- **`packages/vscode-extension`**: VS Code & Antigravity IDE Activity Bar extension.

---

## ⚡ Essential Commands

```bash
# Development
npm run dev                          # Start Next.js web application (Turbopack)
npm run db:migrate                   # Run Prisma database migrations
npm run db:studio                    # Open Prisma Studio GUI
npm run key:generate                 # Generate initial developer API key

# Verification & Quality Gates
npm run typecheck:all                # Typecheck root + all 3 packages
npm run test:all                     # Run all 71 unit & integration tests
npm run lint                         # Run ESLint (0 errors, 0 warnings policy)

# Builds & Releases
npm run build:all                    # Compile SDK, MCP server, extension & web app
npm run package:extension            # Run quality gates and package versioned VSIX
npm run version:extension:patch      # Bump extension patch version (0.1.x)
```

---

## 🛡️ Critical Architecture & Engineering Rules

1. **Client Isolation & Zero Direct DB Access**:
   - `packages/client-core`, `packages/mcp-server`, and `packages/vscode-extension` must **never** import Prisma or connect to PostgreSQL directly.
   - All client communication must flow through the authenticated REST API (`http://localhost:3000/api`).

2. **Stdio Protocol Hygiene**:
   - In `packages/mcp-server`, `process.stdout` is dedicated **100%** to JSON-RPC message framing.
   - Never use `console.log()` inside MCP server modules. All diagnostics, traces, and errors must write to `process.stderr`.

3. **Extension Auto-Update & Packaging Strategy**:
   - Do **NOT** build a custom extension self-updater.
   - Do **NOT** download and replace extension files manually at runtime.
   - Use the native Open VSX / VS Code Marketplace auto-update mechanism or VSIX installation.
   - Releases are generated to `packages/vscode-extension/releases/aimemory-vscode-<version>.vsix`.

4. **UI Design System**:
   - Canvas: Clean pure white (`#ffffff` / `bg-slate-50/50`) with subtle radiant gradient mesh (indigo, violet, sky-blue accents) designed by lead architect PSG Praveen.
   - Avoid forced dark themes. Maintain clean contrast, accessible focus rings, and responsive layouts.

5. **Security & Anti-Poisoning**:
   - Plaintext tokens (`aimem_live_...`) are revealed only once upon creation.
   - Database stores strictly SHA-256 hashes.
   - Pre-flight anti-poisoning scans redact credential patterns before persisting memories.
   - Never commit secrets, `.env*`, `.antigravity/`, or temporary scripts in `scratch/`.
