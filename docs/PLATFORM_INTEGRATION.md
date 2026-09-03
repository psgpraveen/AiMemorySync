# Platform Integration Architecture: AiMemorySync

## 1. Overview & Decoupling Philosophy
AiMemorySync is fundamentally platform-agnostic. It does not embed platform-specific business logic or assumptions about proprietary external LLMs inside its core memory and retrieval engines.

Instead, the system employs the **Adapter Design Pattern**. An abstract, standardized platform adapter interface decouples the AiMemorySync Core from the divergent interaction models, DOM trees, APIs, and token conventions of external providers such as ChatGPT, Claude, Antigravity, and Gemini.

```text
               ┌──────────────────────────────┐
               │    AiMemorySync Core API     │
               └──────────────▲───────────────┘
                              │
               ═══════════════╪════════════════ (Standard Interface)
                              │
               ┌──────────────┴───────────────┐
               │    Platform Adapter Layer    │
               └──────┬───────┬───────┬───────┘
                      │       │       │
         ┌────────────┘       │       └────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ ChatGPT Adapter │  │  Claude Adapter │  │ Antigravity     │
│ (Proposed)      │  │  (Proposed)     │  │ (Verified Files)│
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 2. Standard Adapter Interface Specification

Every platform connector conceptually implements a standardized lifecycle contract:

```typescript
// Conceptual Interface Specification
interface PlatformAdapter {
  readonly platformId: string;
  readonly platformName: string;
  readonly adapterVersion: string;

  // 1. Session & Environment Discovery
  detectEnvironment(): Promise<EnvironmentInfo>;
  resolveActiveProject(env: EnvironmentInfo): Promise<ProjectIdentifier | null>;

  // 2. Capability Introspection
  getCapabilities(): PlatformCapabilities;

  // 3. Extraction (Ingestion)
  extractCandidateMemory(rawInteraction: unknown): Promise<MemoryCandidate[]>;

  // 4. Delivery (Context Retrieval & Injection)
  formatContextForPrompt(context: AssembledContext): FormattedPromptBlock;
  injectContext(formattedBlock: FormattedPromptBlock): Promise<InjectionResult>;

  // 5. Lifecycle & Error Management
  handleError(error: PlatformError): Promise<RecoveryAction>;
}
```

### Interface Methods Breakdown
- `detectEnvironment()`: Identifies the active platform, user session, host URL or IDE window, and input accessibility.
- `resolveActiveProject()`: Determines which codebase/project the current interaction relates to (via repository root, file paths, or user workspace binding).
- `getCapabilities()`: Returns supported features (e.g., automated prompt prefixing, DOM mutation, background webhooks, token limits).
- `extractCandidateMemory()`: Parses incoming conversational turns into candidate memory records.
- `formatContextForPrompt()`: Adapts raw memory records into the model's preferred syntax (Markdown blocks, system instructions, or XML tags).
- `injectContext()`: Introduces the context into the active user turn or agent scratchpad.

---

## 3. Platform Capabilities & Rigorous Verification Matrix

Different platforms expose drastically different integration surfaces. AiMemorySync strictly classifies capabilities based on verified reality:

| Capability Area | ChatGPT (Web) | Antigravity IDE | Claude (Web) | Gemini (Web / API) |
|---|---|---|---|---|
| **Primary Integration Vehicle** | Proposed (Browser Extension) | **Verified** (Local Workspace Files & Rules) | Proposed (Browser Extension) | Proposed (Browser Extension / API) |
| **Active Project Resolution** | Proposed (Manual prompt selection / Tab metadata) | **Verified** (Root workspace folder) | Proposed (Manual prompt selection / Tab metadata) | Proposed (Manual selection) |
| **DOM Inspection for Capture** | Unknown / Requires Validation | Not Applicable (Direct Filesystem) | Unknown / Requires Validation | Unknown / Requires Validation |
| **Direct DOM Prompt Injection** | Unknown / Requires Validation (Synthetic events) | **Verified** (Local rules / Markdown injection) | Unknown / Requires Validation (Synthetic events) | Unknown / Requires Validation |
| **Clipboard / Manual Fallback** | **Verified** (Universal standard) | **Verified** (Standard filesystem/clipboard) | **Verified** (Universal standard) | **Verified** (Universal standard) |
| **Token Limit Introspection** | Unknown / Requires Validation | Proposed (Local agent config) | Unknown / Requires Validation | Unknown / Requires Validation |
| **Background Sync Capability** | Proposed (Tab-limited) | **Verified** (Background agent daemon) | Proposed (Tab-limited) | Proposed (Tab-limited) |
| **Private Internal Memory Access** | **None** (Explicit boundary) | **None** (Explicit boundary) | **None** (Explicit boundary) | **None** (Explicit boundary) |
| **Automated Webhook Ingestion** | Unknown / Requires Validation | Proposed (Local HTTP hook) | Unknown / Requires Validation | Unknown / Requires Validation |

---

## 4. Platform Adapter Implementations & Evaluation

### 4.1 ChatGPT Adapter
- **Status**: *Proposed (Post-MVP)*.
- **Concept**: Operates via a Manifest V3 browser extension on `chatgpt.com`.
- **Unknowns / Requires Validation**:
  - OpenAI frequently modifies its DOM class names, nested React container structure, and synthetic event listeners.
  - Automated input field mutation may fail to trigger React state updates or may trigger site security protections.
- **Safe Fallback**: Copy-to-clipboard or user-triggered insertion.

### 4.2 Antigravity IDE Adapter
- **Status**: **Verified (MVP Baseline)**.
- **Concept**: Local workspace integration where AiMemorySync generates structured memory files (e.g., in `.antigravity/` and `.agents/rules/`) that the coding assistant natively ingests.
- **Advantage**: Zero brittle DOM dependencies, 100% reliable filesystem access, and deterministic project boundaries.

### 4.3 Claude Adapter
- **Status**: *Proposed (Post-MVP)*.
- **Concept**: Browser extension for `claude.ai` web interface.
- **Prompt Formatting**: Uses structured XML tags (`<project_context>...</project_context>`), which Claude adheres to strongly.
- **Unknowns / Requires Validation**:
  - React synthetic input event handling on `claude.ai`.
  - DOM structure longevity.

### 4.4 Gemini Adapter
- **Status**: *Unknown / Requires Validation*.
- **Concept**: WebExtension or direct API integration.
- **Current Assessment**: DOM stability and API extension capabilities are unverified. Baseline integration relies on manual clipboard context pasting until technical feasibility is proven through prototyping.

---

## 5. Permission Boundaries & Sandbox Limits
1. **No Proprietary Access**: AiMemorySync never attempts to read private platform weights, proprietary training data, or platform-internal user memories.
2. **Origin Isolation**: Browser extensions adhere to strict `Content Security Policy` (CSP) and Manifest V3 host permissions. Content scripts execute only on approved domains.
3. **User Confirmation for Outbound Text**: Any text injected into an external platform's prompt input is clearly demarcated and remains editable by the user prior to submission.

---

## 6. Resilience & Failure Handling
- **DOM Mutation Failures**: When web platform interfaces update their CSS classes or DOM hierarchy, the adapter emits a graceful degradation notice: *"Auto-injection unavailable; context copied to clipboard."*
- **Non-Blocking Execution**: Connectors enforce a configurable timeout on background queries. If the backend is slow or unreachable, developer interactions proceed uninterrupted without context rather than blocking the UI.
- **Malformed Payloads**: If an external platform emits an unexpected message structure, the adapter safely logs an ingestion warning without crashing the client extension.
