import type {
  Project,
  Memory,
  ProjectStatus,
  MemoryType,
  MemoryPriority,
  MemoryStatus,
} from "@prisma/client";

/**
 * Standard client-side API error thrown when a REST endpoint returns !response.ok
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string = "INTERNAL_ERROR",
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let globalApiKey: string | null = null;
let verificationCache: { key: string; result: VerifyApiKeyResponse; expiresAt: number } | null = null;

/**
 * Configures the global API key used for client-side API requests and persists it to browser storage.
 */
export function setApiKey(key: string | null) {
  verificationCache = null;
  globalApiKey = key ? key.trim() : null;
  if (typeof window !== "undefined") {
    try {
      if (globalApiKey) {
        localStorage.setItem("aimemory_api_key", globalApiKey);
      } else {
        localStorage.removeItem("aimemory_api_key");
      }
    } catch {
      // Ignore storage errors in restricted browser contexts
    }
  }
}

/**
 * Retrieves the currently configured global API key from memory or browser storage.
 */
export function getApiKey(): string | null {
  if (globalApiKey) {
    return globalApiKey;
  }
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("aimemory_api_key");
      if (stored) {
        globalApiKey = stored.trim();
        return globalApiKey;
      }
    } catch {
      // Ignore storage errors in restricted browser contexts
    }
  }
  return null;
}

/**
 * Core JSON fetch wrapper that unwraps `{ data: ... }` and maps `{ error: ... }`
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const key = getApiKey();
  if (key && !headers["Authorization"] && !headers["authorization"]) {
    headers["Authorization"] = `Bearer ${key}`;
  }


  const response = await fetch(path, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errorPayload = json?.error;
    throw new ApiError(
      errorPayload?.message || `Request failed with status ${response.status}`,
      response.status,
      errorPayload?.code || "INTERNAL_ERROR",
      errorPayload?.details
    );
  }

  return json.data as T;
}


// ----------------------------------------------------
// Project API Client
// ----------------------------------------------------

export interface CreateProjectPayload {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  slug?: string;
  description?: string;
  status?: ProjectStatus;
}

export async function getProjects(status = "ACTIVE"): Promise<Project[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<Project[]>(`/api/projects${query}`, { method: "GET" });
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/api/projects/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export async function createProject(
  payload: CreateProjectPayload
): Promise<Project> {
  return request<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProject(
  id: string,
  payload: UpdateProjectPayload
): Promise<Project> {
  return request<Project>(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function archiveProject(id: string): Promise<Project> {
  return request<Project>(`/api/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ----------------------------------------------------
// Memory API Client
// ----------------------------------------------------

export interface CreateMemoryPayload {
  type: MemoryType;
  title: string;
  content: string;
  priority?: MemoryPriority;
}

export interface UpdateMemoryPayload {
  title?: string;
  content?: string;
  type?: MemoryType;
  priority?: MemoryPriority;
  status?: MemoryStatus;
}

export interface ListMemoriesQuery {
  status?: MemoryStatus;
  type?: MemoryType;
  priority?: MemoryPriority;
}

export async function getProjectMemories(
  projectId: string,
  filters?: ListMemoriesQuery
): Promise<Memory[]> {
  const searchParams = new URLSearchParams();
  if (filters?.status) searchParams.set("status", filters.status);
  if (filters?.type) searchParams.set("type", filters.type);
  if (filters?.priority) searchParams.set("priority", filters.priority);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return request<Memory[]>(
    `/api/projects/${encodeURIComponent(projectId)}/memories${query}`,
    { method: "GET" }
  );
}

export async function createMemory(
  projectId: string,
  payload: CreateMemoryPayload
): Promise<Memory> {
  return request<Memory>(
    `/api/projects/${encodeURIComponent(projectId)}/memories`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function getMemory(id: string): Promise<Memory> {
  return request<Memory>(`/api/memories/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export async function updateMemory(
  id: string,
  payload: UpdateMemoryPayload
): Promise<Memory> {
  return request<Memory>(`/api/memories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deprecateMemory(id: string): Promise<Memory> {
  return request<Memory>(`/api/memories/${encodeURIComponent(id)}/deprecate`, {
    method: "POST",
  });
}

export async function archiveMemory(id: string): Promise<Memory> {
  return request<Memory>(`/api/memories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ----------------------------------------------------
// Project Discovery & Resolution API Client
// ----------------------------------------------------

export interface ResolveProjectPayload {
  signals: {
    gitRemoteUrl?: string;
    monorepoSubPath?: string;
    packageManifest?: {
      ecosystem: string;
      name: string;
    };
    workspaceName?: string;
    localPath?: string;
  };
  source: {
    platform: string;
    externalId?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface ResolveProjectResponse {
  project: Project;
  matchedBy: string;
  canonicalIdentity: string;
  confidence: number;
  isNewlyCreated: boolean;
}

export async function resolveProject(
  payload: ResolveProjectPayload
): Promise<ResolveProjectResponse> {
  return request<ResolveProjectResponse>("/api/projects/resolve", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ----------------------------------------------------
// Authentication & API Key Management API Client
// ----------------------------------------------------

export interface ApiKeyDto {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

export interface VerifyApiKeyResponse {
  valid: boolean;
  key: ApiKeyDto;
}

export interface CreateApiKeyPayload {
  name: string;
  scopes?: string[];
  expiresInDays?: number;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKeyDto;
  rawKey: string;
}

export async function verifyApiKey(key?: string): Promise<VerifyApiKeyResponse> {
  const targetKey = (key || getApiKey() || "").trim();
  const now = Date.now();

  // Return cached verification result if valid within last 60 seconds
  if (
    verificationCache &&
    verificationCache.key === targetKey &&
    verificationCache.expiresAt > now
  ) {
    return verificationCache.result;
  }

  const headers: Record<string, string> = {};
  if (targetKey) {
    headers["Authorization"] = `Bearer ${targetKey}`;
  }

  const result = await request<VerifyApiKeyResponse>("/api/auth/verify", {
    method: "GET",
    headers,
  });

  if (result.valid) {
    verificationCache = {
      key: targetKey,
      result,
      expiresAt: now + 60_000,
    };
  }

  return result;
}

export async function bootstrapApiKey(): Promise<CreateApiKeyResponse> {
  return request<CreateApiKeyResponse>("/api/auth/bootstrap", {
    method: "POST",
  });
}

export async function listApiKeys(): Promise<ApiKeyDto[]> {
  return request<ApiKeyDto[]>("/api/auth/keys", {
    method: "GET",
  });
}

export async function createApiKey(
  payload: CreateApiKeyPayload
): Promise<CreateApiKeyResponse> {
  return request<CreateApiKeyResponse>("/api/auth/keys", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeApiKey(id: string): Promise<ApiKeyDto> {
  return request<ApiKeyDto>(`/api/auth/keys/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
  });
}

// ----------------------------------------------------
// Integration Connection Testing Client
// ----------------------------------------------------

export interface TestIntegrationPayload {
  integration: string;
  apiKey?: string;
}

export interface TestIntegrationResponse {
  success: boolean;
  message: string;
  checks: {
    apiReachable: boolean;
    apiKeyValid: boolean;
    scopesValid: boolean;
    mcpReady: boolean;
  };
  details?: Record<string, unknown>;
}

export async function testIntegration(
  payload: TestIntegrationPayload
): Promise<TestIntegrationResponse> {
  return request<TestIntegrationResponse>("/api/integrations/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


