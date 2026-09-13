import type {
  Project,
  Memory,
  ProjectStatus,
  MemoryType,
  MemoryPriority,
  MemoryStatus,
} from "@prisma/client";
import { API_ENDPOINTS } from "./api/endpoints";

// Re-export centralized API_ENDPOINTS so callers can import from either @/lib/api-client or @/lib/api/endpoints
export { API_ENDPOINTS, type ApiEndpoints } from "./api/endpoints";

// ============================================================================
// 1. ERROR HANDLING
// ============================================================================

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

// ============================================================================
// 2. TOKEN MANAGEMENT & AUTHENTICATION
//
// AiMemorySync Dual-Token System:
// 1. Human Session Token (Browser):
//    - Cookie: `aimem_session` (HttpOnly, SameSite=Lax, Secure in production).
//    - Forwarded automatically by the browser with every request.
// 2. Machine Bearer API Key Token (AI Agents / Tools):
//    - Token: `aimem_live_...` or developer Bearer secret token.
//    - Stored: In memory (`globalApiKey`) and browser storage (`aimemory_api_key`).
//    - Transmission: Automatically injected via `getAuthHeaders()` into the
//      `Authorization: Bearer <token>` header for all API requests.
// ============================================================================

export const TOKEN_STORAGE_KEY = "aimemory_api_key";

let globalApiKey: string | null = null;
let verificationCache: { key: string; result: VerifyApiKeyResponse; expiresAt: number } | null = null;

export const tokenManager = {
  /**
   * Retrieves the current machine Bearer token from memory or browser localStorage.
   */
  get(): string | null {
    if (globalApiKey) return globalApiKey;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (stored && stored.trim().length > 0) {
          globalApiKey = stored.trim();
          return globalApiKey;
        }
      } catch {
        // Fallback for restricted storage / private browsing mode
      }
    }
    return null;
  },

  /**
   * Sets or updates the machine Bearer token in memory and localStorage,
   * invalidates verification cache, and broadcasts an auth-change event.
   */
  set(token: string | null): void {
    verificationCache = null;
    globalApiKey = token ? token.trim() : null;
    if (typeof window !== "undefined") {
      try {
        if (globalApiKey) {
          localStorage.setItem(TOKEN_STORAGE_KEY, globalApiKey);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch {
        // Fallback for restricted storage
      }
      window.dispatchEvent(new CustomEvent("aimem:auth-change"));
    }
  },

  /**
   * Clears the current machine Bearer token and cached verification.
   */
  clear(): void {
    this.set(null);
  },

  /**
   * Checks whether an active machine Bearer token is currently configured.
   */
  has(): boolean {
    return Boolean(this.get());
  },
};

// Standalone functions for backward compatibility
export const getApiKey = () => tokenManager.get();
export const setApiKey = (key: string | null) => tokenManager.set(key);
export const hasApiKey = () => tokenManager.has();
export const clearApiKey = () => tokenManager.clear();

// Semantic token aliases
export const getBearerToken = getApiKey;
export const setBearerToken = setApiKey;
export const hasBearerToken = hasApiKey;
export const clearBearerToken = clearApiKey;

// ============================================================================
// 3. API REQUEST HELPER WITH AUTOMATIC TOKEN & HEADER MERGING
// ============================================================================

/**
 * Builds standard HTTP headers for all API requests.
 * - Defaults to `"Content-Type": "application/json"`.
 * - Automatically injects `Authorization: Bearer <token>` if a token is present.
 * - Only merges custom headers if caller wants to change or extend defaults.
 *
 * Supports flexible argument ordering:
 * - getAuthHeaders()
 * - getAuthHeaders(token)
 * - getAuthHeaders(customHeaders)
 * - getAuthHeaders(token, customHeaders)
 * - getAuthHeaders(customHeaders, token)
 */
export function getAuthHeaders(
  arg1?: Record<string, string> | string | null,
  arg2?: Record<string, string> | string | null
): Record<string, string> {
  let customHeaders: Record<string, string> | undefined;
  let token: string | null | undefined;

  if (typeof arg1 === "string") {
    token = arg1;
    if (arg2 && typeof arg2 === "object") {
      customHeaders = arg2;
    }
  } else if (arg1 && typeof arg1 === "object") {
    customHeaders = arg1;
    if (typeof arg2 === "string") {
      token = arg2;
    }
  } else {
    if (typeof arg2 === "string") {
      token = arg2;
    } else if (arg2 && typeof arg2 === "object") {
      customHeaders = arg2;
    }
  }

  const activeToken = token !== undefined ? token : getApiKey();

  // Default headers:
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders || {}),
  };

  // Automatically inject Bearer token if available and not already set
  if (activeToken && activeToken.trim().length > 0) {
    if (!headers["Authorization"] && !headers["authorization"]) {
      headers["Authorization"] = `Bearer ${activeToken.trim()}`;
    }
  }

  return headers;
}

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  token?: string | null;
}

