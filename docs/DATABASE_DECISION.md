# Database & ORM Decision: AiMemorySync

## 1. Context & Architectural Requirements

AiMemorySync is designed to serve as a shared engineering memory layer. To determine the appropriate database and data-access technology, the system balances **MVP simplicity** with **long-term architectural goals**.

### Core Requirements
1. **Relational Integrity**: Foreign keys, check constraints, unique indices, and atomic transactions.
2. **Next.js 16 Compatibility**: Support for serverless / App Router server actions and API route handlers.
3. **Multi-Client Concurrency**: Ability to handle concurrent queries and mutations from web browsers, IDE plugins, and extensions.
4. **Cloud & Local Deployment**: Frictionless deployment on modern cloud platforms (Vercel, Railway, Fly.io, Supabase, Neon) without container lock-in.
5. **Future Vector Search (Post-MVP)**: Clean upgrade path to dense vector embeddings and cosine similarity search without rewriting schemas or migrating databases.

---

## 2. Database Evaluation: PostgreSQL vs. SQLite

### 2.1 Option A: PostgreSQL *(Approved)*
PostgreSQL is the world's most advanced open-source relational database.

- **Strengths**:
  - **Concurrency & Locking**: Multi-Version Concurrency Control (MVCC) enables high concurrent write throughput without table-level bottlenecks.
  - **Cloud & Serverless Ready**: Native standard across cloud database providers (Supabase, Neon, AWS RDS, Railway, Cloudflare Hyperdrive). Works seamlessly with serverless Next.js App Router.
  - **Vector Roadmap**: `pgvector` is the industry-standard vector search extension, natively supported by cloud Postgres providers. Upgrading to semantic retrieval in Post-MVP requires zero external vector databases.
  - **Rich Constraint System**: Full support for SQL check constraints, generated columns, and partial indices.
- **Trade-offs**:
  - Requires a running PostgreSQL instance or connection string to a cloud database (e.g., Neon/Supabase).

### 2.2 Option B: SQLite
SQLite is a self-contained, serverless, zero-configuration SQL database engine.

- **Strengths**:
  - **Zero Configuration**: Runs as a local file (`aimemorysync.db`). Extremely fast for local standalone development.
  - **Zero Cost**: No external server or connection strings required.
- **Trade-offs**:
  - **Serverless Incompatibility**: Standard Next.js serverless deployments (e.g., Vercel) have ephemeral, read-only filesystems. Local SQLite files cannot persist across serverless invocations unless specialized hosted distributed drivers (e.g., Turso/libsql) are introduced.
  - **Write Concurrency**: Employs database-level file locks on write. Multiple concurrent writes from web extensions and IDE background processes risk `SQLITE_BUSY` contention.
  - **Vector Ecosystem**: SQLite vector extensions (`sqlite-vec`) require native platform-specific binaries and lack widespread managed cloud hosting support.

---

## 3. Database Comparison Matrix

| Evaluation Dimension | PostgreSQL *(Approved)* | SQLite |
|---|---|---|
| **Local Development Setup** | Requires local Postgres or cloud dev instance (Neon/Supabase) | **Instant** (single local file) |
| **Serverless Deployment (Vercel)** | **Native** (Connection pooling / HTTP drivers) | Challenging (Ephemeral filesystem) |
| **Write Concurrency (Multi-Client)** | **High** (Row-level MVCC) | Limited (Database-level write lock) |
| **Multi-User / Multi-Device Sync** | **Native** (Central hub) | Requires custom synchronization protocol |
| **Post-MVP Vector Search** | **Native** (`pgvector` standard) | Complex (Platform-dependent C-extensions) |
| **Relational Integrity & Constraints** | **Complete** | Good, but foreign keys disabled by default |
| **Operational Longevity** | **Industry standard** | Excellent for embedded; limited for distributed hub |

---

## 4. ORM & Query Layer Evaluation

### 4.1 Prisma ORM *(Approved)*
- **Strengths**:
  - **Declarative Schema Modeling**: Models, relations, and attributes are defined cleanly in a readable `schema.prisma` file.
  - **Type Safety & DX**: Generated Prisma Client provides end-to-end TypeScript types that match the exact database schema without manual type mapping.
  - **Robust Migration System**: `prisma migrate` handles declarative migration generation, tracking, and execution with clear drift detection.
  - **Prisma Studio**: Built-in visual interface for inspecting and editing database records during development.
  - **Industry Adoption & Ecosystem**: Exceptional documentation, broad community support, and mature integration with Next.js.
- **Trade-offs**:
  - Query engine binary generation step (`prisma generate`). Handled cleanly via standard npm scripts in modern Next.js setups.

### 4.2 Drizzle ORM *(Historical Evaluation)*
- **Strengths**: Pure TypeScript schema, lightweight runtime with zero binary engine.
- **Decision Context**: Initially evaluated during Phase 3A; prior to implementation, the team revised the selection to Prisma ORM for superior migration tooling, visual data management (Prisma Studio), and developer experience across the full team.

### 4.3 Direct SQL (`pg` / `postgres.js`)
- **Strengths**: Zero abstraction, absolute performance control.
- **Weaknesses**: Zero compile-time type safety; tedious manual mapping of query outputs to TypeScript interfaces; manual migration management.

---

## 5. Architectural Decision: Approved Technology Stack

### Approved Stack: PostgreSQL + Prisma ORM
- **Database**: **PostgreSQL** (Approved via DECISION 013)
  - **Hosting**: Managed PostgreSQL hosted on **Supabase**. Supabase is used strictly as the managed PostgreSQL database provider. No Supabase Auth, Storage, Edge Functions, Realtime, JavaScript client, or SDKs are used.
  - Justification: AiMemorySync is inherently a synchronization system designed to connect web interfaces, browser extensions, and IDE plugins to a shared project memory bank. PostgreSQL natively supports concurrent writes, seamless cloud deployment, transaction pooling, and the `pgvector` extension for future semantic retrieval.
- **ORM / Query Builder**: **Prisma ORM** (Approved via DECISION 014)
  - Justification: Prisma provides an intuitive declarative schema definition (`schema.prisma`), robust migration management, automatic TypeScript type generation, and Prisma Studio for development inspection.
- **Containerization / Docker**: **Deferred / Not used currently**
  - Justification: Managed cloud PostgreSQL connection strings (Supabase) are used; Docker is unnecessary and deferred.

---

## 6. Approved Decisions Summary

- **DECISION 013 (APPROVED)**: PostgreSQL is the primary database (hosted on Supabase).
- **DECISION 014 (APPROVED)**: Prisma ORM is the database access and schema layer.
- **DECISION 015 (APPROVED)**: Restrict the core schema to `Project` and `Memory` (`Project 1 ──< * Memory`).

---

## 7. Implementation Status (Phase 3B Complete)

- Prisma dependencies installed: `@prisma/client@^6.4.1` and `prisma@^6.4.1`.
- Declarative schema configured in `prisma/schema.prisma` with `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`.
- Initial migration `20260903053609_init` created and successfully applied to Supabase PostgreSQL.
- Database client singleton configured in `src/lib/prisma.ts`.
- Deferred: Docker, `pgvector`, multi-workspace tables, user authentication, API routes, UI features.
