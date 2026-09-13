'use strict';

// src/adapters/storage.ts
var EphemeralStorageAdapter = class {
  store = /* @__PURE__ */ new Map();
  async get(key) {
    return this.store.get(key) ?? null;
  }
  async set(key, value) {
    this.store.set(key, value);
  }
  async delete(key) {
    this.store.delete(key);
  }
  async clear() {
    this.store.clear();
  }
};

// src/adapters/cache.ts
var InMemoryCache = class {
  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }
  maxEntries;
  store = /* @__PURE__ */ new Map();
  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  async set(key, value, options) {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== void 0) {
        this.store.delete(oldestKey);
      }
    }
    const expiresAt = options?.ttlMs ? Date.now() + options.ttlMs : null;
    this.store.set(key, { value, expiresAt });
  }
  async delete(key) {
    this.store.delete(key);
  }
  async deletePrefix(prefix) {
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
  async clear() {
    this.store.clear();
  }
};

// src/adapters/logger.ts
var NoopLogger = class {
  debug() {
  }
  info() {
  }
  warn() {
  }
  error() {
  }
};
var ConsoleLogger = class {
  debug(message, metadata) {
    console.debug(`[AiMemory:DEBUG] ${message}`, metadata ?? "");
  }
  info(message, metadata) {
    console.info(`[AiMemory:INFO] ${message}`, metadata ?? "");
  }
  warn(message, metadata) {
    console.warn(`[AiMemory:WARN] ${message}`, metadata ?? "");
  }
  error(message, metadata) {
    console.error(`[AiMemory:ERROR] ${message}`, metadata ?? "");
  }
};

// src/transport/errors.ts
var AiMemoryError = class extends Error {
  code;
  status;
  details;
  constructor(message, code = "SDK_ERROR", status, details) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var AuthenticationError = class extends AiMemoryError {
  constructor(message = "Authentication required. Invalid, expired, or missing API key.", details) {
    super(message, "UNAUTHORIZED", 401, details);
  }
};
var AuthorizationError = class extends AiMemoryError {
  constructor(message = "Access forbidden. Insufficient permissions or scopes for this operation.", details) {
    super(message, "FORBIDDEN", 403, details);
  }
};
var NotFoundError = class extends AiMemoryError {
  constructor(message = "Requested resource not found.", details) {
    super(message, "NOT_FOUND", 404, details);
  }
};
var ConflictError = class extends AiMemoryError {
  constructor(message = "Resource conflict or duplicate detected.", details) {
    super(message, "CONFLICT", 409, details);
  }
};
var ValidationError = class extends AiMemoryError {
  constructor(message = "Request validation failed.", details) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
};
var RateLimitError = class extends AiMemoryError {
  retryAfterSecs;
  constructor(message = "Rate limit exceeded. Please slow down.", retryAfterSecs, details) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, details);
    this.retryAfterSecs = retryAfterSecs;
  }
};
var NetworkError = class extends AiMemoryError {
  constructor(message = "Network request failed. Host unreachable.", details) {
    super(message, "NETWORK_ERROR", void 0, details);
  }
};
var TimeoutError = class extends AiMemoryError {
  constructor(message = "Request timed out.", details) {
    super(message, "TIMEOUT", 408, details);
  }
};
var ServerError = class extends AiMemoryError {
  constructor(message = "Internal server error.", status = 500, details) {
    super(message, "SERVER_ERROR", status, details);
  }
};

