# Phase 5A Implementation Plan: Automatic Project Discovery & Identity Resolution

## 1. Executive Summary & Core Objective

### 1.1 Product Paradigm Shift
AiMemorySync is fundamentally designed around **automatic project detection and context resolution**. Users working across IDEs (VS Code, Cursor, Antigravity), browser extensions, and conversational AI platforms (ChatGPT, Claude) must not be forced into manual project management workflows.

```text
========================================================================================
PRIMARY PRODUCTION WORKFLOW:
Platform Activity Detected ──> Extract Signals ──> POST /api/projects/resolve ──> Auto Attach / Provision
FALLBACK & INSPECTION WORKFLOW:
Web Dashboard ──> Inspect Discovered Projects, Identities, Sources, Memories, and Manual Creation
========================================================================================
```

### 1.2 Phase 5A Scope Boundary
- **Included**:
  - Implementation of deterministic normalization for Git remotes, package manifests, and workspace digests.
  - Non-destructive database schema extension: `ProjectIdentity` and `ProjectSource` models with strict uniqueness constraints.
  - Creation of the `ProjectIdentityService` for multi-tier confidence resolution.
  - Implementation of `POST /api/projects/resolve` with Zod schema validation, transactional auto-creation, and concurrency race-condition recovery.
  - Full backward compatibility with existing Phase 3 & 4 APIs, services, and web dashboard.
- **Explicitly Excluded**:
  - Building external IDE extensions or browser extension frontends (scheduled for Phase 5B / 5C).
  - External authentication, users, or multi-tenant workspaces.
  - Destructive database migrations or changes to existing `Memory` content hashing.

---

## 2. Current Codebase Audit & Gap Analysis

### 2.1 Current Implementation State
- **Prisma Schema (`prisma/schema.prisma`)**:
  - `Project`: `id` (UUID PK), `name` (VarChar 100), `slug` (VarChar 100 UNIQUE), `description` (Text nullable), `status` (Enum ACTIVE/ARCHIVED), timestamps.
  - `Memory`: `id` (UUID PK), `projectId` (UUID FK), `type`, `title`, `content`, `priority`, `contentHash`, `status`, timestamps.
- **Services**:
  - `project.service.ts`: Queries only by `id` or `slug`. `createProject` derives `slug` from `name` and throws `PROJECT_SLUG_CONFLICT` on collision.
  - `memory.service.ts`: Scopes duplicate detection strictly to `(projectId, contentHash)`.
  - `context.service.ts`: Generates deterministic Markdown context strictly by `projectId`.
- **API Routes**:
  - `/api/projects`: `GET`, `POST`.
  - `/api/projects/[id]`: `GET`, `PATCH`, `DELETE`.
  - `/api/projects/[id]/memories`: `GET`, `POST`.
  - `/api/projects/[id]/context`: `GET`.
  - `/api/memories/[id]`: `GET`, `PATCH`, `DELETE`.
  - `/api/memories/[id]/deprecate`: `POST`.

### 2.2 Architectural Gaps
1. **No Normalized Identity Anchors**: Cannot correlate different machines/paths sharing the same Git repository (`D:\Freelance\AiMemorySync` vs `C:\Projects\AiMemorySync`).
2. **Slug Collision on Auto-Discovery**: If two different repositories derive the same name (e.g. `"backend"`), auto-creation would fail with a 409 slug conflict.
3. **No Platform Tracking**: Cannot identify which IDE or tool last accessed or bound to a project.
4. **No Multi-Signal Disambiguation**: Monorepos and non-git projects lack secondary identity anchors.

---

## 3. Multi-Tier Identity Resolution Model

AiMemorySync adopts an extensible 4-tier confidence hierarchy:

