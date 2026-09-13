# Core Data Model: AiMemorySync

## 1. Overview & Data Model Principles
The AiMemorySync data model focuses on the core problem: **storing, organizing, and retrieving structured technical memories with strong multi-tenant security boundaries and optional project scopes**.

### Core Principles
1. **Tenant is the Mandatory Security Boundary**: Every memory record is firmly anchored to a `tenant_id`. Cross-tenant data access is strictly forbidden.
2. **Project is an Optional Scope**: Memories can exist at the tenant level (`project_id = NULL` for personal preferences, cross-project instructions, or workspace-wide conventions) or scoped to a specific project (`project_id = PROJECT_ID` for project-specific architecture, requirements, and decisions).
3. **Database Integrity**: Enforce constraints, foreign keys, and check rules at the database level.
4. **Deterministic Duplicate Detection**: Use cryptographic content hashing scoped by tenant and optional project.
5. **Machine Key Scoping**: Machine keys (API keys) can be tenant-wide or restricted to a specific project. Project-scoped keys are strictly forbidden from accessing or creating tenant-level memories.

---

## 2. Conceptual Entity Relationship Diagram (ERD)

```text
┌────────────────────────────────────────┐
│                 Tenant                 │
├────────────────────────────────────────┤
│ PK  id          UUID                   │
│     name        VARCHAR(100)           │
│     slug        VARCHAR(100) UNIQUE    │
│     created_at  TIMESTAMPTZ            │
│     updated_at  TIMESTAMPTZ            │
└──────┬──────────────────────────┬──────┘
       │ 1                        │ 1
       │ has many (1 : N)         │ has many (1 : N, mandatory)
       ▼ *                        │
┌──────────────────────────┐      │
│         Project          │      │
├──────────────────────────┤      │
│ PK  id          UUID     │      │
│ FK  tenant_id   UUID     │      │
│     name        VARCHAR  │      │
│     slug        VARCHAR  │      │
│     status      VARCHAR  │      │
│     created_at  TIMESTAMPTZ     │
│     updated_at  TIMESTAMPTZ     │
└──────────────┬───────────┘      │
               │ 1 (optional)     │
               │ has many         │
               ▼ *                ▼ *
┌────────────────────────────────────────┐
│                 Memory                 │
├────────────────────────────────────────┤
│ PK  id           UUID                  │
│ FK  tenant_id    UUID (NOT NULL)       │
│ FK  project_id   UUID (NULLABLE)       │
│     type         VARCHAR(20)           │
│     title        VARCHAR(200)          │
│     content      TEXT                  │
│     priority     VARCHAR(20)           │
│     content_hash CHAR(64)              │
│     status       VARCHAR(20)           │
│     created_at   TIMESTAMPTZ           │
│     updated_at   TIMESTAMPTZ           │
└────────────────────────────────────────┘
```

---

## 3. Entity Definitions & Field Specifications

### 3.1 `Project` Entity
The `Project` entity represents a specific software repository or project within a tenant.

| Field | Type Concept | Constraint / Nullability | Description & Validation |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Unique project identifier (UUIDv7 or UUIDv4). |
| `tenant_id` | `UUID` | `NOT NULL, FK` | References `Tenant(id) ON DELETE CASCADE`. |
| `name` | `VARCHAR(100)` | `NOT NULL` | Human-readable project name (1–100 chars, e.g., "AiMemorySync"). |
| `slug` | `VARCHAR(100)` | `NOT NULL` | URL-safe, lowercase slug (unique per tenant: `UNIQUE(tenant_id, slug)`). |
| `description` | `TEXT` | `NULLABLE` | Optional summary of project scope and architecture (max 500 chars). |
| `status` | `VARCHAR(20)` | `NOT NULL, DEFAULT 'ACTIVE'` | Project lifecycle state: `'ACTIVE'` or `'ARCHIVED'`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | Record creation timestamp. Immutable. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | Timestamp of last modification. Automatically updated. |

---

### 3.2 `Memory` Entity
The `Memory` entity represents a discrete, preserved unit of engineering knowledge.

| Field | Type Concept | Constraint / Nullability | Description & Validation |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Unique memory identifier. |
| `tenant_id` | `UUID` | `NOT NULL, FK` | References `Tenant(id) ON DELETE CASCADE`. Mandatory security boundary. |
| `project_id` | `UUID` | `NULLABLE, FK` | References `Project(id) ON DELETE CASCADE`. If `NULL`, memory is tenant-level / workspace-wide. |
| `type` | `VARCHAR(20)` | `NOT NULL` | Memory category check constraint: `'DECISION'`, `'REQUIREMENT'`, `'CONVENTION'`, `'BUG_SOLUTION'`. |
| `title` | `VARCHAR(200)` | `NOT NULL` | Concise, searchable summary (1–200 chars). |
| `content` | `TEXT` | `NOT NULL` | Detailed description, rationale, or instructions (1–10,000 chars). |
| `priority` | `VARCHAR(20)` | `NOT NULL, DEFAULT 'NORMAL'` | Importance level check: `'LOW'`, `'NORMAL'`, `'HIGH'`, `'CRITICAL'`. |
| `content_hash` | `CHAR(64)` | `NOT NULL` | SHA-256 hex digest of normalized content for exact duplicate prevention. |
| `status` | `VARCHAR(20)` | `NOT NULL, DEFAULT 'ACTIVE'` | State check: `'ACTIVE'`, `'DEPRECATED'`, `'ARCHIVED'`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | Ingestion timestamp. Immutable. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | Timestamp of last modification. |