// src/config.ts
function resolveConfig(options) {
  if (!options || typeof options !== "object") {
    throw new ValidationError("Client options must be provided as an object");
  }
  if (!options.baseUrl || typeof options.baseUrl !== "string" || !options.baseUrl.trim()) {
    throw new ValidationError("options.baseUrl is required and must be a non-empty string");
  }
  const normalizedBaseUrl = options.baseUrl.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(normalizedBaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Protocol must be http: or https:");
    }
  } catch (err) {
    throw new ValidationError(
      `Invalid baseUrl: '${options.baseUrl}'. Must be a valid HTTP or HTTPS URL.`,
      err instanceof Error ? err.message : void 0
    );
  }
  const timeoutMs = options.timeoutMs ?? 1e4;
  if (typeof timeoutMs !== "number" || timeoutMs <= 0 || !Number.isFinite(timeoutMs)) {
    throw new ValidationError("options.timeoutMs must be a positive number");
  }
  const maxRetries = options.maxRetries ?? 3;
  if (typeof maxRetries !== "number" || maxRetries < 0 || !Number.isInteger(maxRetries)) {
    throw new ValidationError("options.maxRetries must be a non-negative integer");
  }
  return {
    baseUrl: normalizedBaseUrl,
    initialApiKey: options.apiKey?.trim(),
    platform: (options.platform ?? "CLIENT").trim().toUpperCase(),
    clientId: options.clientId?.trim(),
    timeoutMs,
    maxRetries,
    fetch: options.fetch,
    storage: options.storage ?? new EphemeralStorageAdapter(),
    cache: options.cache ?? new InMemoryCache(200),
    logger: options.logger ?? new NoopLogger()
  };
}

