# API Reference: AiMemorySync Core REST API

This document provides complete reference documentation for all implemented REST API endpoints in AiMemorySync.

All API responses use a standard JSON envelope:
- **Success**: `{ "data": ... }`
- **Error**: `{ "error": { "code": string, "message": string, "details"?: unknown } }`

---

## 1. Projects API

### 1.1 List Projects
- **Method**: `GET`
- **URL**: `/api/projects`
- **Purpose**: Retrieve a list of projects, ordered by creation date descending (`createdAt DESC`). By default, returns active projects (`status = ACTIVE`).
- **Query Parameters**:
  - `status` (optional, string): Filter by project status. Allowed values: `ACTIVE`, `ARCHIVED`. Default is `ACTIVE`.
- **Request Body**: None.
- **Success Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
      "name": "AiMemorySync",
      "slug": "aimemorysync",
      "description": "Shared AI memory and context synchronization platform",
      "status": "ACTIVE",
      "createdAt": "2026-09-03T05:36:09.000Z",
      "updatedAt": "2026-09-03T05:36:09.000Z"
    }
  ]
}
```
- **Error Response (400 Bad Request)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid status query parameter: 'UNKNOWN'. Allowed values: ACTIVE, ARCHIVED."
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `400 Bad Request`, `500 Internal Server Error`.

---

### 1.2 Create Project
- **Method**: `POST`
- **URL**: `/api/projects`
- **Purpose**: Create a new project. Automatically generates/normalizes slug if omitted and validates uniqueness.
- **Request Parameters**: None.
- **Request Body**:
```json
{
  "name": "AiMemorySync",
  "slug": "aimemorysync",
  "description": "Shared AI memory platform"
}
```
  - `name` (required, string, 1-100 chars): Display name.
  - `slug` (optional, string, 1-100 chars): URL-safe identifier (alphanumeric and hyphens).
  - `description` (optional, string, max 1000 chars): Description.
- **Success Response (201 Created)**:
```json
{
  "data": {
    "id": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "name": "AiMemorySync",
    "slug": "aimemorysync",
    "description": "Shared AI memory platform",
    "status": "ACTIVE",
    "createdAt": "2026-09-03T05:36:09.000Z",
    "updatedAt": "2026-09-03T05:36:09.000Z"
  }
}
```
- **Error Responses**:
  - **400 Bad Request**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid project input"
  }
}
```
  - **409 Conflict**:
```json
{
  "error": {
    "code": "PROJECT_SLUG_CONFLICT",
    "message": "Project with slug 'aimemorysync' already exists"
  }
}
```
- **Possible HTTP Status Codes**: `201 Created`, `400 Bad Request`, `409 Conflict`, `500 Internal Server Error`.

---

### 1.3 Get Single Project
- **Method**: `GET`
- **URL**: `/api/projects/:id`
- **Purpose**: Retrieve a single project by its UUID.
- **Path Parameters**:
  - `id` (required, string): Valid UUID v4.
- **Request Body**: None.
- **Success Response (200 OK)**:
```json
{
  "data": {
    "id": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "name": "AiMemorySync",
    "slug": "aimemorysync",
    "description": "Shared AI memory platform",
    "status": "ACTIVE",
    "createdAt": "2026-09-03T05:36:09.000Z",
    "updatedAt": "2026-09-03T05:36:09.000Z"
  }
}
```
- **Error Response (404 Not Found)**:
```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project with ID '2694db65-a34d-46c3-9d37-de7b4ccbd3ef' not found"
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`.

---

### 1.4 Update Project
- **Method**: `PATCH`
- **URL**: `/api/projects/:id`
- **Purpose**: Update allowed fields of an existing project.
- **Path Parameters**:
  - `id` (required, string): Valid UUID v4.
