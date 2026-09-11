# AiMemorySync Documentation Hub

> Authoritative technical blueprints, architectural decision records (ADRs), security models, and phase delivery reports for **AiMemorySync**, architected by **PSG Praveen** (`@psgpraveen`).

---

## 📚 Core Architectural Blueprints

| Document | Description |
| :--- | :--- |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | End-to-end system design, subsystem boundaries, and data flow. |
| **[API_REFERENCE.md](API_REFERENCE.md)** | Comprehensive REST API specification for auth, projects, context, and memories. |
| **[AUTOMATIC_PROJECT_DISCOVERY.md](AUTOMATIC_PROJECT_DISCOVERY.md)** | The 3-tier deterministic workspace resolution algorithm (Git remote &rarr; Manifest &rarr; Tree hash). |
| **[CONTEXT_ENGINE.md](CONTEXT_ENGINE.md)** | Deterministic token-budget context synthesis, prioritization weighting, and Markdown generation. |
| **[MEMORY_ARCHITECTURE.md](MEMORY_ARCHITECTURE.md)** | Memory classification (`DECISION`, `REQUIREMENT`, `CONVENTION`, `BUG_SOLUTION`), priorities, and hashing. |
| **[DATA_MODEL.md](DATA_MODEL.md)** | Relational database schema, entity-relationship diagrams, and Prisma models. |
| **[DATA_FLOW.md](DATA_FLOW.md)** | Step-by-step lifecycle from client workspace detection to AI assistant prompt injection. |
| **[DATABASE_DECISION.md](DATABASE_DECISION.md)** | Evaluation of database candidates and rationale for managed PostgreSQL on Supabase. |
| **[DECISIONS.md](DECISIONS.md)** | Architectural Decision Records (ADRs) documenting core technical trade-offs. |
| **[SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md)** | Zero-trust threat model, SHA-256 hashed Bearer tokens, and pre-flight anti-poisoning scans. |
| **[UI_ARCHITECTURE.md](UI_ARCHITECTURE.md)** | The Clean Pure White & Radiant Ambient Mesh design system guidelines. |

---

## 🔌 Integration & Operations Guides

| Document | Description |
| :--- | :--- |
| **[EXTENSION_RELEASE_AND_UPDATE_GUIDE.md](EXTENSION_RELEASE_AND_UPDATE_GUIDE.md)** | SemVer release engine, quality gate enforcement, and native marketplace auto-update strategy. |
| **[PLATFORM_INTEGRATION.md](PLATFORM_INTEGRATION.md)** | Guide for connecting Antigravity IDE, VS Code, Cursor, Claude Desktop, and ChatGPT. |

---

## 🏁 Phase Implementation Plans & Delivery Reports

### Phase 5A: Project Discovery
- **[PHASE_5A_AUTO_DISCOVERY_IMPLEMENTATION_PLAN.md](PHASE_5A_AUTO_DISCOVERY_IMPLEMENTATION_PLAN.md)**

### Phase 5B: Client Core & VS Code Extension
- **[PHASE_5B_CLIENT_INTEGRATION_PLAN.md](PHASE_5B_CLIENT_INTEGRATION_PLAN.md)**: Overarching roadmap.
- **[PHASE_5B0_AUTH_SECURITY_IMPLEMENTATION_PLAN.md](PHASE_5B0_AUTH_SECURITY_IMPLEMENTATION_PLAN.md)**: Auth & security token implementation.
- **[PHASE_5B1_CLIENT_CORE_SDK_IMPLEMENTATION_PLAN.md](PHASE_5B1_CLIENT_CORE_SDK_IMPLEMENTATION_PLAN.md)**: Zero-dependency SDK implementation.
- **[PHASE_5B2_VSCODE_EXTENSION_IMPLEMENTATION_PLAN.md](PHASE_5B2_VSCODE_EXTENSION_IMPLEMENTATION_PLAN.md)**: Native VS Code extension implementation.
- **[PHASE_5B3_RUNTIME_INTEGRATION_VERIFICATION_REPORT.md](PHASE_5B3_RUNTIME_INTEGRATION_VERIFICATION_REPORT.md)**: Live verification report.
- **[PHASE_5B3_E2E_PACKAGING_REPORT.md](PHASE_5B3_E2E_PACKAGING_REPORT.md)**: Extension bundle audit report.

### Phase 5C: Pilot, MCP Server & Onboarding Experience
- **[PHASE_5C0_REAL_WORLD_PILOT_AUDIT.md](PHASE_5C0_REAL_WORLD_PILOT_AUDIT.md)**: Real-world pilot verification.
- **[PHASE_5C1_MCP_ANTIGRAVITY_IMPLEMENTATION_PLAN.md](PHASE_5C1_MCP_ANTIGRAVITY_IMPLEMENTATION_PLAN.md)**: Universal MCP server plan.
- **[PHASE_5C1_MCP_ANTIGRAVITY_IMPLEMENTATION_REPORT.md](PHASE_5C1_MCP_ANTIGRAVITY_IMPLEMENTATION_REPORT.md)**: MCP server and Antigravity plugin report.
- **[PHASE_5C2_INTEGRATION_ONBOARDING_UI_REPORT.md](PHASE_5C2_INTEGRATION_ONBOARDING_UI_REPORT.md)**: Guided wizard and onboarding UI report.
