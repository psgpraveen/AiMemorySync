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

/**
 * Configures the global API key used for client-side API requests.
 */
export function setApiKey(key: string | null) {
  globalApiKey = key;
}

/**
 * Retrieves the currently configured global API key.
 */
export function getApiKey(): string | null {
  return globalApiKey;
}

/**
 * Core JSON fetch wrapper that unwraps `{ data: ... }` and maps `{ error: ... }`
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (globalApiKey && !headers["Authorization"] && !headers["authorization"]) {
    headers["Authorization"] = `Bearer ${globalApiKey}`;
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