#### Database Constraints:
- `fk_memory_tenant`: `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE`
- `fk_memory_project`: `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE`
- `chk_memory_type`: `CHECK (type IN ('DECISION', 'REQUIREMENT', 'CONVENTION', 'BUG_SOLUTION'))`
- `chk_memory_priority`: `CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL'))`
- `chk_memory_status`: `CHECK (status IN ('ACTIVE', 'DEPRECATED', 'ARCHIVED'))`

---

## 4. Index Recommendations

To support rapid filtering, duplicate checking, and prompt context compilation across tenant and project scopes:

1. **`idx_memory_tenant_status`**:
   - `CREATE INDEX idx_memory_tenant_status ON memories(tenant_id, status);`
   - Primary retrieval index for workspace-wide and tenant context queries.
2. **`idx_memory_tenant_project_status`**:
   - `CREATE INDEX idx_memory_tenant_project_status ON memories(tenant_id, project_id, status);`
   - Primary retrieval index for project context assembly within a tenant.
3. **`idx_memory_tenant_hash`**:
   - `CREATE INDEX idx_memory_tenant_hash ON memories(tenant_id, content_hash);`
   - Enables fast duplicate detection across tenant-level memories.
4. **`idx_memory_project_status`**:
   - `CREATE INDEX idx_memory_project_status ON memories(project_id, status);`
   - Fast retrieval of active project-specific memories.
5. **`idx_memory_project_hash`**:
   - `CREATE INDEX idx_memory_project_hash ON memories(project_id, content_hash);`
   - Fast duplicate detection within a project scope.
6. **`idx_memory_project_type_priority`**:
   - `CREATE INDEX idx_memory_project_type_priority ON memories(project_id, type, priority);`
   - Optimizes category-specific context assembly and priority-based sorting.

---

## 5. Memory Type Representation Design

The four MVP memory categories are:
- `DECISION`: Architectural and design choices (e.g., "Use Turbopack for local dev").
- `REQUIREMENT`: Technical or functional constraints (e.g., "Node.js v20+ is required").
- `CONVENTION`: Code styling, naming, or patterns (e.g., "Use @/* import alias").
- `BUG_SOLUTION`: Known defect resolutions (e.g., "Fix hydration error via suppressHydrationWarning").

### Architecture Recommendation: Constrained String with Check Constraint
- **Approach**: `VARCHAR(20)` backed by a SQL `CHECK` constraint (and TypeScript union type).
- **Trade-off Analysis**:
  - *Separate Table (`memory_types`)*: Adds unnecessary JOIN overhead for 4 static strings. Overengineered for MVP.
  - *Postgres Native `CREATE TYPE ... AS ENUM`*: Migration alter statements can be brittle across database versions.
  - *Constrained `VARCHAR`*: Simple, portable, inspectable in raw SQL, and strictly guarded by database check constraints.

---

## 6. Priority Design

To ensure high-priority architectural rules are prioritized when fitting memories into a prompt's token budget:

### Architecture Recommendation: Named String Enum with Deterministic Ordering
- **Values**: `'LOW'`, `'NORMAL'`, `'HIGH'`, `'CRITICAL'`.
- **Default**: `'NORMAL'`.
- **Context Ranking Order**:
  ```sql
  ORDER BY 
    CASE priority
      WHEN 'CRITICAL' THEN 1
      WHEN 'HIGH'     THEN 2
      WHEN 'NORMAL'   THEN 3
      WHEN 'LOW'      THEN 4
      ELSE 5
    END ASC,
    updated_at DESC
  ```
- **Rationale**: Named strings are self-documenting in APIs and UIs. Numeric values (e.g., 1–10) introduce arbitrary granularity without clear user meaning.

---

## 7. Deterministic Content Hashing & Duplicate Detection

Exact duplicate detection prevents identical memories from being created repeatedly across sessions.

### 7.1 Canonicalization Algorithm
Before hashing, the payload is normalized to eliminate trivial formatting variances:
1. **Trim Title**: Remove leading/trailing whitespace; convert to lowercase.
2. **Normalize Content**:
   - Convert all CRLF line endings (`\r\n`) to LF (`\n`).
   - Strip trailing whitespace from every line.
   - Collapse three or more consecutive newlines into two newlines.
   - Trim overall start and end whitespace.
3. **Assemble Canonical String**:
   ```text
   canonical = TYPE + "\n" + NORMALIZED_TITLE + "\n" + NORMALIZED_CONTENT
   ```
