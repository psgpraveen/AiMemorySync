# Architecture Specification: Automatic Project Discovery & Identity Resolution

## 1. Product Principle

### Primary vs. Secondary Workflow
AiMemorySync is **not primarily a manual project and memory management dashboard**.

The foundational product principle is:

```text
Automatic Project Detection & Identity Resolution
=
PRIMARY PRODUCTION WORKFLOW

Manual Project Creation & Web Dashboard
=
FALLBACK / INSPECTION / DEBUGGING / ADMINISTRATIVE WORKFLOW
```

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AI Platform / IDE / Tool                              │
│                    (VS Code, Cursor, ChatGPT, Claude, Antigravity)              │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼ (Captures activity)
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Integration Adapter / Extension Layer                        │
│               (Extracts Git Remote, Package Info, Platform Context)             │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼ (POST /api/projects/resolve)
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   Project Identity Resolution Engine                            │
│                 (Canonicalizes, Hashes, Matches, Auto-Creates)                  │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
         [Project Exists in DB]                   [New Project Detected]
                    │                                         │
         Attach to Existing Project               Automatically Provision Project
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Project-Scoped Shared Memory Pool                       │
│                       (Ingestion, Retrieval, Context Engine)                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Current Architecture Audit

A rigorous audit of the current repository implementation reveals the following baseline:

### Current Schema (`prisma/schema.prisma`)
- **`Project` Model**:
  - `id`: `String @id @default(uuid())` (Primary identity in database)
  - `name`: `String @db.VarChar(100)` (Display name)
  - `slug`: `String @unique @db.VarChar(100)` (Unique URL identifier)
  - `description`: `String? @db.Text`
  - `status`: `ProjectStatus @default(ACTIVE)`
  - `createdAt`, `updatedAt`: `DateTime`
  - `memories`: `Memory[]`
- **`Memory` Model**:
  - Anchored to `projectId String` (`FOREIGN KEY references Project(id) ON DELETE CASCADE`)
  - Content deduplication via `contentHash String @db.Char(64)` (`SHA-256` of normalized title, type, and content).

### Current Project Services & Validation
- `src/services/project.service.ts`:
  - Enforces `slug` uniqueness globally (`prisma.project.findUnique({ where: { slug } })`).
  - Auto-generates `slug` by lowercasing and kebab-casing the human-readable `name`.
  - Lookups occur strictly by `id` (UUID) or `slug`.
- `src/validations/project.validation.ts`:
  - Validates `name`, optional `slug`, and `description`.
- `src/app/api/projects/`:
  - REST endpoints expose standard CRUD operations (`GET`, `POST`, `PATCH`, `DELETE`).

### Identified Architectural Limitations
1. **No External Identity Anchor**: The `Project` model contains zero fields for canonical Git remotes, repository hashes, workspace IDs, or external platform references.
2. **Slug as Pseudo-Identity**: `slug` currently acts as the unique identifier. However, slug is derived from the project name (e.g. `"My App"` &rarr; `"my-app"`). Two developers working on the same repository with different folder names would generate mismatched slugs.
3. **No Cross-Machine Correlation**: A repository cloned at `D:\Freelance\AiMemorySync` and `C:\Projects\AiMemorySync` cannot currently be reconciled to the same internal project.
4. **No Multi-Platform Binding**: There is no data structure to track which platforms (VS Code, Cursor, ChatGPT, Claude) are currently bound to a project.

---

## 3. Gap Analysis