| Tier | Identity Type | Confidence Score | Source Signals | Example Canonical Value |
| :---: | :--- | :---: | :--- | :--- |
| **Tier 1** | `GIT_REMOTE` | **100** | Git origin/upstream remote URL | `github.com/antigravityteam/aimemorysync` |
| **Tier 1B** | `MONOREPO_SUBPROJECT` | **95** | Git remote URL + root-relative subpath | `github.com/org/mono#packages/frontend` |
| **Tier 2** | `PACKAGE_MANIFEST` | **80** | Package ecosystem + normalized package name | `pkg:npm/@company/payment-service` |
| **Tier 3** | `WORKSPACE_DIGEST` | **50** | SHA-256 of canonical workspace root name + client ID | `ws:3a7b9e1c4f2d...` (privacy preserved) |
| **Tier 4** | `PLATFORM_SESSION` | **30** | Platform type + external session/project ID | `platform:chatgpt:conv_abc123` |

---

## 4. Deterministic Normalization & Hashing Algorithms

### 4.1 Git Remote Normalization (`normalizeGitRemote`)
Remotes arrive in diverse syntaxes (SSH, HTTPS, SCP-like, custom ports, credentials). The normalization engine must deterministically convert all variations of the same repository into a single canonical string:

```text
INPUT EXAMPLES:
1. git@github.com:AntigravityTeam/AiMemorySync.git
2. https://github.com/AntigravityTeam/AiMemorySync.git
3. https://oauth2:ghp_secretToken999@github.com/AntigravityTeam/AiMemorySync.git/
4. ssh://git@gitlab.company.com:2222/core-team/aimemorysync.git
5. git@github.com:antigravityteam/aimemorysync

NORMALIZATION RULES:
1. Strip embedded basic-auth credentials: /https?:\/\/[^@]+@/ -> ''
2. Strip protocol prefixes: /^(https?|ssh|git):\/\// -> ''
3. Normalize SCP syntax: /^[^@]+@([a-zA-Z0-9.-]+):/ -> '$1/'
4. Strip port numbers: /:(\d+)\// -> '/'
5. Strip trailing '.git' suffix and trailing slashes: /\.git\/?$/ -> ''
6. Lowercase hostname and repository path: /^[a-z0-9.-]+\/[a-z0-9._\-\/]+/
7. Compute SHA-256 hex digest: SHA-256(canonicalString)
```

### 4.2 Package Manifest Normalization (`normalizeManifestIdentity`)
- Standard format: `pkg:<ecosystem>:<packageName>` (e.g. `pkg:npm:@aimemory/core`, `pkg:cargo:aimemory-engine`, `pkg:pypi:aimemorysync`, `pkg:go:github.com/org/repo`).
- Lowercase ecosystem and package name, collapse whitespace.

### 4.3 Workspace Fallback (`normalizeWorkspaceDigest`)
- Never store raw user filesystem paths (`/Users/alice/SecretClient/Repo`) in the identity table.
- Canonical string: `ws:<clientId>:<normalizedFolderName>:<sha256(normalizedPath)>`
- Ensures distinct local scratchpads on the same machine resolve cleanly while preserving path confidentiality.

---

## 5. Intelligent Project Name & Non-Colliding Slug Derivation

When an identity resolves to a **new** project, its display name and URL slug must be generated intelligently without throwing collisions:

### 5.1 Name Priority
1. `packageManifest.name` (e.g. `@company/payment-service` &rarr; `"payment-service"`)
2. `gitRemote` repository name (e.g. `github.com/org/ai-memory-sync` &rarr; `"ai-memory-sync"`)
3. `workspaceName` signal (e.g. `"AiMemorySync"`)
4. `platformSession.title` (e.g. `"Refactoring Database Migration"`)
5. Fallback: `"Discovered Project"`

### 5.2 Non-Colliding Slug Generation
Unlike manual creation where slug collisions produce an error, automatic discovery must **never fail due to a slug collision**:
- Base slug: `normalizeSlug(derivedName)`
- If `baseSlug` already exists in `projects`, check `projects` for existing slugs starting with `${baseSlug}-` and append the next sequential integer (e.g. `aimemorysync-2`, `aimemorysync-3`).

---

## 6. Proposed Database Schema Evolution

### 6.1 Additive Schema Changes in `prisma/schema.prisma`

