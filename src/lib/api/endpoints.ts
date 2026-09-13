/**
 * Centralized API Endpoints Map for AiMemorySync
 * Single source of truth for all API routes across the application.
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    LOGOUT: "/api/auth/logout",
    SESSION: "/api/auth/session",
    VERIFY: "/api/auth/verify",
    KEYS: "/api/auth/keys",
    KEY_REVOKE: (id: string) => `/api/auth/keys/${encodeURIComponent(id)}/revoke`,
    BOOTSTRAP: "/api/auth/bootstrap",
    DEV_BOOTSTRAP: "/api/auth/dev-bootstrap",
    SIGNUP: "/api/auth/signup",
    TENANT: "/api/auth/tenant",
  },
  PROJECTS: {
    LIST: "/api/projects",
    CREATE: "/api/projects",
    DETAIL: (id: string) => `/api/projects/${encodeURIComponent(id)}`,
    RESOLVE: "/api/projects/resolve",
    MEMORIES: (id: string) => `/api/projects/${encodeURIComponent(id)}/memories`,
    CONTEXT: (id: string) => `/api/projects/${encodeURIComponent(id)}/context`,
  },
  MEMORIES: {
    LIST_OR_CREATE: "/api/memories",
    DETAIL: (id: string) => `/api/memories/${encodeURIComponent(id)}`,
    DEPRECATE: (id: string) => `/api/memories/${encodeURIComponent(id)}/deprecate`,
  },
  CONTEXT: {
    GET: "/api/context",
  },
  INTEGRATIONS: {
    TEST: "/api/integrations/test",
    DOWNLOAD: (integrationId: string) =>
      `/api/integrations/${encodeURIComponent(integrationId)}/download`,
  },
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;