| Capability Area | Current Status (Phase 4A) | Required Future Architecture | Classification |
| :--- | :--- | :--- | :--- |
| **Project Identity Anchor** | `id` (UUID) + `slug` (derived from name) | Canonical Git Remote Hash + Platform Identifiers | **Needs Modification** |
| **Project Creation Flow** | Manual via Dashboard (`POST /api/projects`) | Automatic via Discovery Engine (`POST /api/projects/resolve`) + Manual Fallback | **Needs Modification** |
| **Cross-Machine Matching** | Not possible (relies on manual selection) | Automatic reconciliation via canonical Git remote | **Needs Modification** |
| **Multi-Platform Binding** | Single conceptual project | Multiple platform source bindings (`ProjectSource`) mapping to one `Project` | **Future Requirement** |
| **Memory Data Model** | Scoped strictly to `projectId` | Scoped to `projectId` with future support for `GLOBAL`, `WORKSPACE`, `AGENT` | **Already Supported (Compatible)** |
| **Deterministic Duplicate Detection** | Scoped by `projectId` + `contentHash` | Preserved as-is (strict project boundary isolation) | **Already Supported (Preserve)** |
| **Context Assembly Engine** | Multi-tier deterministic sort by priority/type/recency | Consumes resolved `projectId` deterministically | **Already Supported (Preserve)** |
| **Management Dashboard** | Full CRUD for projects and memories | Acts as administrative/inspection/fallback dashboard | **Already Supported (Preserve)** |

---

## 4. Project Identity Model

### 4.1 Tiered Identity Hierarchy
To ensure robust matching across diverse developer environments, AiMemorySync adopts a **3-Tier Identity Hierarchy**:

```text
Tier 1: Canonical Git Remote Identity (Primary - Highest Confidence)
  └─ Normalizes GitHub, GitLab, Bitbucket, self-hosted Git repositories.
  └─ Guarantees cross-machine, cross-IDE, and cross-team matching.

Tier 2: Package / Manifest Identity (Secondary - High Confidence for Non-Git / Monorepos)
  └─ npm package name, Cargo crate name, go.mod module path, pyproject.toml name.
  └─ Disambiguates monorepo sub-packages within the same Git repository.

Tier 3: Local Workspace / Platform Session Identity (Fallback - Ephemeral / Local)
  └─ Local project root path hash or Platform conversation session ID.
  └─ Used for scratchpads, rapid prototypes, or environments without Git.
```

---

### 4.2 Canonical Git Remote Normalization Algorithm
Git remotes arrive in varied formats (SSH, HTTPS, user-token embedded, SCP-style, custom ports, casing, `.git` suffixes). The normalization algorithm must produce a single deterministic canonical string:

```text
INPUT EXAMPLES:
1. git@github.com:AntigravityTeam/AiMemorySync.git
2. https://github.com/AntigravityTeam/AiMemorySync.git
3. https://oauth2:ghp_secretToken123@github.com/AntigravityTeam/AiMemorySync.git/
4. ssh://git@gitlab.company.com:2222/core/aimemorysync.git
5. git@github.com:antigravityteam/aimemorysync

NORMALIZATION PIPELINE:
Step 1: Strip basic auth credentials (user:token@)
Step 2: Strip protocol scheme (https://, http://, ssh://, git://)
Step 3: Convert SCP-like syntax (git@host:org/repo -> host/org/repo)
Step 4: Strip port numbers (:2222/)
Step 5: Strip trailing slashes and '.git' suffix
Step 6: Lowercase hostname and repository path

CANONICAL OUTPUT:
github.com/antigravityteam/aimemorysync

CANONICAL IDENTITY HASH:
sha256("github.com/antigravityteam/aimemorysync") -> 64-character hex string
```

#### Safe Normalization Edge Cases:
1. **Token Stripping**: Embedded credentials (`https://user:token@host/repo`) are stripped immediately before parsing to prevent security leakage.
2. **Casing Policy**: Hostnames are strictly case-insensitive (`GITHUB.COM` &rarr; `github.com`). Repository paths on GitHub/GitLab are URL case-insensitive and normalized to lowercase.
3. **Provider Variations**: Handles nested subgroups (e.g. `gitlab.com/group/subgroup/repo`) and self-hosted domains without hardcoded provider assumptions.

---

### 4.3 Non-Git and Monorepo Disambiguation
When no Git remote exists or when multiple sub-projects share a single Git root (Monorepo):
1. **Monorepo Sub-Scope**: `canonicalIdentity = "github.com/org/monorepo#packages/frontend"`
2. **Package Manifest**: `canonicalIdentity = "pkg:npm/@company/frontend"`
3. **Local Unlinked**: `canonicalIdentity = "local:<machine_id>:<path_hash>"` (flagged as local unlinked project).

---

## 5. Identity Resolution Algorithm

