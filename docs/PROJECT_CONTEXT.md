# Project Context: AiMemorySync

## Project Name
AiMemorySync

## Project Vision
AiMemorySync is designed as a shared AI memory and context synchronization system. The long-term vision is to allow disparate AI platforms and coding agents (e.g., ChatGPT, Antigravity IDE, specialized coding agents) to share structured project context and persistent memory seamlessly.

High-level future ecosystem:
```text
ChatGPT
    ↕
AiMemorySync
    ↕
Shared Project Memory
    ↕
Antigravity IDE / Coding Agents
```

Future anticipated capabilities (planned for later phases; not implemented in Phase 1):
- Persistent AI conversation memory
- Shared project memory
- Structured memory extraction
- Semantic memory search
- AI platform connectors
- Browser extension
- Context synchronization
- Remote coding and PC control

## Current Phase
**Phase 5B.1 — Client Core SDK (`@aimemory/client-core`) (Completed & Verified)**
Implemented and verified the zero-dependency, platform-independent Client Core SDK:
- **Package**: `@aimemory/client-core` located in `packages/client-core/`.
- **Target Platforms**: VS Code extension, Cursor, Antigravity, browser extensions, CLI tools, and AI platform integrations.
- **Runtime Dependencies**: Zero (0) production runtime dependencies; builds to dual ESM (`dist/index.mjs`), CJS (`dist/index.cjs`), and TypeScript declarations (`dist/index.d.ts`).
- **Core Capabilities**: Pluggable adapters (`SecureStorageAdapter`, `CacheAdapter`, `LoggerAdapter`), resilient HTTP transport with exponential backoff and jitter on safe GET requests, typed error hierarchy, typed event emitter with colon-separated lowercase events, and domain modules (`auth`, `projects`, `memories`, `context`).
- **Verification**: 23 automated SDK unit/integration tests passing (100%), full root TypeScript checks passing, ESLint passing, and Next.js production build passing.


## Current Technology Stack
- **Framework**: Next.js 16.3.4 (App Router, Turbopack)
- **UI Library**: React 19.2.8
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL (Supabase managed hosting)
- **ORM**: Prisma ORM 6.4.1
- **Validation**: Zod 4
- **Linter**: ESLint 9
- **Compiler**: React Compiler (`babel-plugin-react-compiler`)
- **Package Manager**: npm
- **Import Alias**: `@/*` mapping to `./src/*`

## Long-Term Architecture Direction
- **Modular App Architecture**: Clear separation of concerns between UI components (`components/`), shared business logic (`lib/`), state/custom hooks (`hooks/`), shared models/contracts (`types/`), and configurations (`config/`).
- **Extensible Connectors**: Pluggable architecture for external AI platform adapters in future phases.
- **Data Integrity & Consistency**: Strict adherence to minimum-change principles, preserving working functionality and avoiding redundant abstractions.

## Development Principles
1. **Consistency First**: Prefer understanding existing patterns, reusing established conventions, and extending existing implementations over rewriting code.
2. **Minimum Change Principle**: Scope every change to the minimum necessary modification to satisfy the requirement. Avoid speculative optimizations or unrequested refactoring.
3. **Repository as Source of Truth**: Implementation claims must always be verified against active repository code, tests, and build artifacts.
4. **Verification Discipline**: Tasks are only complete when verified through linting, type-checking, builds, and runtime validation.