```prisma
enum ProjectIdentityType {
  GIT_REMOTE
  MONOREPO_SUBPROJECT
  PACKAGE_MANIFEST
  WORKSPACE_DIGEST
  PLATFORM_SESSION
}

model Project {
  id              String            @id @default(uuid())
  name            String            @db.VarChar(100)
  slug            String            @unique @db.VarChar(100)
  description     String?           @db.Text
  status          ProjectStatus     @default(ACTIVE)
  creationSource  String            @default("MANUAL") @db.VarChar(50)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  memories        Memory[]
  identities      ProjectIdentity[]
  sources         ProjectSource[]

  @@map("projects")
}

model ProjectIdentity {
  id             String              @id @default(uuid())
  projectId      String
  type           ProjectIdentityType
  value          String              @db.Text
  identityHash   String              @db.Char(64)
  isPrimary      Boolean             @default(false)
  confidence     Int                 @default(100)
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  project        Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([type, identityHash])
  @@index([projectId])
  @@index([type, identityHash])
  @@map("project_identities")
}

model ProjectSource {
  id              String    @id @default(uuid())
  projectId       String
  platform        String    @db.VarChar(50)
  externalId      String?   @db.VarChar(255)
  localPathDigest String?   @db.Char(64)
  metadata        Json?
  lastSeenAt      DateTime  @default(now())
  createdAt       DateTime  @default(now())

  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([platform, externalId])
  @@map("project_sources")
}
```

### 6.2 Migration & Rollback Strategy
- **Additive Only**: Adding `project_identities`, `project_sources`, and a nullable/defaulted `creationSource` column on `projects` requires zero data migration on existing `Project` or `Memory` records.
- **Rollback Safety**: If rollback is needed, dropping `project_identities` and `project_sources` tables and the `creationSource` column leaves all `Project` and `Memory` data completely intact.

---

## 7. Concurrency & Race-Condition Safety

When multiple IDE windows (e.g. VS Code workspace + Cursor + Terminal agent) open the same repository simultaneously, concurrent `POST /api/projects/resolve` requests will be dispatched.

```text
Request A (VS Code) ───────────┐
                               ├─ Concurrent Resolve for identical Git Hash
Request B (Cursor)  ───────────┘
```

### Race Condition Resolution Strategy:
1. **Database Constraint**: `@@unique([type, identityHash])` strictly forbids duplicate identity records in PostgreSQL.
2. **Prisma Transaction with P2002 Conflict Catch**:
   ```typescript
   try {
     return await prisma.$transaction(async (tx) => {
       // 1. Double check search inside transaction
       const existing = await tx.projectIdentity.findUnique({
         where: { type_identityHash: { type: primaryType, identityHash: primaryHash } },
         include: { project: true },
       });
       if (existing) return existing.project;

       // 2. Create Project
       const project = await tx.project.create({ ... });

       // 3. Create Identity
       await tx.projectIdentity.create({ ... });

       return project;
     });
   } catch (error) {
     if (isPrismaUniqueConstraintError(error)) {
       // Another concurrent request created the project a millisecond earlier!
       // Gracefully recover by fetching the newly created project:
       const resolved = await prisma.projectIdentity.findUnique({
         where: { type_identityHash: { type: primaryType, identityHash: primaryHash } },
         include: { project: true },
       });
       if (resolved) return resolved.project;
     }
     throw error;
   }
   ```
3. **Outcome**: 100% atomic, idempotent, and resilient against race conditions without duplicate project records.

---

## 8. API Contract: `POST /api/projects/resolve`

