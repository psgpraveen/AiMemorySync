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
**Phase 5B.0 — API Authentication & Client Security Foundation (Completed)**
The authentication and security layer has been implemented and verified across all REST endpoints:
- **Cryptographic API Keys**: Generated 256-bit entropy keys (`aimem_live_...` and `aimem_test_...`) with scanner-detectable prefixes and SHA-256 storage at rest. Plaintext keys are shown strictly once.
- **Database Schema**: Additive `ApiKey` Prisma model with `keyHash` unique index and migration `20260903103353_add_api_keys_and_auth` applied to Supabase PostgreSQL.
- **Centralized Route Guard**: Implemented `requireAuth()` in `src/lib/api/auth-guard.ts` enforcing Bearer token authentication, scope authorization (`read`, `write`, `admin`), and rate limiting across all `/api/projects/*`, `/api/memories/*`, and `/api/auth/*` endpoints.
- **In-Memory Rate Limiter**: Built sliding-window rate limiter in `src/lib/api/rate-limiter.ts` throttling burst requests with standard rate limit headers.
- **Key Management & CLI**: Created admin endpoints (`GET/POST /api/auth/keys`, `POST /api/auth/keys/:id/revoke`) and developer CLI tool `npm run key:generate` (`scripts/generate-api-key.ts`).
- **Verification**: Complete automated security test suite passed (unauthenticated rejection 401, malformed token rejection, non-existent key rejection, scope enforcement 403, instant revocation 401, expiration 401, rate limiting 429, and database cleanup with 0 residuals). Static quality checks: `npx prisma validate` (0), `npm run lint` (0), `npx tsc --noEmit` (0), `npm run build` (0).

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
