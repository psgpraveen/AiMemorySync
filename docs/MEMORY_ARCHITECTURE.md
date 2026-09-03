# Memory Architecture: AiMemorySync

## 1. Overview & Memory Philosophy
In software development with multiple AI models and coding assistants, information fragmentation quickly causes regressions, hallucinated patterns, and repeated questions. AiMemorySync addresses this by serving as an independent, persistent knowledge mesh.

The memory architecture is governed by four core tenets:
1. **Raw Data is Not Memory**: Raw conversations contain noise, pleasantries, and temporary thoughts. Memory is distilled, verified knowledge.
2. **Context Must Be Project-Scoped**: Most technical decisions are bound to a project repository and its constraints. Cross-project leakage must be strictly governed.
3. **Provenance is Mandatory**: Every stored memory must be traceable back to its originating conversation, message, document, or user action.
4. **User In The Loop**: Users retain final authority over what is remembered, updated, or permanently deleted.

---

## 2. Information Taxonomy: Data vs. Memory vs. Context

AiMemorySync strictly distinguishes between three layers of information:

```text
┌────────────────────────────────────────────────────────┐
│ 1. RAW INTERACTION DATA                                │
│    Verbatim prompts, responses, conversation logs      │
│    (Audit, provenance, and extraction source only)     │
└───────────────────────────┬────────────────────────────┘
                            │ (Distillation & Extraction)
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. PERSISTENT MEMORY (Extracted Knowledge)             │
│    - Project Memory (Primary): Decisions, rules,       │
│      requirements, conventions, bug solutions          │
│    - Global Preferences (Post-MVP): User habits        │
└───────────────────────────┬────────────────────────────┘
                            │ (Query & Synthesis)
                            ▼
┌────────────────────────────────────────────────────────┐
│ 3. TEMPORARY WORKING CONTEXT                           │
│    Dynamic, token-bounded prompt package compiled      │
│    for a single active AI interaction turn             │
└────────────────────────────────────────────────────────┘
```

### 2.1 Categorization Matrix

| Information Entity | Nature | Lifetime | Storage Boundary | Retrieval Purpose |
|---|---|---|---|---|
| **Raw Interaction Log** | **Raw Data**: Verbatim conversational transcripts. | Expiring / User-defined retention. | Relational transcript log. | Sourcing, auditability, and offline extraction. |
| **Project Memory** | **Persistent Memory**: Extracted structured knowledge (decisions, requirements, conventions, architecture). | Project lifecycle (until updated or deprecated). | Normalized project-scoped database tables & indices. | High-precision project grounding and context assembly. |
| **Global Preferences** *(Post-MVP)* | **Persistent Memory**: Cross-project user habits, preferred tooling, personal styling. | User lifecycle (until modified by user). | User-scoped profile store. | Personalizing agent interactions across multiple projects. |
| **Working Context** | **Temporary Context**: Ephemeral context bundle assembled for prompt injection. | Interaction turn / active session. | In-memory runtime state. | Direct prompt augmentation into the target AI model. |

---

## 3. Project Memory Sub-Types

Within **Project Memory**, extracted knowledge is classified into deterministic sub-types:
- `DECISION`: Architectural and technical decisions made during planning or coding.
- `REQUIREMENT`: Functional or non-functional constraints specified by the user.
- `CONVENTION`: Code styling, directory structure, or repository patterns agreed upon.
- `BUG_SOLUTION`: Known issues, root causes identified, and solutions discovered.
- `TASK_STATE`: Active milestone, completed items, or blocked states.

Every Project Memory record transitions through a clear lifecycle state:
`PROPOSED` → `ACTIVE` → `SUPERSEDED` → `DEPRECATED`.

---

## 4. Operational Flows & Lifecycle

