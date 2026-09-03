# Context Assembly Engine Specification

## 1. Purpose

The Context Assembly Engine transforms active, structured project memories into a deterministic, token/character-budgeted context block ready for consumption by AI coding agents, IDE extensions, web dashboards, and developer workflows.

AiMemorySync acts as the single source of truth for persistent AI memory. Rather than forcing AI agents to ingest entire codebases or uncurated history, the Context Engine dynamically extracts the most critical architectural decisions, constraints, conventions, and bug solutions within a guaranteed size envelope.

The Context Assembly Engine is **stateless, read-only, and deterministic**. It does not invoke AI/LLM models, embeddings, or vector databases.

---

## 2. Inputs

The engine receives:
1. **`projectId`** (UUID): The target project whose memories are assembled.
2. **`budget`** (Integer, optional): The maximum character budget for the generated Markdown context.
   - Default: `8000` characters
   - Minimum: `1000` characters
   - Maximum: `50000` characters
3. **`types`** (Array of `MemoryType`, optional): Optional filter restricting assembly to specific memory categories (e.g., `["DECISION", "REQUIREMENT"]`).
4. **Active Project Memories**: Queried directly from PostgreSQL via Prisma where `projectId = :projectId AND status = 'ACTIVE'`.

---

## 3. Selection Algorithm

Selection proceeds through a multi-tier deterministic pipeline:

```text
Request (projectId, budget, types)
                ↓
Validate Input via Zod (contextOptionsSchema / contextQuerySchema)
                ↓
Verify Project Exists in PostgreSQL
                ↓
Fetch Active Memories (status = 'ACTIVE' only)
                ↓
Deterministic Multi-Tier Sort
  1. Priority: CRITICAL (4) -> HIGH (3) -> NORMAL (2) -> LOW (1)
  2. Type Hierarchy: DECISION (4) -> REQUIREMENT (3) -> CONVENTION (2) -> BUG_SOLUTION (1)
  3. Recency: updatedAt DESC
  4. Creation: createdAt DESC
  5. Stable Tie-breaker: id ASC
                ↓
Greedy Character Budget Selection
  - Memory included completely or excluded completely
  - Never partially truncated
                ↓
Type-Grouped Markdown Formatting
  - ## Decisions
  - ## Requirements
  - ## Conventions
  - ## Known Bug Solutions
                ↓
Return ContextResult Object
```

---

## 4. Priority Ordering

Memories are prioritized strictly by their business priority:

| Priority | Weight | Description |
| :--- | :---: | :--- |
| `CRITICAL` | 4 | Architectural invariants, security requirements, core boundaries |
| `HIGH` | 3 | Key architectural patterns, primary library selections |
| `NORMAL` | 2 | Standard coding conventions, operational rules |
| `LOW` | 1 | Minor tips, edge-case guidance |

The priority hierarchy is enforced in application code using `PRIORITY_WEIGHT` to guarantee consistent cross-platform behavior.

---

## 5. Type Ordering

When two memories share the same priority level, a deterministic type hierarchy is applied:

1. **`DECISION`** (Weight 4): Fundamental architecture, technology choices, and design constraints.
2. **`REQUIREMENT`** (Weight 3): Functional rules, boundaries, and domain invariants.
3. **`CONVENTION`** (Weight 2): Code style, project structure, naming, and patterns.
4. **`BUG_SOLUTION`** (Weight 1): Historical bug resolutions, workarounds, and gotchas.

If priority and type are identical, selection falls back to:
- `updatedAt DESC` (most recently refined)
- `createdAt DESC` (most recently added)
- `id ASC` (lexicographical UUID tie-breaker)

---

## 6. Budget Strategy

The engine enforces strict character budgeting without sacrificing comprehension:

- **Complete Inclusion Principle**: A memory is either included **completely** or excluded **completely**.
- **No Mid-Sentence Cuts**: Memories are never truncated mid-content or appended with ellipses (`...`), which could corrupt code examples or instructions for AI consumers.
- **Greedy Evaluation**: Each sorted candidate memory is tested against the running Markdown document length. If `formattedContext.length <= budget`, the memory is accepted; otherwise, it is skipped.
- **Budget Limits**:
  - `MIN`: 1,000 characters
  - `DEFAULT`: 8,000 characters
  - `MAX`: 50,000 characters

---

## 7. Formatting Strategy

The final output is clean, standard GitHub-flavored Markdown:

```markdown
# Project Context

Project: {projectName}

## Decisions

### Use Prisma ORM

Prisma ORM is the approved database access layer.

---

### Use PostgreSQL on Supabase

Managed PostgreSQL hosted on Supabase without Supabase SDK.

## Requirements

### Project Isolation

All memories must remain strictly scoped to their project.

## Conventions

### API Error Handling

Return standard JSON error envelope with error codes.
```

Rules:
- Sections are only rendered if they contain at least one included memory (no empty headings).
- No database IDs, UUIDs, timestamps, or SHA-256 hashes are rendered into the output.
- If a project contains zero active memories, the engine outputs:
  ```markdown
  # Project Context

  Project: {projectName}

  No active project memory is currently available.
  ```

---

## 8. Determinism

Given the same:
- Project ID
- Active database records
- Budget
- Memory type filters

The Context Assembly Engine will produce the exact same byte-for-byte Markdown context on every invocation. There is zero randomness, no timestamp-based variance, and no nondeterministic LLM generation.

---

## 9. Future Evolution (Post-MVP)

The following capabilities are deferred and will be evaluated in future phases:
- **Semantic Retrieval**: Vector embeddings (e.g. `pgvector`) to retrieve memories based on query similarity.
- **Adaptive Context Budgets**: Dynamic sizing based on LLM token windows (e.g. 128k, 200k, 1M).
- **Model-Specific Tokenization**: Byte-pair encoding tokenizers (e.g., `tiktoken`) for exact token accounting.
- **Relevance Scoring**: Weighting memories by file paths, branch context, or active developer tasks.
- **AI Summarization**: Compacting long memories into concise directives when under extreme token pressure.