- **Request Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```
- **Success Response (200 OK)**:
```json
{
  "data": {
    "id": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "name": "Updated Name",
    "slug": "aimemorysync",
    "description": "Updated description",
    "status": "ACTIVE",
    "createdAt": "2026-09-03T05:36:09.000Z",
    "updatedAt": "2026-09-03T05:40:00.000Z"
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `409 Conflict`, `500 Internal Server Error`.

---

### 1.5 Archive Project
- **Method**: `DELETE`
- **URL**: `/api/projects/:id`
- **Purpose**: Soft-archive a project by setting `status = ARCHIVED`. Does not physically delete records.
- **Path Parameters**:
  - `id` (required, string): Valid UUID v4.
- **Request Body**: None.
- **Success Response (200 OK)**:
```json
{
  "data": {
    "id": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "name": "AiMemorySync",
    "slug": "aimemorysync",
    "description": "Shared AI memory platform",
    "status": "ARCHIVED",
    "createdAt": "2026-09-03T05:36:09.000Z",
    "updatedAt": "2026-09-03T05:42:00.000Z"
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`.

---

## 2. Project-Scoped Memory API

### 2.1 List Project Memories
- **Method**: `GET`
- **URL**: `/api/projects/:projectId/memories`
- **Purpose**: Retrieve memories strictly scoped to the parent project.
- **Guaranteed Ordering**: Deterministically sorted by priority hierarchy (`CRITICAL` -> `HIGH` -> `NORMAL` -> `LOW`), and within identical priority by `updatedAt DESC`.
- **Path Parameters**:
  - `projectId` (required, string): Project UUID v4.
- **Query Parameters**:
  - `status` (optional, string): `ACTIVE`, `DEPRECATED`, `ARCHIVED`.
  - `type` (optional, string): `DECISION`, `REQUIREMENT`, `CONVENTION`, `BUG_SOLUTION`.
  - `priority` (optional, string): `LOW`, `NORMAL`, `HIGH`, `CRITICAL`.
- **Request Body**: None.
- **Success Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "5e2890a4-38e2-4885-9773-865c400ee8a3",
      "projectId": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
      "type": "DECISION",
      "title": "Use Prisma ORM",
      "content": "Prisma ORM is the approved database access layer.",
      "priority": "HIGH",
      "status": "ACTIVE",
      "contentHash": "6f9ce321d334e2c8846c268a8ad30d97bc59d64823297a7836d5cbe984bf418a",
      "createdAt": "2026-09-03T05:36:09.000Z",
      "updatedAt": "2026-09-03T05:36:09.000Z"
    }
  ]
}
```
- **Error Response (404 Not Found)**:
```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project with ID '2694db65-a34d-46c3-9d37-de7b4ccbd3ef' not found"
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`.

---

### 2.2 Create Memory
- **Method**: `POST`
- **URL**: `/api/projects/:projectId/memories`
- **Purpose**: Create a new memory record strictly scoped to the project in the URL path. Calculates deterministic SHA-256 hash and blocks duplicate collision within the project.
- **Security Rule**: The `projectId` is extracted strictly from the URL path. Any conflicting `projectId` in the body is rejected with `400 Bad Request`.
- **Path Parameters**:
  - `projectId` (required, string): Parent project UUID v4.
- **Request Body**:
```json
{
  "type": "DECISION",
  "title": "Use Prisma ORM",
  "content": "Prisma ORM is the approved database access layer.",
  "priority": "HIGH"
}
```
  - `type` (required, enum): `DECISION`, `REQUIREMENT`, `CONVENTION`, `BUG_SOLUTION`.
  - `title` (required, string, 1-200 chars).
  - `content` (required, string, 1-10,000 chars).
  - `priority` (optional, enum): `LOW`, `NORMAL`, `HIGH`, `CRITICAL`. Default is `NORMAL`.
- **Success Response (201 Created)**:
```json
{
  "data": {
    "id": "5e2890a4-38e2-4885-9773-865c400ee8a3",
    "projectId": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "type": "DECISION",
    "title": "Use Prisma ORM",
    "content": "Prisma ORM is the approved database access layer.",
    "priority": "HIGH",
    "status": "ACTIVE",
    "contentHash": "6f9ce321d334e2c8846c268a8ad30d97bc59d64823297a7836d5cbe984bf418a",
    "createdAt": "2026-09-03T05:36:09.000Z",
    "updatedAt": "2026-09-03T05:36:09.000Z"
  }
}
```
- **Error Responses**:
  - **400 Bad Request** (Validation failure or conflicting body `projectId`):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Conflicting projectId: request body projectId does not match route path parameter"
  }
}
```
  - **409 Conflict** (Exact duplicate content hash already exists in this project):
```json
{
  "error": {
    "code": "MEMORY_DUPLICATE",
    "message": "An identical memory already exists in this project"
  }
}
```
- **Possible HTTP Status Codes**: `201 Created`, `400 Bad Request`, `404 Not Found`, `409 Conflict`, `500 Internal Server Error`.

---

## 3. Individual Memory API

### 3.1 Get Single Memory
- **Method**: `GET`
- **URL**: `/api/memories/:id`
- **Purpose**: Retrieve a single memory by its UUID.
- **Path Parameters**:
  - `id` (required, string): Memory UUID v4.