// src/transport/retry.ts
function calculateBackoff(attempt, baseMs = 300, maxMs = 5e3) {
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  const jitterFactor = 0.75 + Math.random() * 0.5;
  return Math.floor(exponential * jitterFactor);
}
function parseRetryAfter(headerValue) {
  if (!headerValue || typeof headerValue !== "string") return null;
  const trimmed = headerValue.trim();
  if (!trimmed) return null;
  const seconds = Number(trimmed);
  if (!isNaN(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1e3);
  }
  const dateMs = Date.parse(trimmed);
  if (!isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return Math.max(0, diff);
  }
  return null;
}
function isRetryableMethod(method = "GET") {
  return method.toUpperCase() === "GET";
}
function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/transport/http-client.ts
var HttpClient = class {
  baseUrl;
  getApiKey;
  platform;
  clientId;
  defaultTimeoutMs;
  defaultMaxRetries;
  fetchImpl;
  logger;
  events;
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.getApiKey = config.getApiKey;
    this.platform = config.platform;
    this.clientId = config.clientId;
    this.defaultTimeoutMs = config.timeoutMs ?? 1e4;
    this.defaultMaxRetries = config.maxRetries ?? 3;
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.logger = config.logger;
    this.events = config.events;
  }
  /**
   * Executes a typed HTTP request with automatic timeout, resilience retries, envelope unwrapping, and error mapping.
   */
  async request(path, options = {}) {
    const method = (options.method ?? "GET").toUpperCase();
    const isSafeToRetry = isRetryableMethod(method);
    const maxRetries = options.maxRetries ?? (isSafeToRetry ? this.defaultMaxRetries : 0);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const url = this.buildUrl(path, options.query);
    const sanitizedPath = path.split("?")[0];
    let attempt = 0;
    while (true) {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const apiKey = await this.getApiKey();
        const headers = {
          "Content-Type": "application/json",
          "x-aimemory-client": "@aimemory/client-core",
          "x-aimemory-platform": this.platform,
          ...this.clientId ? { "x-aimemory-client-id": this.clientId } : {},
          ...options.headers ?? {}
        };
        if (apiKey && !headers["Authorization"] && !headers["authorization"]) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }
        this.logger.debug(`HTTP ${method} ${sanitizedPath}`, {
          method,
          url: sanitizedPath,
          retryCount: attempt
        });
        const response = await this.fetchImpl(url, {
          ...options,
          method,
          headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;
        if (response.ok) {
          this.logger.debug(`HTTP ${method} ${sanitizedPath} ${response.status}`, {
            method,
            url: sanitizedPath,
            status: response.status,
            durationMs
          });
          if (response.status === 204) {
            return void 0;
          }
          const json = await response.json().catch(() => null);
          if (json && typeof json === "object" && "data" in json) {
            return json.data;
          }
          return json;
        }
        const errorJson = await response.json().catch(() => null);
        const errorPayload = errorJson?.error;
        const errorMessage = errorPayload?.message || `Request failed with status ${response.status}`;
        const errorDetails = errorPayload?.details;
        this.logger.warn(`HTTP ${method} ${sanitizedPath} returned ${response.status}`, {
          method,
          url: sanitizedPath,
          status: response.status,
          durationMs
        });
        if (response.status === 401) {
          const authError = new AuthenticationError(errorMessage, errorDetails);
          this.events.emit("auth:unauthorized", { error: authError });
          throw authError;
        }
        if (response.status === 403) {
          const forbiddenError = new AuthorizationError(errorMessage, errorDetails);
          this.events.emit("auth:forbidden", { error: forbiddenError });
          throw forbiddenError;
        }
        if (response.status === 404) {
          throw new NotFoundError(errorMessage, errorDetails);
        }
        if (response.status === 409) {
          throw new ConflictError(errorMessage, errorDetails);
        }
        if (response.status === 400) {
          throw new ValidationError(errorMessage, errorDetails);
        }
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get("Retry-After");
          const retryAfterMs = parseRetryAfter(retryAfterHeader);
          const retryAfterSecs = retryAfterMs ? Math.ceil(retryAfterMs / 1e3) : void 0;
          const rateLimitError = new RateLimitError(errorMessage, retryAfterSecs, errorDetails);
          this.events.emit("rate-limit:exceeded", { error: rateLimitError, retryAfterSecs });
          throw rateLimitError;
        }
        if (isSafeToRetry && isRetryableStatus(response.status) && attempt < maxRetries) {
          attempt++;
          const backoff = calculateBackoff(attempt);
          this.logger.info(`Retrying ${method} ${sanitizedPath} (attempt ${attempt}/${maxRetries}) in ${backoff}ms...`, {
            method,
            url: sanitizedPath,
            status: response.status,
            retryCount: attempt
          });
          await sleep(backoff);
          continue;
        }
        throw new ServerError(errorMessage, response.status, errorDetails);
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof AiMemoryError) {
          throw err;
        }
        const isAbort = err?.name === "AbortError";
        if (isAbort) {
          const timeoutErr = new TimeoutError(`Request to ${sanitizedPath} timed out after ${timeoutMs}ms`);
          if (isSafeToRetry && attempt < maxRetries) {
            attempt++;
            const backoff = calculateBackoff(attempt);
            await sleep(backoff);
            continue;
          }
          throw timeoutErr;
        }
        const networkErr = new NetworkError(
          err instanceof Error ? err.message : "Network request failed. Host unreachable.",
          err
        );
        if (isSafeToRetry && attempt < maxRetries) {
          attempt++;
          const backoff = calculateBackoff(attempt);
          this.logger.info(`Network failure. Retrying ${method} ${sanitizedPath} (attempt ${attempt}/${maxRetries}) in ${backoff}ms...`, {
            method,
            url: sanitizedPath,
            retryCount: attempt
          });
          await sleep(backoff);
          continue;
        }
        this.events.emit("network:error", { error: networkErr });
        throw networkErr;
      }
    }
  }
  buildUrl(path, query) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const fullUrl = `${this.baseUrl}${cleanPath}`;
    if (!query) return fullUrl;
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== void 0 && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    return queryString ? `${fullUrl}?${queryString}` : fullUrl;
  }
};

// src/events/event-emitter.ts
var TypedEventEmitter = class {
  listeners = /* @__PURE__ */ new Map();
  /**
   * Subscribes a listener to a specific event.
   * @returns Unsubscribe function to easily detach the listener.
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }
  /**
   * Subscribes a listener that will trigger at most once.
   * @returns Unsubscribe function.
   */
  once(event, handler) {
    const wrapped = (payload) => {
      this.off(event, wrapped);
      return handler(payload);
    };
    return this.on(event, wrapped);
  }
  /**
   * Removes a specific listener from an event.
   */
  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }
  /**
   * Synchronously dispatches an event to all registered listeners.
   */
  emit(event, payload) {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;
    for (const handler of Array.from(handlers)) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error(`[AiMemory:EventError] Error in async handler for '${String(event)}':`, err);
          });
        }
      } catch (err) {
        console.error(`[AiMemory:EventError] Error in handler for '${String(event)}':`, err);
      }
    }
  }
  /**
   * Returns the count of active listeners for a given event.
   */
  listenerCount(event) {
    return this.listeners.get(event)?.size ?? 0;
  }
  /**
   * Clears all listeners for a given event or all events if none specified.
   */
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
};