```text
                          Incoming Activity Event
                   (from IDE Plugin, Extension, or Agent)
                                     │
                                     ▼
                      Extract Environment Metadata:
                - gitRemoteUrl (optional)
                - monorepoSubPath (optional)
                - packageIdentity (optional)
                - workspaceName (required)
                - localPath (optional)
                - platform (e.g. 'vscode', 'cursor', 'chatgpt')
                                     │
                                     ▼
                      Can we construct a Tier 1 Identity?
                               (Git Remote URL)
                                     │
                     ┌───────────────┴───────────────┐
                    YES                              NO
                     │                               │
           Normalize Git Remote            Can we construct Tier 2/3?
         Compute canonicalHash              (Package / Platform ID)
                     │                               │
                     ▼                               ▼
       Query Database for Identity      Query Database for Identity
                     │                               │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                             Identity Matched?
                                     │
                     ┌───────────────┴───────────────┐
                    YES                              NO
                     │                               │
             Fetch Matched Project           Auto-Create New Project
                     │                       - name = workspaceName
                     │                       - slug = generateUniqueSlug()
                     │                       - register Primary Identity
                     │                               │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                       Record/Update ProjectSource
                 (platform, localPath, lastSeenAt)
                                     │
                                     ▼
                      Return Project Context & ID
                       (Ready for Memory Operations)
```

---

## 6. Database Evolution Plan

### Alternative Evaluation

#### Alternative A: Add Flat Columns to `Project` Table
```sql
ALTER TABLE projects ADD COLUMN primary_identity_type VARCHAR(50);
ALTER TABLE projects ADD COLUMN canonical_identity VARCHAR(255) UNIQUE;
ALTER TABLE projects ADD COLUMN canonical_identity_hash CHAR(64) UNIQUE;
```
- **Pros**: Simplest schema change; 1:1 mapping.
- **Cons**: Cannot support multiple aliases (e.g. SSH remote + HTTPS remote + local mirror), cannot track multi-platform connections, cannot handle monorepo sub-scopes cleanly.

---

#### Alternative B: Normalized Multi-Table Architecture (Recommended)
Introduce two dedicated tables while keeping the existing `Project` and `Memory` tables intact:

```text
┌────────────────────────────────────────────────────────┐
│                        Project                         │
│                    (Core Aggregate)                    │
├────────────────────────────────────────────────────────┤
│ PK  id               UUID                              │
│     name             VARCHAR(100)                      │
│     slug             VARCHAR(100) UNIQUE               │
│     description      TEXT                              │
│     status           VARCHAR(20) [ACTIVE, ARCHIVED]    │
│     creation_source  VARCHAR(50) [AUTO_DISCOVERY, ...] │
│     created_at       TIMESTAMPTZ                       │
│     updated_at       TIMESTAMPTZ                       │
└───────────┬───────────────────────────────┬────────────┘
            │ 1                             │ 1
            │ 1:N                           │ 1:N
            ▼ *                             ▼ *
┌──────────────────────────────┐ ┌──────────────────────────────┐
│       ProjectIdentity        │ │        ProjectSource         │
│     (What is this repo?)     │ │    (Where is it used?)       │
├──────────────────────────────┤ ├──────────────────────────────┤
│ PK  id               UUID    │ │ PK  id               UUID    │
│ FK  project_id       UUID    │ │ FK  project_id       UUID    │
│     type             VARCHAR │ │     platform         VARCHAR │
│     value            TEXT    │ │     external_id      VARCHAR │
│     normalized_hash  CHAR(64)│ │     local_path       TEXT    │
│     is_primary       BOOLEAN │ │     metadata         JSONB   │
│     created_at       TSTZ    │ │     last_seen_at     TSTZ    │
└──────────────────────────────┘ └──────────────────────────────┘
```

#### Why Alternative B is Superior:
1. **Zero Breaking Changes**: Existing `Project` and `Memory` queries, domain services, and APIs continue working without modification.
2. **Multiple Identity Aliases**: A project can have both `git@github.com:org/repo.git` and `https://github.com/org/repo.git` pointing to the same project record.
3. **Platform Source Separation**: Tracks where the project is active (VS Code on Machine A, Cursor on Machine B, ChatGPT session C) without corrupting project identity.
4. **Relational Cleanliness**: Follows domain-driven design separation between Identity, Source, and Core Knowledge.

