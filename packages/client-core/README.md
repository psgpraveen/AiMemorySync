# @aimemory/client-core

Platform-independent TypeScript client SDK for **AiMemorySync**.

## Features

- **Zero Production Runtime Dependencies**: Pure TypeScript using standard web APIs (`fetch`, `AbortController`, `Headers`).
- **Pluggable Platform Adapters**: Decoupled `SecureStorageAdapter`, `CacheAdapter`, `LoggerAdapter`.
- **Automatic Discovery & Resolution**: First-class support for `POST /api/projects/resolve`.
- **Context Assembly Engine**: Structured token/character budget retrieval for AI prompt injection.
- **Resilient Transport**: Automatic retry with exponential backoff and jitter for safe read operations, and 429 `Retry-After` handling.
- **Typed Error Hierarchy**: `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `ValidationError`, `RateLimitError`, `NetworkError`, `TimeoutError`.
- **Typed Event Bus**: Colon-separated namespaced events (`project:resolved`, `memory:created`, `auth:unauthorized`, etc.).

## Quick Start

```typescript
import { AiMemoryClient, EphemeralStorageAdapter } from "@aimemory/client-core";

const client = new AiMemoryClient({
  baseUrl: "https://api.yourdomain.com",
  apiKey: "aimem_live_...",
  platform: "VSCODE",
  storage: new EphemeralStorageAdapter(),
});

// 1. Resolve active workspace
const resolution = await client.projects.resolve({
  signals: {
    gitRemoteUrl: "git@github.com:antigravityteam/aimemorysync.git",
    workspaceName: "AiMemorySync",
  },
  source: {
    platform: "VSCODE",
  },
});

// 2. Fetch formatted context for AI prompts
const context = await client.context.get(resolution.project.id, {
  budget: 8000,
});

// 3. Create a memory
await client.memories.create(resolution.project.id, {
  type: "DECISION",
  title: "Client-Core Architecture",
  content: "Use @aimemory/client-core across all IDE extensions.",
  priority: "HIGH",
});
```