- **Request Body**: None.
- **Success Response (200 OK)**:
```json
{
  "data": {
    "id": "5e2890a4-38e2-4885-9773-865c400ee8a3",
    "projectId": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "type": "DECISION",
    "title": "Use Prisma ORM",
    "content": "Prisma ORM is the approved database access layer.",
    "priority": "HIGH",
    "status": "ACTIVE",
    "contentHash": "6f9ce321d334e2c8846c268a8ad30d97bc59d64823297a7836d5cbe984bf418a",
    "createdAt": "2026-09-03T05:36:09.000Z",
    "updatedAt": "2026-09-03T05:36:09.000Z"
  }
}
```
- **Error Response (404 Not Found)**:
```json
{
  "error": {
    "code": "MEMORY_NOT_FOUND",
    "message": "Memory with ID '5e2890a4-38e2-4885-9773-865c400ee8a3' not found"
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`.

---

### 3.2 Update Memory
- **Method**: `PATCH`
- **URL**: `/api/memories/:id`
- **Purpose**: Update memory fields. Recalculates SHA-256 hash if title, content, or type changes, and blocks collisions.
- **Path Parameters**:
  - `id` (required, string): Memory UUID v4.
- **Request Body**:
```json
{
  "title": "Use Prisma ORM Revised",
  "priority": "CRITICAL"
}
```
- **Success Response (200 OK)**:
```json
{
  "data": {
    "id": "5e2890a4-38e2-4885-9773-865c400ee8a3",
    "projectId": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "type": "DECISION",
    "title": "Use Prisma ORM Revised",
    "content": "Prisma ORM is the approved database access layer.",
    "priority": "CRITICAL",
    "status": "ACTIVE",
    "contentHash": "a82bcf...",
    "createdAt": "2026-09-03T05:36:09.000Z",
    "updatedAt": "2026-09-03T05:45:00.000Z"
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `409 Conflict`, `500 Internal Server Error`.

---

### 3.3 Deprecate Memory
- **Method**: `POST`
- **URL**: `/api/memories/:id/deprecate`
- **Purpose**: Soft-deprecates a memory record by transitioning its status to `DEPRECATED`. Preserves historical context without polluting active queries.
- **Path Parameters**:
  - `id` (required, string): Memory UUID v4.
- **Request Body**: None.
- **Success Response (200 OK)**:
```json
{
  "data": {
    "id": "5e2890a4-38e2-4885-9773-865c400ee8a3",
    "projectId": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "status": "DEPRECATED",
    "updatedAt": "2026-09-03T05:46:00.000Z"
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`.

---

### 3.4 Archive Memory
- **Method**: `DELETE`
- **URL**: `/api/memories/:id`
- **Purpose**: Soft-archive a memory record by transitioning status to `ARCHIVED`. Does not perform physical deletion.
- **Path Parameters**:
  - `id` (required, string): Memory UUID v4.
- **Request Body**: None.
- **Success Response (200 OK)**:
```json
{
  "data": {
    "id": "5e2890a4-38e2-4885-9773-865c400ee8a3",
    "projectId": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "status": "ARCHIVED",
    "updatedAt": "2026-09-03T05:47:00.000Z"
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`.

---

## 4. Context Assembly API

### 4.1 Generate Project Context
- **Method**: `GET`
- **URL**: `/api/projects/:projectId/context`
- **Purpose**: Dynamically assemble a deterministic, token/character-budgeted Markdown AI context block from the project's active memories.
- **Path Parameters**:
  - `projectId` (required, string): Project UUID v4.
- **Query Parameters**:
  - `budget` (optional, integer): Maximum character budget for the generated Markdown context (default: `8000`, min: `1000`, max: `50000`).
  - `types` (optional, string): Comma-separated list of memory types to include (e.g. `types=DECISION,REQUIREMENT`). Allowed types: `DECISION`, `REQUIREMENT`, `CONVENTION`, `BUG_SOLUTION`.
- **Request Body**: None.
- **Ordering & Budget Rules**:
  - Only memories with `status = ACTIVE` are considered. `ARCHIVED` and `DEPRECATED` memories are strictly excluded.
  - Multi-tier selection ordering: Priority (`CRITICAL` -> `HIGH` -> `NORMAL` -> `LOW`), Type (`DECISION` -> `REQUIREMENT` -> `CONVENTION` -> `BUG_SOLUTION`), Recency (`updatedAt DESC`), Creation (`createdAt DESC`), Stable tie-breaker (`id ASC`).
  - Complete inclusion: Memories are either included completely or excluded completely. No partial truncations.
  - Markdown output grouping: Memories are rendered grouped by type (`## Decisions`, `## Requirements`, `## Conventions`, `## Known Bug Solutions`).
- **Success Response (200 OK)**:
```json
{
  "data": {
    "projectId": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "projectName": "AiMemorySync",
    "context": "# Project Context\n\nProject: AiMemorySync\n\n## Decisions\n\n### Use Prisma ORM\n\nPrisma ORM is the approved database access layer.\n\n---\n\n## Requirements\n\n### Project Isolation\n\nAll memories must remain strictly scoped to their project.",
    "includedMemoryCount": 2,
    "excludedMemoryCount": 0,
    "budget": 8000,
    "usedCharacters": 234
  }
}
```
- **Empty Context Response (200 OK)**:
```json
{
  "data": {
    "projectId": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
    "projectName": "AiMemorySync",
    "context": "# Project Context\n\nProject: AiMemorySync\n\nNo active project memory is currently available.",
    "includedMemoryCount": 0,
    "excludedMemoryCount": 0,
    "budget": 8000,
    "usedCharacters": 85
  }
}
```
- **Error Response (400 Bad Request - Invalid Budget)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid context query parameters",
    "details": {
      "formErrors": [],
      "fieldErrors": {
        "budget": [
          "Budget must be at least 1000 characters"
        ]
      }
    }
  }
}
```
- **Error Response (404 Not Found)**:
```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project with ID '2694db65-a34d-46c3-9d37-de7b4ccbd3ef' not found"
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`.

---

## 5. Discovery & Identity Resolution API

### 5.1 Resolve Project Identity
- **Method**: `POST`
- **URL**: `/api/projects/resolve`
- **Purpose**: Automatic project discovery endpoint. Resolves incoming environment signals (Git remote, monorepo subpath, package manifest, workspace digest, or platform session) to an existing Project or automatically provisions a new one.
- **Workflow Role**: This is the **primary production entry point** for IDE plugins, AI agents, and browser extensions.
- **Concurrency Safety**: Enforces database-level unique constraints and transactional collision recovery (`P2002`). Multiple simultaneous requests for the same repository return the exact same canonical project without duplicate creation.
- **Security & Privacy Rules**:
  - Embedded basic-auth tokens or credentials in Git URLs (`https://token@host/...`) are stripped before normalization and hashing.
  - Raw local filesystem paths are hashed (`SHA-256`) and isolated to `localPathDigest`; raw paths are never stored in public identity records.
- **Request Body**:
```json
{
  "signals": {
    "gitRemoteUrl": "git@github.com:AntigravityTeam/AiMemorySync.git",
    "monorepoSubPath": "packages/core",
    "packageManifest": {
      "ecosystem": "npm",
      "name": "@aimemory/core"
    },
    "workspaceName": "AiMemorySync",
    "localPath": "D:/Freelance/AiMemorySync"
  },
  "source": {
    "platform": "VSCODE",
    "externalId": "client-window-123",
    "metadata": {
      "version": "1.0.0"
    }
  }
}
```
  - `signals.gitRemoteUrl` (optional, string, max 500 chars): Raw Git remote URL.
  - `signals.monorepoSubPath` (optional, string, max 255 chars): Root-relative monorepo subfolder.
  - `signals.packageManifest` (optional, object): `ecosystem` (npm, cargo, pypi, go) and `name` (max 200 chars).
  - `signals.workspaceName` (optional, string, max 100 chars): Workspace folder name.
  - `signals.localPath` (optional, string, max 1000 chars): Local folder path (hashed server-side).
  - `source.platform` (required, string, max 50 chars): `VSCODE`, `CURSOR`, `ANTIGRAVITY`, `CHATGPT`, `CLAUDE`, `CLI`, `OTHER`.
  - `source.externalId` (optional, string, max 255 chars): Platform conversation ID or client machine identifier.
  - `source.metadata` (optional, JSON object, max 64KB): Client metadata without secrets.
- **Success Response — Matched Existing Project (200 OK)**:
```json
{
  "data": {
    "project": {
      "id": "2694db65-a34d-46c3-9d37-de7b4ccbd3ef",
      "name": "AiMemorySync",
      "slug": "aimemorysync",
      "description": "Shared AI memory platform",
      "status": "ACTIVE",
      "creationSource": "AUTO_DISCOVERY",
      "createdAt": "2026-09-03T05:36:09.000Z",
      "updatedAt": "2026-09-03T09:10:00.000Z"
    },
    "matchedBy": "GIT_REMOTE",
    "canonicalIdentity": "github.com/antigravityteam/aimemorysync",
    "confidence": 100,
    "isNewlyCreated": false
  }
}
```
- **Success Response — Newly Auto-Provisioned Project (201 Created)**:
```json
{
  "data": {
    "project": {
      "id": "b024fa4a-1906-43b8-be18-670a6a38e070",
      "name": "ai-memory-sync",
      "slug": "ai-memory-sync",
      "description": "Automatically discovered via VSCODE (GIT_REMOTE)",
      "status": "ACTIVE",
      "creationSource": "AUTO_DISCOVERY",
      "createdAt": "2026-09-03T09:11:00.000Z",
      "updatedAt": "2026-09-03T09:11:00.000Z"
    },
    "matchedBy": "GIT_REMOTE",
    "canonicalIdentity": "github.com/antigravityteam/aimemorysync",
    "confidence": 100,
    "isNewlyCreated": true
  }
}
```
- **Error Response (400 Bad Request — Missing Signals)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid project resolution input",
    "details": {
      "formErrors": [],
      "fieldErrors": {
        "signals": [
          "At least one valid identity signal (gitRemoteUrl, packageManifest, workspaceName, localPath, or externalId) must be provided."
        ]
      }
    }
  }
}
```
- **Possible HTTP Status Codes**: `200 OK`, `201 Created`, `400 Bad Request`, `500 Internal Server Error`.

---

## 6. Authentication & API Key Management API

### 6.1 Authentication Overview
All API endpoints require Bearer API Key authentication:
```http
Authorization: Bearer aimem_live_...
```
*(Alternatively, you can pass the header `x-api-key: aimem_live_...`).*

- **Development Anonymous Bypass**: Available only when `NODE_ENV=development` and `ALLOW_DEV_ANONYMOUS_AUTH=true`. Strictly disabled in production.
- **Scope Hierarchy**:
  - `read`: Allows `GET` requests (`/api/projects`, `/api/memories`, `/api/projects/:id/context`).
  - `write`: Allows `POST` and `PATCH` requests (`/api/projects/resolve`, `/api/projects`, `/api/memories`).
  - `admin`: Allows `DELETE` requests (soft-archival) and key management endpoints (`/api/auth/keys`).
- **Rate Limits**:
  - Resolution & Mutations: 60 requests / minute per API key.
  - Context & Reads: 120 requests / minute per API key.

---

### 6.2 Generate API Key
- **Method**: `POST`
- **URL**: `/api/auth/keys`
- **Required Scope**: `admin`
- **Request Body**:
```json
{
  "name": "Work MacBook VS Code",
  "scopes": ["read", "write"],
  "expiresInDays": 90
}
```
- **Success Response (201 Created)**:
```json
{
  "data": {
    "apiKey": {
      "id": "e8903c7e-07a8-444f-801a-85d8d2127209",
      "name": "Work MacBook VS Code",
      "prefix": "aimem_live_",
      "last4": "a1b2",
      "scopes": ["read", "write"],
      "createdAt": "2026-09-03T10:35:00.000Z",
      "updatedAt": "2026-09-03T10:35:00.000Z",
      "lastUsedAt": null,
      "expiresAt": "2026-12-02T10:35:00.000Z",
      "revokedAt": null
    },
    "rawKey": "aimem_live_9f8a2b4c1d6e8f0a2b4c1d6e8f0aa1b2"
  }
}
```
*(Note: `rawKey` is displayed exactly once. Store it in your client's secure OS keychain).*

---

### 6.3 List API Keys
- **Method**: `GET`
- **URL**: `/api/auth/keys`
- **Required Scope**: `admin`
- **Success Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "e8903c7e-07a8-444f-801a-85d8d2127209",
      "name": "Work MacBook VS Code",
      "prefix": "aimem_live_",
      "last4": "a1b2",
      "scopes": ["read", "write"],
      "createdAt": "2026-09-03T10:35:00.000Z",
      "updatedAt": "2026-09-03T10:35:00.000Z",
      "lastUsedAt": "2026-09-03T10:40:00.000Z",
      "expiresAt": "2026-12-02T10:35:00.000Z",
      "revokedAt": null
    }
  ]
}
```

---

### 6.4 Revoke API Key
- **Method**: `POST`
- **URL**: `/api/auth/keys/:id/revoke`
- **Required Scope**: `admin`
- **Success Response (200 OK)**:
```json
{
  "data": {
    "id": "e8903c7e-07a8-444f-801a-85d8d2127209",
    "name": "Work MacBook VS Code",
    "prefix": "aimem_live_",
    "last4": "a1b2",
    "scopes": ["read", "write"],
    "createdAt": "2026-09-03T10:35:00.000Z",
    "updatedAt": "2026-09-03T10:41:00.000Z",
    "lastUsedAt": "2026-09-03T10:40:00.000Z",
    "expiresAt": "2026-12-02T10:35:00.000Z",
    "revokedAt": "2026-09-03T10:41:00.000Z"
  }
}
```