4. **Compute SHA-256**:
   ```text
   content_hash = hex(sha256(canonical))
   ```

### 7.2 Ingestion Duplicate Check Flow
```text
Incoming Memory Payload (tenant_id, optional project_id)
          │
          ▼
Canonicalization & Hash Generation (SHA-256)
          │
          ▼
Query: SELECT id, title FROM memories 
       WHERE tenant_id = :tenant_id 
         AND project_id IS NOT DISTINCT FROM :project_id 
         AND content_hash = :content_hash 
         AND status = 'ACTIVE'
          │
    ┌─────┴─────────────────────────┐
    ▼                               ▼
Match Found                    No Match
    │                               │
    ▼                               ▼
Flag as Exact Duplicate:       Insert new Memory record
- Reject with 409 Conflict     (status = 'ACTIVE')
  or return existing record
- Skip redundant insert
```

### 7.3 Scoping Rule
**Duplicate checks are strictly scoped by tenant and target project**:
1. **Tenant-Level Memories (`project_id = NULL`)**: Deduplication checks `{ tenant_id, project_id: null, content_hash }`.
2. **Project Memories (`project_id = PROJECT_ID`)**: Deduplication checks `{ tenant_id, project_id, content_hash }`.
3. **Cross-Scope Coexistence**: Identical content may coexist across different projects or between a project and the tenant-level scope without collision.
4. **Cross-Tenant Isolation**: Two different tenants can have identical content hashes completely isolated from each other.

---

## 8. Memory Update Strategy

How mutations are handled in the MVP:

### Evaluated Options:
- **Option A (Direct Overwrite)**: Mutates `title`, `content`, `priority`, and recalculates `content_hash` in place.
- **Option B (Immediate Versioning Table)**: Every update inserts into a `MemoryVersion` table.
- **Option C (In-Place Update with Timestamp, Version-Ready Schema)**: Update the active memory record in place; track `updated_at`.

### Architecture Recommendation: Option C
- **Rationale**: The MVP does not have a UI for browsing revision history or rolling back previous memory versions. Adding a `MemoryVersion` table now is premature overengineering.
- **Future Safety**: If full historical audits are required later, a `MemoryVersion` table can be added via a non-breaking migration by creating a trigger or hook on `Memory` updates.

---

## 9. Entities Intentionally Excluded from MVP

To maintain a laser focus on the core value proposition, the following entities are deferred:

| Excluded Entity | Why Excluded from MVP | Target Phase |
|---|---|---|
| **`User`** | MVP runs in single-developer / local-first mode without multi-tenant authentication. | Post-MVP |
| **`Workspace`** | Workspace hierarchy is unnecessary overhead when single-project scoping suffices. | Post-MVP |
| **`MemoryVersion`** | Version history browsing and rollback are not supported in the MVP UI. | Post-MVP |
| **`MemorySource`** | Fine-grained provenance links (message IDs, web URLs) are not needed for initial manual memory CRUD. | Post-MVP |
| **`SyncEvent`** | Real-time WebSocket/SSE broadcasting is deferred; context is pulled on demand. | Future |
| **`Device`** | Multi-device coordination is outside the single-machine MVP scope. | Future |
| **`ContextSnapshot`** | Ephemeral prompt contexts are compiled in memory and do not require relational persistence. | Post-MVP |
| **`AuditLog`** | Database timestamps (`created_at`, `updated_at`) provide sufficient baseline tracking for MVP. | Post-MVP |

---

## 10. Future Migration Paths

The MVP schema is deliberately structured so that future enhancements can be added via additive, non-breaking migrations:

### 10.1 Adding User & Workspace Ownership
```sql
-- Future Non-Breaking Migration
CREATE TABLE workspace (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add nullable foreign key to project
ALTER TABLE project ADD COLUMN workspace_id UUID REFERENCES workspace(id);
```

### 10.2 Adding Memory Versioning
```sql
-- Future Non-Breaking Migration
CREATE TABLE memory_version (
    id UUID PRIMARY KEY,
    memory_id UUID NOT NULL REFERENCES memory(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    content_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 10.3 Adding Vector Embeddings (Semantic Search)
Future semantic search may introduce embedding storage compatible with the selected embedding model. Embedding dimensions depend on the chosen model/provider and must not be locked prior to model selection.

```sql
-- Conceptual Future Migration (model-agnostic embedding column)
CREATE EXTENSION IF NOT EXISTS vector;

-- Note: The exact dimension (e.g., vector(N)) will be specified once the embedding model is selected
ALTER TABLE memory ADD COLUMN embedding vector;
CREATE INDEX idx_memory_embedding ON memory USING ivfflat (embedding vector_cosine_ops);
```

### 10.4 Adding Memory Provenance (Sources)
```sql
-- Future Non-Breaking Migration
CREATE TABLE memory_source (
    id UUID PRIMARY KEY,
    memory_id UUID NOT NULL REFERENCES memory(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    external_reference VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
