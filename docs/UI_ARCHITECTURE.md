# UI Architecture: Phase 4A Basic Functional Web UI

## 1. Overview

Phase 4A introduces the first minimal, developer-oriented web interface for AiMemorySync. The goal is to provide a clean, reliable, and functional dashboard allowing developers to view, create, edit, deprecate, and archive projects and their associated memories.

---

## 2. Page Routes

| Route | File Path | Purpose |
| :--- | :--- | :--- |
| `/` | `src/app/page.tsx` | Minimal landing page with overview and link to `/projects`. |
| `/projects` | `src/app/projects/page.tsx` | Project dashboard listing all active projects, with creation modal. |
| `/projects/[id]` | `src/app/projects/[id]/page.tsx` | Project detail page displaying project metadata, actions (Edit/Archive), and the list of project memories. Handles 404 for invalid/missing projects. |

---

## 3. Component Hierarchy

```text
src/
├── app/
│   ├── page.tsx                    # Landing Page (Server Component)
│   │   └── Navbar
│   ├── projects/
│   │   ├── page.tsx                # Projects List Page (Server Component)
│   │   │   ├── Navbar
│   │   │   └── ProjectList         # (Client Component)
│   │   │       ├── ProjectCard (repeated)
│   │   │       ├── Modal
│   │   │       │   └── ProjectForm (Create Mode)
│   │   │       ├── LoadingState / SkeletonCard
│   │   │       ├── EmptyState
│   │   │       └── ErrorState
│   │   └── [id]/
│   │       └── page.tsx            # Project Detail Page (Server Component)
│   │           ├── Navbar
│   │           └── ProjectDetailView   # (Client Component)
│   │               ├── Project Details Banner (Edit / Archive buttons with confirmation)
│   │               ├── Modal
│   │               │   └── ProjectForm (Edit Mode)
│   │               └── MemoryList
│   │                   ├── MemoryCard (repeated: Edit / Deprecate / Archive actions with confirmation)
│   │                   ├── Modal (Create Memory)
│   │                   │   └── MemoryForm
│   │                   ├── Modal (Edit Memory)
│   │                   │   └── MemoryForm
│   │                   ├── LoadingState / SkeletonCard
│   │                   ├── EmptyState
│   │                   └── ErrorState
```

---

## 4. API Integration Mapping

The frontend communicates with the backend exclusively via `src/lib/api-client.ts`, which makes standard HTTP `fetch` requests to existing REST API endpoints:

| UI Component | Action | HTTP Method | REST Endpoint |
| :--- | :--- | :---: | :--- |
| `ProjectList` | Fetch active projects | `GET` | `/api/projects?status=ACTIVE` |
| `ProjectForm` (Create) | Create new project | `POST` | `/api/projects` |
| `ProjectDetailPage` | Fetch project details | `GET` | `/api/projects/:id` |
| `ProjectForm` (Edit) | Update project fields | `PATCH` | `/api/projects/:id` |
| `ProjectDetailPage` | Archive project | `DELETE` | `/api/projects/:id` |
| `MemoryList` | Fetch project memories | `GET` | `/api/projects/:id/memories` |
| `MemoryForm` (Create) | Create memory | `POST` | `/api/projects/:id/memories` |
| `MemoryForm` (Edit) | Update memory | `PATCH` | `/api/memories/:id` |
| `MemoryCard` | Deprecate memory | `POST` | `/api/memories/:id/deprecate` |
| `MemoryCard` | Archive memory | `DELETE` | `/api/memories/:id` |

---

## 5. Client / Server Boundary

AiMemorySync strictly enforces architectural separation between client presentation and domain logic:

```text
Browser React UI Components
             │ (JSON HTTP Requests)
             ▼
      src/lib/api-client.ts
             │
             ▼
Next.js App Router Route Handlers (src/app/api/*)
             │
             ▼
   Zod Validation Schemas (src/validations/*)
             │
             ▼
   Domain Services (src/services/*)
             │
             ▼
   Prisma ORM Client Singleton (src/lib/prisma.ts)
             │
             ▼
  Managed PostgreSQL Database (Supabase Hosting)
```

### Strict Client Boundaries:
1. **No Database Access**: Client components never import Prisma, execute SQL queries, or access database credentials.
2. **No Duplicated Business Logic**: Duplicate memory detection, title/content normalization, SHA-256 hash generation, priority weighting, and soft-delete transitions execute exclusively on the server.
3. **Error Normalization**: Domain errors (`ValidationError`, `NotFoundError`, `ConflictError`) are mapped to clean HTTP status codes (400, 404, 409) and parsed by `api-client.ts` as typed `ApiError` instances. Raw database errors and stack traces are never exposed to the client.

---

## 6. State Management Approach

- **Zero External State Libraries**: Uses standard React hooks (`useState`, `useEffect`, `useCallback`). No Redux, Zustand, React Query, or external state libraries are introduced.
- **Local Reactive Synchronization**: When a project or memory is created, updated, deprecated, or archived, the corresponding parent list updates its local React state without requiring a destructive full-page reload.
- **React 19 Concurrency Compliance**: Data-fetching effects use non-cascading asynchronous resolution patterns with unmount flags, preventing React 19 `set-state-in-effect` warnings.