// src/modules/auth.ts
var STORAGE_KEY = "aimemory_api_key";
var AuthModule = class {
  constructor(http, storage, initialApiKey) {
    this.http = http;
    this.storage = storage;
    if (initialApiKey) {
      this.inMemoryKey = initialApiKey;
      void this.storage.set(STORAGE_KEY, initialApiKey).catch(() => {
      });
    }
  }
  http;
  storage;
  inMemoryKey = null;
  /**
   * Sets the active API key and stores it in secure storage.
   */
  async setApiKey(apiKey) {
    const cleanKey = apiKey.trim();
    this.inMemoryKey = cleanKey;
    await this.storage.set(STORAGE_KEY, cleanKey);
  }
  /**
   * Retrieves the active API key from memory or secure storage.
   */
  async getApiKey() {
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
  async clearApiKey() {
    this.inMemoryKey = null;
    await this.storage.delete(STORAGE_KEY);
  }
  /**
   * Lists all registered API keys (Requires admin scope).
   */
  async listKeys() {
    return this.http.request("/api/auth/keys", {
      method: "GET"
    });
  }
  /**
   * Generates a new API key. Displays rawKey strictly once (Requires admin scope).
   */
  async createKey(payload) {
    return this.http.request("/api/auth/keys", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
  /**
   * Revokes an API key immediately (Requires admin scope).
   */
  async revokeKey(id) {
    return this.http.request(`/api/auth/keys/${encodeURIComponent(id)}/revoke`, {
      method: "POST"
    });
  }
};

// src/modules/projects.ts
var ProjectsModule = class {
  constructor(http, cache, events) {
    this.http = http;
    this.cache = cache;
    this.events = events;
  }
  http;
  cache;
  events;
  /**
   * Resolves incoming discovery signals (Git remote, monorepo subpath, package manifest, etc.)
   * to an existing Project or automatically provisions a new one.
   */
  async resolve(input) {
    const result = await this.http.request("/api/projects/resolve", {
      method: "POST",
      body: JSON.stringify(input)
    });
    this.events.emit("project:resolved", { result });
    if (result.isNewlyCreated) {
      this.events.emit("project:created", { project: result.project });
    }
    return result;
  }
  /**
   * Lists active or archived projects.
   */
  async list(filter) {
    const cacheKey = `projects:list:${filter?.status ?? "ALL"}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const query = {};
    if (filter?.status) query.status = filter.status;
    const projects = await this.http.request("/api/projects", {
      method: "GET",
      query
    });
    await this.cache.set(cacheKey, projects, { ttlMs: 3e4 });
    return projects;
  }
  /**
   * Retrieves a single project by its UUID.
   */
  async get(id) {
    const cacheKey = `project:${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const project = await this.http.request(`/api/projects/${encodeURIComponent(id)}`, {
      method: "GET"
    });
    await this.cache.set(cacheKey, project, { ttlMs: 6e4 });
    return project;
  }
  /**
   * Creates a new project manually.
   */
  async create(payload) {
    const project = await this.http.request("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await this.invalidateListCache();
    this.events.emit("project:created", { project });
    return project;
  }
  /**
   * Updates an existing project's fields.
   */
  async update(id, payload) {
    const project = await this.http.request(`/api/projects/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    await this.cache.delete(`project:${id}`);
    await this.invalidateListCache();
    this.events.emit("project:updated", { project });
    return project;
  }
  /**
   * Soft-archives a project.
   */
  async archive(id) {
    const project = await this.http.request(`/api/projects/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    await this.cache.delete(`project:${id}`);
    await this.invalidateListCache();
    this.events.emit("project:archived", { projectId: id });
    return project;
  }
  async invalidateListCache() {
    if (this.cache.deletePrefix) {
      await this.cache.deletePrefix("projects:list:");
    } else {
      await this.cache.delete("projects:list:ALL");
      await this.cache.delete("projects:list:ACTIVE");
      await this.cache.delete("projects:list:ARCHIVED");
    }
  }
};

// src/modules/memories.ts
var MemoriesModule = class {
  constructor(http, cache, events) {
    this.http = http;
    this.cache = cache;
    this.events = events;
  }
  http;
  cache;
  events;
  /**
   * Lists memories strictly scoped to a specified project.
   */
  async list(projectId, filter) {
    const filterKey = `${filter?.status ?? "ALL"}_${filter?.type ?? "ALL"}_${filter?.priority ?? "ALL"}`;
    const cacheKey = `memories:${projectId}:${filterKey}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const query = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.type) query.type = filter.type;
    if (filter?.priority) query.priority = filter.priority;
    const memories = await this.http.request(
      `/api/projects/${encodeURIComponent(projectId)}/memories`,
      {
        method: "GET",
        query
      }
    );
    await this.cache.set(cacheKey, memories, { ttlMs: 3e4 });
    return memories;
  }
  /**
   * Lists tenant-level memories (projectId = null).
   */
  async listTenant(filter) {
    const filterKey = `${filter?.status ?? "ALL"}_${filter?.type ?? "ALL"}_${filter?.priority ?? "ALL"}`;
    const cacheKey = `memories:tenant:${filterKey}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const query = { scope: "tenant" };
    if (filter?.status) query.status = filter.status;
    if (filter?.type) query.type = filter.type;
    if (filter?.priority) query.priority = filter.priority;
    const memories = await this.http.request(`/api/memories`, {
      method: "GET",
      query
    });
    await this.cache.set(cacheKey, memories, { ttlMs: 3e4 });
    return memories;
  }
  /**
   * Retrieves a single memory item by its UUID.
   */
  async get(id) {
    const cacheKey = `memory:${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const memory = await this.http.request(`/api/memories/${encodeURIComponent(id)}`, {
      method: "GET"
    });
    await this.cache.set(cacheKey, memory, { ttlMs: 6e4 });
    return memory;
  }
  /**
   * Creates a new memory record (scoped to a project if projectId is provided, or tenant-level if null/omitted).
   */
  async create(projectId, payload) {
    const targetProjectId = projectId ?? payload.projectId ?? null;
    let memory;
    if (targetProjectId) {
      memory = await this.http.request(
        `/api/projects/${encodeURIComponent(targetProjectId)}/memories`,
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
    } else {
      memory = await this.http.request(`/api/memories`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }
    await this.invalidateMemories(targetProjectId);
    this.events.emit("memory:created", { memory });
    return memory;
  }
  /**
   * Creates a tenant-level personal/cross-project memory record (projectId = null).
   */
  async createTenant(payload) {
    return this.create(null, payload);
  }
  /**
   * Updates an existing memory record.
   */
  async update(id, payload) {
    const memory = await this.http.request(`/api/memories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    await this.cache.delete(`memory:${id}`);
    await this.invalidateMemories(memory.projectId);
    this.events.emit("memory:updated", { memory });
    return memory;
  }
  /**
   * Soft-deprecates a memory record.
   */
  async deprecate(id) {
    const memory = await this.http.request(`/api/memories/${encodeURIComponent(id)}/deprecate`, {
      method: "POST"
    });
    await this.cache.delete(`memory:${id}`);
    await this.invalidateMemories(memory.projectId);
    this.events.emit("memory:deprecated", { memory });
    return memory;
  }
  /**
   * Soft-archives a memory record.
   */
  async archive(id) {
    const memory = await this.http.request(`/api/memories/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    await this.cache.delete(`memory:${id}`);
    await this.invalidateMemories(memory.projectId);
    this.events.emit("memory:archived", { memoryId: id, projectId: memory.projectId ?? "" });
    return memory;
  }
  async invalidateMemories(projectId) {
    if (projectId) {
      if (this.cache.deletePrefix) {
        await this.cache.deletePrefix(`memories:${projectId}:`);
        await this.cache.deletePrefix(`context:${projectId}:`);
      } else {
        await this.cache.delete(`context:${projectId}:default`);
      }
      this.events.emit("context:updated", { projectId });
    } else {
      if (this.cache.deletePrefix) {
        await this.cache.deletePrefix(`memories:tenant:`);
        await this.cache.deletePrefix(`context:tenant:`);
      }
    }
  }
};

// src/modules/context.ts
var ContextModule = class {
  constructor(http, cache) {
    this.http = http;
    this.cache = cache;
  }
  http;
  cache;
  /**
   * Generates active, token/character-budgeted Markdown AI context for a project or workspace.
   * If projectId is provided, combines project memories with workspace memories.
   * If projectId is omitted or null, returns pure workspace / personal memories.
   */
  async get(projectId, options) {
    const targetProject = projectId ?? null;
    const budget = options?.budget ?? 8e3;
    const typesKey = options?.types ? [...options.types].sort().join(",") : "ALL";
    const cacheKey = `context:${targetProject ?? "tenant"}:${budget}:${typesKey}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const query = {};
    if (targetProject) query.projectId = targetProject;
    if (options?.budget) query.budget = options.budget;
    if (options?.types && options.types.length > 0) {
      query.types = options.types.join(",");
    }
    const raw = await this.http.request(
      targetProject ? `/api/projects/${encodeURIComponent(targetProject)}/context` : `/api/context`,
      {
        method: "GET",
        query
      }
    );
    const result = {
      projectId: raw.projectId,
      projectName: raw.projectName,
      markdown: raw.context ?? "",
      budget: {
        requested: raw.budget ?? budget,
        usedCharacters: raw.usedCharacters ?? 0,
        remainingCharacters: Math.max(0, (raw.budget ?? budget) - (raw.usedCharacters ?? 0)),
        itemCount: raw.includedMemoryCount ?? 0
      },
      includedMemories: []
    };
    await this.cache.set(cacheKey, result, { ttlMs: 15e3 });
    return result;
  }
};

// src/client.ts
var AiMemoryClient = class {
  events;
  auth;
  projects;
  memories;
  context;
  http;
  constructor(options) {
    const config = resolveConfig(options);
    this.events = new TypedEventEmitter();
    this.auth = new AuthModule(
      // Pass a temporary lazy reference that resolves after HTTP client is constructed
      null,
      config.storage,
      config.initialApiKey
    );
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      getApiKey: () => this.auth.getApiKey(),
      platform: config.platform,
      clientId: config.clientId,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      fetch: config.fetch,
      logger: config.logger,
      events: this.events
    });
    this.auth.http = this.http;
    this.projects = new ProjectsModule(this.http, config.cache, this.events);
    this.memories = new MemoriesModule(this.http, config.cache, this.events);
    this.context = new ContextModule(this.http, config.cache);
  }
};

exports.AiMemoryClient = AiMemoryClient;
exports.AiMemoryError = AiMemoryError;
exports.AuthModule = AuthModule;
exports.AuthenticationError = AuthenticationError;
exports.AuthorizationError = AuthorizationError;
exports.ConflictError = ConflictError;
exports.ConsoleLogger = ConsoleLogger;
exports.ContextModule = ContextModule;
exports.EphemeralStorageAdapter = EphemeralStorageAdapter;
exports.HttpClient = HttpClient;
exports.InMemoryCache = InMemoryCache;
exports.MemoriesModule = MemoriesModule;
exports.NetworkError = NetworkError;
exports.NoopLogger = NoopLogger;
exports.NotFoundError = NotFoundError;
exports.ProjectsModule = ProjectsModule;
exports.RateLimitError = RateLimitError;
exports.ServerError = ServerError;
exports.TimeoutError = TimeoutError;
exports.TypedEventEmitter = TypedEventEmitter;
exports.ValidationError = ValidationError;
exports.calculateBackoff = calculateBackoff;
exports.isRetryableMethod = isRetryableMethod;
exports.isRetryableStatus = isRetryableStatus;
exports.parseRetryAfter = parseRetryAfter;
exports.resolveConfig = resolveConfig;
exports.sleep = sleep;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map