### 8.1 Request Payload Specification
```typescript
interface ResolveProjectRequest {
  signals: {
    gitRemoteUrl?: string;          // e.g. "git@github.com:AntigravityTeam/AiMemorySync.git"
    monorepoSubPath?: string;       // e.g. "packages/core"
    packageManifest?: {
      ecosystem: "npm" | "cargo" | "pypi" | "go";
      name: string;                 // e.g. "@aimemory/core"
    };
    workspaceName?: string;         // e.g. "AiMemorySync"
    localPath?: string;             // e.g. "D:/Freelance/AiMemorySync" (hashed server-side)
  };
  source: {
    platform: "VSCODE" | "CURSOR" | "ANTIGRAVITY" | "CHATGPT" | "CLAUDE" | "CLI" | "OTHER";
    externalId?: string;            // e.g. conversationId or client machine identifier
    metadata?: Record<string, unknown>;
  };
}
```

### 8.2 Response Payload (200 OK for matched, 201 Created for new)
```json
{
  "data": {
    "project": {
      "id": "37a55e4f-b55d-49ef-b7f8-1c36d470d875",
      "name": "AiMemorySync",
      "slug": "aimemorysync",
      "status": "ACTIVE",
      "creationSource": "AUTO_DISCOVERY"
    },
    "matchedBy": "GIT_REMOTE",
    "canonicalIdentity": "github.com/antigravityteam/aimemorysync",
    "confidence": 100,
    "isNewlyCreated": false
  }
}
```

---

## 9. Security & Privacy Controls

1. **Credential Stripping**: Strips embedded tokens/passwords from Git remotes (`https://token@host/...`) before normalization, hashing, and storage.
2. **Local Path Confidentiality**: Local paths are never stored as plaintext in public/shared records; they are converted to `localPathDigest` (`SHA-256`) and isolated to `ProjectSource`.
3. **Data Minimization**: Resolution requests require zero source code ingestion; only repository metadata is processed.
4. **Safe Error Envelopes**: Catches validation and database exceptions, returning structured `{ error: { code, message } }` envelopes without exposing DB internals.

---

## 10. Web Dashboard Alignment

The existing web UI remains fully functional and will be enriched:
- **Project Cards**: Display auto-discovery badges (e.g. `Git: github.com/org/repo`) when identities exist.
- **Project Detail Page**: Displays associated identities and connected platforms.
- **Manual Fallback**: Retains the "Create Project" modal as an administrative/manual fallback option.

---

## 11. Exact Files to Create and Modify

```text
NEW FILES:
1. src/validations/discovery.validation.ts       # Zod schemas for resolution signals and source metadata
2. src/lib/identity-normalizer.ts                # Deterministic Git remote, package, and workspace normalizers
3. src/services/identity.service.ts              # Core multi-tier resolution, auto-creation, and alias attachment logic
4. src/app/api/projects/resolve/route.ts         # REST API endpoint POST /api/projects/resolve
5. docs/PHASE_5A_AUTO_DISCOVERY_IMPLEMENTATION_PLAN.md # This architecture planning specification

MODIFIED FILES:
1. prisma/schema.prisma                          # Add ProjectIdentityType, ProjectIdentity, ProjectSource models
2. src/types/domain.ts                           # Export ProjectIdentity, ProjectSource domain types
3. src/lib/api-client.ts                         # Add resolveProject() client method
4. docs/PROJECT_CONTEXT.md                       # Update Phase 5A status
```

---

## 12. Verification & Testing Strategy

1. **Unit Testing (`identity-normalizer.test.ts`)**:
   - Test SSH, HTTPS, token-embedded, custom port, SCP syntax, and `.git` variations for Git remotes.
   - Test package manifest casing and ecosystem prefixes.
   - Test workspace path privacy hashing.
2. **Integration Testing (`verify-phase5a.ts`)**:
   - Test Tier 1 Git remote match & resolution.
   - Test Tier 2 Package manifest match & resolution.
   - Test Tier 3 Workspace digest match & resolution.
   - Test auto-creation on novel identity with non-colliding slug.
   - Test alias attachment (adding HTTPS remote to a project originally created with SSH remote).
   - Test multi-platform source recording (`ProjectSource`).
   - Test concurrency race-condition handling.
   - Full test database cleanup with zero lingering records.
3. **Static Quality Pipeline**:
   - `npx prisma validate`
   - `npx prisma generate`
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run build`