/**
 * Universal API Request Helper.
 * - Requires ONLY the endpoint URL.
 * - Automatically applies default headers and Bearer token.
 * - Custom headers only need to be passed if overriding or adding to defaults.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { headers: customHeaders, token: explicitToken, ...restOptions } = options;

  const resolvedHeaders = getAuthHeaders(customHeaders, explicitToken);

  const response = await fetch(endpoint, {
    method: restOptions.method || "GET",
    credentials: restOptions.credentials || "include",
    ...restOptions,
    headers: resolvedHeaders,
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

/**
 * Clean HTTP client shortcut methods where caller only passes endpoint (and optional body/headers).
 */
export const apiClient = {
  get: <T>(endpoint: string, options?: ApiFetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: ApiFetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "DELETE" }),
};

// Backward-compatible request wrapper
export const request = apiFetch;

// ============================================================================
// 5. PROJECT API CLIENT
// ============================================================================

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
  return apiClient.get<Project[]>(`${API_ENDPOINTS.PROJECTS.LIST}${query}`);
}

export async function getProject(id: string): Promise<Project> {
  return apiClient.get<Project>(API_ENDPOINTS.PROJECTS.DETAIL(id));
}

export async function createProject(
  payload: CreateProjectPayload
): Promise<Project> {
  return apiClient.post<Project>(API_ENDPOINTS.PROJECTS.CREATE, payload);
}

export async function updateProject(
  id: string,
  payload: UpdateProjectPayload
): Promise<Project> {
  return apiClient.patch<Project>(API_ENDPOINTS.PROJECTS.DETAIL(id), payload);
}

export async function archiveProject(id: string): Promise<Project> {
  return apiClient.delete<Project>(API_ENDPOINTS.PROJECTS.DETAIL(id));
}

// Alias for universal deletion naming convention
export const deleteProject = archiveProject;

// ============================================================================
// 6. MEMORY API CLIENT (PROJECT & TENANT SCOPES)
// ============================================================================

export interface CreateMemoryPayload {
  type: MemoryType;
  title: string;
  content: string;
  priority?: MemoryPriority;
  projectId?: string;
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
  scope?: "all" | "tenant" | "project";
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
  return apiClient.get<Memory[]>(
    `${API_ENDPOINTS.PROJECTS.MEMORIES(projectId)}${query}`
  );
}

export async function createMemory(
  projectId: string,
  payload: CreateMemoryPayload
): Promise<Memory> {
  return apiClient.post<Memory>(
    API_ENDPOINTS.PROJECTS.MEMORIES(projectId),
    payload
  );
}

export async function getTenantMemories(
  filters?: ListMemoriesQuery
): Promise<Memory[]> {
  const searchParams = new URLSearchParams();
  if (filters?.status) searchParams.set("status", filters.status);
  if (filters?.type) searchParams.set("type", filters.type);
  if (filters?.priority) searchParams.set("priority", filters.priority);
  if (filters?.scope) searchParams.set("scope", filters.scope);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return apiClient.get<Memory[]>(
    `${API_ENDPOINTS.MEMORIES.LIST_OR_CREATE}${query}`
  );
}

export async function createTenantMemory(
  payload: CreateMemoryPayload
): Promise<Memory> {
  return apiClient.post<Memory>(
    API_ENDPOINTS.MEMORIES.LIST_OR_CREATE,
    payload
  );
}

export async function getMemory(id: string): Promise<Memory> {
  return apiClient.get<Memory>(API_ENDPOINTS.MEMORIES.DETAIL(id));
}

export async function updateMemory(
  id: string,
  payload: UpdateMemoryPayload
): Promise<Memory> {
  return apiClient.patch<Memory>(API_ENDPOINTS.MEMORIES.DETAIL(id), payload);
}

export async function deprecateMemory(id: string): Promise<Memory> {
  return apiClient.post<Memory>(API_ENDPOINTS.MEMORIES.DEPRECATE(id));
}

export async function archiveMemory(id: string): Promise<Memory> {
  return apiClient.delete<Memory>(API_ENDPOINTS.MEMORIES.DETAIL(id));
}