---

## 7. API Evolution

### Proposed New Endpoints (Planned for Future Discovery Phase)

#### 1. `POST /api/projects/resolve`
Resolves an incoming environment signal to an existing project or provisions a new one automatically.

**Request Payload:**
```json
{
  "signals": {
    "gitRemoteUrl": "git@github.com:AntigravityTeam/AiMemorySync.git",
    "monorepoSubPath": null,
    "workspaceName": "AiMemorySync",
    "localPath": "D:\\Freelance\\AiMemorySync"
  },
  "source": {
    "platform": "VSCODE",
    "extensionVersion": "1.0.0"
  }
}
```

**Response Payload (200 OK / 201 Created):**
```json
{
  "data": {
    "project": {
      "id": "37a55e4f-b55d-49ef-b7f8-1c36d470d875",
      "name": "AiMemorySync",
      "slug": "aimemorysync",
      "status": "ACTIVE"
    },
    "matchedBy": "GIT_REMOTE",
    "canonicalIdentity": "github.com/antigravityteam/aimemorysync",
    "isNewlyCreated": false
  }
}
```

---

## 8. Security & Privacy

1. **Credential Sanitization**: The resolution engine must strip all user credentials, tokens, and basic-auth passwords from URLs before hashing and storage (`https://user:token@github.com/...` &rarr; `github.com/...`).
2. **Local Path Privacy**: Local filesystem paths (`D:\Freelance\AiMemorySync` or `/Users/alice/projects/client-secret`) are stored solely in the client/source record for local IDE session resolution and are never rendered into AI prompt contexts.
3. **Private Repository Security**: Canonical identity hashes (`SHA-256`) allow matching private repositories without exposing proprietary repository names across tenant boundaries.
4. **Data Minimization**: Extensions only send repository identity metadata (git remote, root folder name), never source code files or unprompted file contents, to the identity resolution endpoint.

---

## 9. Future Integration Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          External AI Tools & IDEs                               │
│      [VS Code Extension]   [Cursor Extension]   [Browser Extension (Web)]       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼ (Local environment introspection)
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       Standardized Platform Adapter Layer                       │
│    - Extracts git remote via git CLI or workspace API                           │
│    - Strips credentials & normalizes identity string                            │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼ (HTTP POST /api/projects/resolve)
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       AiMemorySync Identity Resolution API                      │
│    - Checks ProjectIdentity table via normalized_hash                           │
│    - If found: returns existing project ID & context configuration              │
│    - If not found: auto-creates project, registers identity, returns new ID     │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼ (Resolved Project ID)
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Core AiMemorySync Engine                             │
│       - Ingestion: POST /api/projects/:id/memories                              │
│       - Context Retrieval: GET /api/projects/:id/context?budget=8000            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Recommended Phased Roadmap

### Phase 4A.1 (Current State)
- **Status**: Completed (Code & Integration verified; manual browser QA pending).
- **Deliverable**: Functional web UI for project & memory administration and fallback management.

### Phase 4B: Context Preview & Budget UI (Next Scheduled UI Phase)
- Implement interactive context preview, token/character budget sliders, and Markdown clipboard export in the web UI using the existing `GET /api/projects/:id/context` engine.

### Phase 5A: Project Identity & Auto-Discovery Backend Foundation
- Add `ProjectIdentity` and `ProjectSource` schema models.
- Implement `src/lib/git-identity.ts` normalization & hashing library.
- Implement `POST /api/projects/resolve` endpoint with transactional matching/creation logic.

### Phase 5B: First Integration Client (VS Code / Antigravity Agent Plugin)
- Build the first client plugin utilizing `POST /api/projects/resolve` to automatically detect repositories and synchronize memories without manual dashboard intervention.

### Phase 5C: Browser Extension & Multi-Platform Cross-Sync
- Browser extension for web AI interfaces (ChatGPT, Claude) mapping conversation sessions to resolved projects.
