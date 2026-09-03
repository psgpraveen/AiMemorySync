# Security Architecture: AiMemorySync

## 1. Core Security Tenets & Threat Model
AiMemorySync sits at the nexus between developers, proprietary source code, and third-party AI platforms. Because memory often captures architectural trade-offs, configuration patterns, and system design, security and privacy are first-class engineering requirements.

The architecture enforces five fundamental tenets:
1. **Zero Silent Capture**: No conversational data or project files are ever captured, transmitted, or indexed without explicit user knowledge and consent.
2. **Strict Project Isolation**: Context and memory are partitioned strictly by workspace and project; cross-project data leakage is architecturally prohibited.
3. **Defense-in-Depth Sanitization**: Secrets, API keys, and sensitive tokens are identified and scrubbed before persisting to disk or database.
4. **User Ownership & Sovereignty**: Users retain absolute ownership of their data, including the right to inspect, edit, export, or permanently purge all memories.
5. **Least Privilege**: Extensions, client adapters, and API endpoints run with the minimal permissions necessary to execute their function.

---

## 2. User Consent & Capture Governance

### 2.1 Explicit User Consent
External AI platform interactions must never be recorded passively in the background. AiMemorySync enforces explicit user consent through three mechanisms:
- **Command-Driven Capture**: Users trigger capture intentionally using explicit syntax (e.g., `@sync`, `/remember`, or keyboard shortcuts).
- **Interactive Review Modal**: When automated candidate extraction is enabled, the browser extension or IDE plugin displays a non-intrusive preview of extracted items for one-click approval before ingestion.
- **Domain & Workspace Whitelisting**: Connectors only execute on domains explicitly enabled by the user in settings (e.g., `chatgpt.com`, `claude.ai`).

### 2.2 Visual Status Indicators
Whenever a client adapter is actively connected to an AI session, the UI displays a visible badge (e.g., *"AiMemorySync Active: Project Foo"*). When disabled or disconnected, all DOM listeners and listeners are dormant.

---

## 3. Data Ownership & Privacy

- **Data Ownership**: The user and their designated organization own 100% of the structured memories, conversation logs, and contextual embeddings.
- **No Third-Party Model Training**: AiMemorySync never sells, shares, or utilizes user data to train public foundation models.
- **Right to be Forgotten**: When a project or memory is deleted by the user, all associated relational rows, historical version entries, and vector embeddings are irrevocably purged.

---

## 4. Multi-Tenant & Project Isolation

To prevent intellectual property cross-contamination:
- **Tenant Boundary**: Every database query is scoped by `workspace_id`. Cross-workspace querying is impossible at the data-access layer.
- **Project Partitioning**: Memories belong to a specific `project_id`. The Context Retrieval Engine filters all vector similarity searches with a mandatory metadata predicate: `project_id == active_project_id`.
- **Global Memory Access**: Global user memories (e.g., coding preferences) are strictly tagged as `USER_GLOBAL` and cannot access proprietary project-specific entries.

```text
[User Account]
   └── [Workspace: Acme Corp] (Tenant Barrier)
         ├── [Project A: Backend API] ──► Isolated Memory Bank A
         └── [Project B: Mobile App]  ──► Isolated Memory Bank B
             (Cross-project access strictly prohibited)
```

---

## 5. Conceptual Authentication & Authorization

### 5.1 Authentication Concept
- **Web Application**: Session-based authentication using secure, HTTP-only, SameSite cookies.
- **API & Client Adapters**: Cryptographically secure Personal Access Tokens (PATs) or short-lived OAuth 2.0 / JWT tokens with specific scopes (e.g., `memory:read`, `memory:write`).
- **Device Registration**: Client devices (workstations, browser profiles) are registered to the user account with revocable device keys.

### 5.2 Authorization Concept (RBAC)
Workspaces support standard role-based access control:
- **Admin**: Manage workspace members, billing, platform connections, and global retention policies.
- **Contributor / Member**: Read and write memories within assigned projects; curate memories.
- **Viewer**: Read-only access to project context; cannot create, mutate, or delete memories.

---

## 6. Data Minimization & Secret Scrubbing

### 6.1 Pre-Flight Client-Side Scrubbing
Before candidate memories leave the developer's machine:
- Regular expression patterns scan for high-entropy tokens, AWS keys, GitHub PATs, private keys (`-----BEGIN PRIVATE KEY-----`), JWTs, and database URLs (`postgres://...`).
- Detected secrets are redacted locally (`[REDACTED_SECRET]`) prior to network transmission.

### 6.2 Server-Side Ingestion Validation
The API ingestion pipeline runs a secondary secret scanner and PII detector. If an unredacted secret is detected, the ingestion request is rejected with a validation error, preventing accidental disk or database persistence.

---

## 7. Client & Browser Extension Security

- **Manifest V3 Compliance**: The browser extension uses modern Manifest V3 architecture with isolated service workers and declarative content scripts.
- **Restricted Host Permissions**: Host permissions are strictly restricted to verified AI platform URLs (`https://chatgpt.com/*`, `https://claude.ai/*`).
- **No Dynamic Code Evaluation**: Code evaluation (`eval()`, `new Function()`) is prohibited by strict Content Security Policies (CSP).
- **Secure Local Storage**: Any local candidate queue is stored in sandboxed browser extension storage (`chrome.storage.local`) and encrypted where applicable.

---

## 8. API & Network Security

- **Transport Encryption**: All communication between clients, adapters, and the AiMemorySync backend requires TLS 1.3.
- **CORS Policy**: Restrictive Cross-Origin Resource Sharing allowlists ensure only authorized frontend applications and browser extension origins can communicate with API endpoints.
- **Rate Limiting & Abuse Prevention**: Per-user and per-token rate limits prevent automated scraping, resource exhaustion, or denial-of-service attempts.
- **Input Validation**: Strict JSON schema validation on every API endpoint rejects malformed, oversized, or unexpected payload structures.

---

## 9. Future Remote Agent & PC Control Security Concepts

In future phases where remote coding agents or PC control features are evaluated:
- **Zero-Trust Network Tunneling**: Agents communicate only over mutual TLS (mTLS) or end-to-end encrypted tunnels.
- **Human-In-The-Loop Approval**: Destructive actions (e.g., executing shell commands, file deletions, pushing to git remotes) require affirmative human confirmation.
- **Strict Command Allowlisting**: Dangerous administrative operations are denied by default.