// Aliases for universal naming conventions
export const getMemories = getTenantMemories;
export const deleteMemory = archiveMemory;

// ============================================================================
// 7. UNIFIED AI CONTEXT API CLIENT
// ============================================================================

export interface GetContextQuery {
  projectId?: string;
  budget?: number;
}

export interface ContextResponse {
  context: string;
  budgetRemaining: number;
  memoryCount: number;
}

export async function getAssembledContext(
  query?: GetContextQuery
): Promise<ContextResponse> {
  const searchParams = new URLSearchParams();
  if (query?.projectId) searchParams.set("projectId", query.projectId);
  if (query?.budget) searchParams.set("budget", query.budget.toString());

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return apiClient.get<ContextResponse>(`${API_ENDPOINTS.CONTEXT.GET}${qs}`);
}

// ============================================================================
// 8. PROJECT DISCOVERY & RESOLUTION API CLIENT
// ============================================================================

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
  return apiClient.post<ResolveProjectResponse>(
    API_ENDPOINTS.PROJECTS.RESOLVE,
    payload
  );
}

// ============================================================================
// 9. API KEY MANAGEMENT CLIENT
// ============================================================================

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

  const result = await apiClient.get<VerifyApiKeyResponse>(
    API_ENDPOINTS.AUTH.VERIFY,
    { token: targetKey }
  );

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
  return apiClient.post<CreateApiKeyResponse>(API_ENDPOINTS.AUTH.BOOTSTRAP);
}

export async function listApiKeys(): Promise<ApiKeyDto[]> {
  return apiClient.get<ApiKeyDto[]>(API_ENDPOINTS.AUTH.KEYS);
}

export async function createApiKey(
  payload: CreateApiKeyPayload
): Promise<CreateApiKeyResponse> {
  return apiClient.post<CreateApiKeyResponse>(
    API_ENDPOINTS.AUTH.KEYS,
    payload
  );
}

export async function revokeApiKey(id: string): Promise<ApiKeyDto> {
  return apiClient.post<ApiKeyDto>(API_ENDPOINTS.AUTH.KEY_REVOKE(id));
}

// ============================================================================
// 10. INTEGRATION CONNECTION TESTING CLIENT
// ============================================================================

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
  return apiClient.post<TestIntegrationResponse>(
    API_ENDPOINTS.INTEGRATIONS.TEST,
    payload
  );
}

export interface SignupPayload {
  workspaceName: string;
  primaryPlatform?: string;
}

export interface SignupResponse {
  message: string;
  apiKey: ApiKeyDto;
  rawKey: string;
  workspaceName: string;
}

export async function signupWorkspace(payload: SignupPayload): Promise<SignupResponse> {
  return apiClient.post<SignupResponse>(API_ENDPOINTS.AUTH.SIGNUP, payload);
}

// ============================================================================
// 11. HUMAN AUTHENTICATION & SECURE SESSION CLIENT API
// ============================================================================

export interface SafeUserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface ActiveTenantDto {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface TenantMembershipDto {
  tenantId: string;
  name: string;
  slug: string;
  role: string;
}

export interface SessionResponse {
  user: SafeUserDto;
  activeTenant: ActiveTenantDto;
  memberships: TenantMembershipDto[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type LoginCredentials = LoginPayload;

export interface LoginResponse {
  message: string;
  user: SafeUserDto;
  activeTenant: ActiveTenantDto;
  memberships: TenantMembershipDto[];
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  tenantName: string;
}

export interface RegisterResponse {
  message: string;
  user: SafeUserDto;
  activeTenant: ActiveTenantDto;
}

export async function loginHuman(payload: LoginPayload): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, payload);
}

export async function registerHuman(payload: RegisterPayload): Promise<RegisterResponse> {
  return apiClient.post<RegisterResponse>(API_ENDPOINTS.AUTH.REGISTER, payload);
}

export async function logoutHuman(): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>(API_ENDPOINTS.AUTH.LOGOUT);
}

export async function getCurrentSession(): Promise<SessionResponse> {
  return apiClient.get<SessionResponse>(API_ENDPOINTS.AUTH.SESSION);
}

export async function switchTenant(tenantId: string): Promise<{ message: string; activeTenant: ActiveTenantDto }> {
  return apiClient.post<{ message: string; activeTenant: ActiveTenantDto }>(
    API_ENDPOINTS.AUTH.TENANT,
    { tenantId }
  );
}

export async function devBootstrapLogin(): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH.DEV_BOOTSTRAP);
}