### 4.1 Ingestion & Creation Flow
```text
User / Agent Interaction
         │
         ▼
Raw Interaction Capture (User-Approved)
         │
         ▼
Structured Knowledge Extraction (Manual in MVP; Automated in Post-MVP)
         │
         ▼
Two-Tier Deduplication & Association Check
  ├── Exact Hash Match (SHA-256): Flag as duplicate → Increment count, discard redundant text
  └── Semantic Distance Match: Flag as "Related" or "Potential Duplicate"
         │
         ▼
Deterministic Safety Check
  ├── High-confidence duplicate/extension matching deterministic rules: Safe merge/link
  └── Ambiguity / Conflict: Preserve as distinct record or queue for user confirmation
         │
         ▼
Persistent Storage (Project Memory Record)
```

### 4.2 Memory Update & Supersession Flow
1. **Identification**: A new interaction explicitly amends or updates an existing decision (e.g., changing styling libraries).
2. **Linkage**: The system retrieves the existing active memory entry via subject key or project link.
3. **Version Incrementation**: A new revision of the memory is created.
4. **Status Transition**: The prior revision is marked `SUPERSEDED` with a foreign pointer to the new revision ID.
5. **Index Invalidation**: Obsolete revisions are excluded from default context queries.

### 4.3 Safe Deduplication & Association Strategy

A core rule of the AiMemorySync architecture is that **exact duplicate detection and semantic similarity detection are fundamentally different operations**:

1. **Exact Match (Syntactic Deduplication)**:
   - Method: Normalized textual content hashing (e.g., SHA-256 of trimmed, case-normalized text).
   - Behavior: If an incoming memory has an identical hash to an active record in the same project, it is an **automatic duplicate**. The system updates the last-observed timestamp and frequency counter without duplicating records.

2. **Semantic Similarity (Related Memory Detection)**:
   - Method: Vector cosine similarity.
   - Behavior: High semantic similarity (e.g., cosine distance $< 0.15$) indicates that two items discuss similar topics. It does **NOT** imply they mean the same thing. They may represent competing alternatives, differing environments (e.g., "dev" vs. "prod"), or distinct tasks.
   - Action: The candidate is surfaced as a *Related Memory* or *Potential Duplicate*. It is **never automatically merged** without deterministic safety verification.

3. **Safe Automatic Merging Criteria**:
   Automatic merging or supersession is permitted **only** when all of the following deterministic conditions are satisfied:
   - Both records belong to the exact same `project_id` and `category`.
   - The new memory explicitly references the prior memory key or ID.
   - The update is an additive, non-contradictory extension (e.g., adding a newly discovered edge-case to an existing bug solution).
   - If any contradiction or semantic ambiguity is detected, the system preserves both records or prompts the user for review.

### 4.4 Relevance Scoring (Conceptual Design)
For semantic retrieval (Post-MVP), candidate memories are ranked to fit within token limits.
The conceptual ranking criteria combine:
- **Semantic Match**: Similarity to the active prompt or task description.
- **Recency & Freshness**: Newer or recently verified memories take precedence over stale entries.
- **Explicit Priority**: Architectural rules and mandatory decisions carry higher baseline weight than transient debugging notes.

*(Note: Specific numerical formula weights are implementation details to be tuned against empirical evaluation, not rigid architectural constants).*

### 4.5 Versioning & Provenance
Every memory record contains:
- `id`: Unique identifier (UUIDv7 for time-sorted uniqueness).
- `project_id`: Required tenant/codebase link.
- `version`: Monotonically increasing revision number ($1, 2, 3\dots$).
- `status`: `ACTIVE`, `SUPERSEDED`, `DEPRECATED`, `DELETED`.
- `superseded_by`: Optional UUID pointing to the replacement memory.
- `provenance`: Originating source pointers (Message ID, Git commit hash, or Author).

### 4.6 Invalidation & Deletion Strategy
- **Manual Deletion**: Users can review, edit, or permanently purge individual memories or entire project stores via the Web UI.
- **Soft Deletion**: Initial deletion sets `status = DELETED` for recovery and auditability.
- **Hard Purge**: Permanent deletion completely purges database records and vector embeddings.
- **Secret Invalidation**: If an API key or password is retrospectively detected, the record is immediately invalidated and scrubbed.
