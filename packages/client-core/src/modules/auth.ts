import type { HttpClient } from "../transport/http-client.js";
import type { SecureStorageAdapter } from "../adapters/storage.js";

const STORAGE_KEY = "aimemory_api_key";

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface CreateKeyPayload {
  name: string;
  scopes?: string[];
  expiresInDays?: number;
}

export interface CreateKeyResult {
  apiKey: ApiKeyRecord;
  rawKey: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  generateKey?: boolean;
  clientName?: string;
}

export interface LoginResult {
  message: string;
  apiKey?: string;
  user: {
    id: string;
    email: string;
    name: string;
    createdAt?: string;
  };
  activeTenant: {
    id: string;
    name: string;
    slug: string;
    role?: string;
  };
  memberships?: Array<{
    tenantId: string;
    name: string;
    slug: string;
    role?: string;
  }>;
}

export class AuthModule {
  private inMemoryKey: string | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly storage: SecureStorageAdapter,
    initialApiKey?: string
  ) {
    if (initialApiKey) {
      this.inMemoryKey = initialApiKey;
      void this.storage.set(STORAGE_KEY, initialApiKey).catch(() => {});
    }
  }

  /**
   * Sets the active API key and stores it in secure storage.
   */
  async setApiKey(apiKey: string): Promise<void> {
    const cleanKey = apiKey.trim();
    this.inMemoryKey = cleanKey;
    await this.storage.set(STORAGE_KEY, cleanKey);
  }

  /**
   * Retrieves the active API key from memory or secure storage.
   */
  async getApiKey(): Promise<string | null> {
    if (this.inMemoryKey) {
      return this.inMemoryKey;
    }

    const stored = await this.storage.get(STORAGE_KEY);
    if (stored) {
      this.inMemoryKey = stored;
      return stored;
    }

    return null;
  }

  /**
   * Clears the active API key from memory and secure storage.
   */
  async clearApiKey(): Promise<void> {
    this.inMemoryKey = null;
    await this.storage.delete(STORAGE_KEY);
  }

  /**
   * Lists all registered API keys (Requires admin scope).
   */
  async listKeys(): Promise<ApiKeyRecord[]> {
    return this.http.request<ApiKeyRecord[]>("/api/auth/keys", {
      method: "GET",
    });
  }

  /**
   * Generates a new API key. Displays rawKey strictly once (Requires admin scope).
   */
  async createKey(payload: CreateKeyPayload): Promise<CreateKeyResult> {
    return this.http.request<CreateKeyResult>("/api/auth/keys", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Revokes an API key immediately (Requires admin scope).
   */
  async revokeKey(id: string): Promise<ApiKeyRecord> {
    return this.http.request<ApiKeyRecord>(`/api/auth/keys/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
    });
  }

  /**
   * Authenticates with user credentials, automatically provisions an API key for this client,
   * stores it in secure storage, and sets it on the client for subsequent requests.
   */
  async login(payload: LoginPayload): Promise<LoginResult> {
    const result = await this.http.request<LoginResult>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        generateKey: payload.generateKey ?? true,
        clientName: payload.clientName || "AiMemory Client",
      }),
    });

    if (result.apiKey) {
      await this.setApiKey(result.apiKey);
    }

    return result;
  }
}
