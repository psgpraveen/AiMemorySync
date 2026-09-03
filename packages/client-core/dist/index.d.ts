/**
 * Abstract interface for platform-delegated secure credential storage.
 * In VS Code / Cursor: maps to context.secrets.
 * In Browser: maps to IndexedDB with WebCrypto or secure storage extension.
 * In Node CLI: maps to OS Keyring / keytar.
 */
interface SecureStorageAdapter {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}
/**
 * Ephemeral In-Memory storage adapter.
 * Intended ONLY for unit testing, non-persistent CLI runs, or ephemeral sessions.
 * Note: This does not persist or encrypt tokens at rest.
 */
declare class EphemeralStorageAdapter implements SecureStorageAdapter {
    private store;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
}

interface CacheOptions {
    /**
     * Time To Live in milliseconds.
     */
    ttlMs?: number;
}
/**
 * Pluggable cache adapter interface for client-side GET caching.
 */
interface CacheAdapter {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
    delete(key: string): Promise<void>;
    deletePrefix?(prefix: string): Promise<void>;
    clear(): Promise<void>;
}
/**
 * Simple in-memory cache with TTL expiration and optional max entries limit.
 */
declare class InMemoryCache implements CacheAdapter {
    private maxEntries;
    private store;
    constructor(maxEntries?: number);
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
    delete(key: string): Promise<void>;
    deletePrefix(prefix: string): Promise<void>;
    clear(): Promise<void>;
}

/**
 * Safe diagnostic metadata for logging.
 * NEVER pass API keys, Authorization headers, or raw memory content here.
 */
interface SafeLogMetadata {
    method?: string;
    url?: string;
    status?: number;
    durationMs?: number;
    retryCount?: number;
    clientId?: string;
    platform?: string;
    projectId?: string;
    memoryId?: string;
    [key: string]: unknown;
}
/**
 * Pluggable logger adapter interface.
 */
interface LoggerAdapter {
    debug(message: string, metadata?: SafeLogMetadata): void;
    info(message: string, metadata?: SafeLogMetadata): void;
    warn(message: string, metadata?: SafeLogMetadata): void;
    error(message: string, metadata?: SafeLogMetadata): void;
}
/**
 * Default silent no-op logger.
 */
declare class NoopLogger implements LoggerAdapter {
    debug(): void;
    info(): void;
    warn(): void;
    error(): void;
}
/**
 * Standard console logger adapter for development diagnostics.
 */
declare class ConsoleLogger implements LoggerAdapter {
    debug(message: string, metadata?: SafeLogMetadata): void;
    info(message: string, metadata?: SafeLogMetadata): void;
    warn(message: string, metadata?: SafeLogMetadata): void;
    error(message: string, metadata?: SafeLogMetadata): void;
}

interface ClientOptions {
    /**
     * Base URL of the AiMemorySync backend API (e.g. "https://api.yourdomain.com" or "http://localhost:3000").
     */
    baseUrl: string;
    /**
     * Optional initial API key token.
     */
    apiKey?: string;
    /**
     * Platform identifier (e.g. "VSCODE", "CURSOR", "ANTIGRAVITY", "BROWSER", "CLI").
     * Default: "CLIENT"
     */
    platform?: string;
    /**
     * Unique client installation or machine identifier.
     */
    clientId?: string;
    /**
     * Request timeout in milliseconds.
     * Default: 10000 (10 seconds)
     */
    timeoutMs?: number;
    /**
     * Maximum retry attempts for safe GET requests.
     * Default: 3
     */
    maxRetries?: number;
    /**
     * Optional custom fetch implementation for dependency injection.
     */
    fetch?: typeof globalThis.fetch;
    /**
     * Pluggable secure storage adapter for API keys.
     * Default: EphemeralStorageAdapter
     */
    storage?: SecureStorageAdapter;
    /**
     * Pluggable cache adapter for safe read operations.
     * Default: InMemoryCache (200 entries max)
     */
    cache?: CacheAdapter;
    /**
     * Pluggable logger adapter.
     * Default: NoopLogger
     */
    logger?: LoggerAdapter;
}
interface ResolvedClientConfig {
    baseUrl: string;
    initialApiKey?: string;
    platform: string;
    clientId?: string;
    timeoutMs: number;
    maxRetries: number;
    fetch?: typeof globalThis.fetch;
    storage: SecureStorageAdapter;
    cache: CacheAdapter;
    logger: LoggerAdapter;
}
/**
 * Validates and normalizes client initialization configuration.
 */
declare function resolveConfig(options: ClientOptions): ResolvedClientConfig;

/**
 * Standard successful API response envelope from AiMemorySync backend.
 */
interface ApiResponse<T> {
    data: T;
}
/**
 * Standard error response envelope from AiMemorySync backend.
 */
interface ApiErrorResponse {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
/**
 * Common pagination options for list endpoints.
 */
interface PaginationOptions {
    limit?: number;
    offset?: number;
}

type ProjectStatus = "ACTIVE" | "ARCHIVED";
type ProjectCreationSource = "MANUAL" | "AUTO_DISCOVERY";
/**
 * Client-facing Project Data Transfer Object.
 */
interface ProjectDto {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: ProjectStatus;
    creationSource: ProjectCreationSource;
    createdAt: string;
    updatedAt: string;
}
/**
 * Payload for creating a new project.
 */
interface CreateProjectPayload {
    name: string;
    slug?: string;
    description?: string;
}
/**
 * Payload for updating an existing project.
 */
interface UpdateProjectPayload {
    name?: string;
    slug?: string;
    description?: string;
    status?: ProjectStatus;
}
/**
 * Query filter for listing projects.
 */
interface ListProjectsFilter {
    status?: ProjectStatus;
}

type ProjectIdentityType = "GIT_REMOTE" | "MONOREPO_SUBPROJECT" | "PACKAGE_MANIFEST" | "WORKSPACE_DIGEST" | "PLATFORM_SESSION";
/**
 * Package manifest identity signal.
 */
interface PackageManifestSignal {
    ecosystem: string;
    name: string;
}
/**
 * Identity discovery signals provided by client IDEs or platform integrations.
 */
interface DiscoverySignals {
    gitRemoteUrl?: string;
    monorepoSubPath?: string;
    packageManifest?: PackageManifestSignal;
    workspaceName?: string;
    localPath?: string;
}
/**
 * Platform and client environment source metadata.
 */
interface DiscoverySource {
    platform: string;
    externalId?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Request payload for POST /api/projects/resolve.
 */
interface ResolveProjectInput {
    signals: DiscoverySignals;
    source: DiscoverySource;
}
/**
 * Response payload returned from POST /api/projects/resolve.
 */
interface ResolveProjectResult {
    project: ProjectDto;
    matchedBy: ProjectIdentityType;
    canonicalIdentity: string;
    confidence: number;
    isNewlyCreated: boolean;
}

type MemoryType = "DECISION" | "REQUIREMENT" | "CONVENTION" | "BUG_SOLUTION";
type MemoryPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
type MemoryStatus = "ACTIVE" | "DEPRECATED" | "ARCHIVED";
/**
 * Client-facing Memory Data Transfer Object.
 */
interface MemoryDto {
    id: string;
    projectId: string;
    type: MemoryType;
    title: string;
    content: string;
    priority: MemoryPriority;
    contentHash: string;
    status: MemoryStatus;
    createdAt: string;
    updatedAt: string;
}
/**
 * Payload for creating a new memory strictly scoped to a project.
 */
interface CreateMemoryPayload {
    type: MemoryType;
    title: string;
    content: string;
    priority?: MemoryPriority;
}
/**
 * Payload for updating an existing memory.
 */
interface UpdateMemoryPayload {
    title?: string;
    content?: string;
    type?: MemoryType;
    priority?: MemoryPriority;
    status?: MemoryStatus;
}
/**
 * Query filter for listing project memories.
 */
interface ListMemoriesFilter {
    status?: MemoryStatus;
    type?: MemoryType;
    priority?: MemoryPriority;
}

/**
 * Options for context assembly generation.
 */
interface ContextOptions {
    budget?: number;
    types?: MemoryType[];
}
/**
 * Section metadata of a memory included in the assembled context.
 */
interface AssembledContextSection {
    memoryId: string;
    type: MemoryType;
    title: string;
    priority: MemoryPriority;
    characters: number;
    content: string;
}
/**
 * Assembled AI context result payload for a project.
 */
interface AssembledContextResult {
    projectId: string;
    projectName: string;
    budget: {
        requested: number;
        usedCharacters: number;
        remainingCharacters: number;
        itemCount: number;
    };
    markdown: string;
    includedMemories: AssembledContextSection[];
}

/**
 * Base error class for all AiMemorySync SDK operations.
 */
declare class AiMemoryError extends Error {
    readonly code: string;
    readonly status?: number;
    readonly details?: unknown;
    constructor(message: string, code?: string, status?: number, details?: unknown);
}
/**
 * Thrown when an endpoint returns HTTP 401 (Missing, invalid, expired, or revoked API key).
 */
declare class AuthenticationError extends AiMemoryError {
    constructor(message?: string, details?: unknown);
}
/**
 * Thrown when an endpoint returns HTTP 403 (Insufficient permissions or scopes).
 */
declare class AuthorizationError extends AiMemoryError {
    constructor(message?: string, details?: unknown);
}
/**
 * Thrown when an endpoint returns HTTP 404 (Project, memory, or resource not found).
 */
declare class NotFoundError extends AiMemoryError {
    constructor(message?: string, details?: unknown);
}
/**
 * Thrown when an endpoint returns HTTP 409 (Slug collision or duplicate memory hash).
 */
declare class ConflictError extends AiMemoryError {
    constructor(message?: string, details?: unknown);
}
/**
 * Thrown when an endpoint returns HTTP 400 (Zod schema validation failure).
 */
declare class ValidationError extends AiMemoryError {
    constructor(message?: string, details?: unknown);
}
/**
 * Thrown when an endpoint returns HTTP 429 (Rate limit exceeded).
 */
declare class RateLimitError extends AiMemoryError {
    readonly retryAfterSecs?: number;
    constructor(message?: string, retryAfterSecs?: number, details?: unknown);
}
/**
 * Thrown when a low-level network failure occurs (DNS lookup failure, connection refused, connection reset).
 */
declare class NetworkError extends AiMemoryError {
    constructor(message?: string, details?: unknown);
}
/**
 * Thrown when a request exceeds the configured timeout threshold.
 */
declare class TimeoutError extends AiMemoryError {
    constructor(message?: string, details?: unknown);
}
/**
 * Thrown when an endpoint returns an unhandled HTTP 5xx server error.
 */
declare class ServerError extends AiMemoryError {
    constructor(message?: string, status?: number, details?: unknown);
}

/**
 * Standardized colon-separated lowercase event dictionary for AiMemorySync SDK.
 */
interface AiMemoryEvents {
    "project:resolved": {
        result: ResolveProjectResult;
    };
    "project:created": {
        project: ProjectDto;
    };
    "project:updated": {
        project: ProjectDto;
    };
    "project:archived": {
        projectId: string;
    };
    "memory:created": {
        memory: MemoryDto;
    };
    "memory:updated": {
        memory: MemoryDto;
    };
    "memory:deprecated": {
        memory: MemoryDto;
    };
    "memory:archived": {
        memoryId: string;
        projectId: string;
    };
    "context:updated": {
        projectId: string;
    };
    "auth:unauthorized": {
        error: AuthenticationError;
    };
    "auth:forbidden": {
        error: AuthorizationError;
        requiredScope?: string;
    };
    "rate-limit:exceeded": {
        error: RateLimitError;
        retryAfterSecs?: number;
    };
    "network:error": {
        error: NetworkError;
    };
}

type EventHandler<T> = (payload: T) => void | Promise<void>;
/**
 * Platform-independent, zero-dependency Typed Event Emitter.
 */
declare class TypedEventEmitter {
    private listeners;
    /**
     * Subscribes a listener to a specific event.
     * @returns Unsubscribe function to easily detach the listener.
     */
    on<E extends keyof AiMemoryEvents>(event: E, handler: EventHandler<AiMemoryEvents[E]>): () => void;
    /**
     * Subscribes a listener that will trigger at most once.
     * @returns Unsubscribe function.
     */
    once<E extends keyof AiMemoryEvents>(event: E, handler: EventHandler<AiMemoryEvents[E]>): () => void;
    /**
     * Removes a specific listener from an event.
     */
    off<E extends keyof AiMemoryEvents>(event: E, handler: EventHandler<AiMemoryEvents[E]>): void;
    /**
     * Synchronously dispatches an event to all registered listeners.
     */
    emit<E extends keyof AiMemoryEvents>(event: E, payload: AiMemoryEvents[E]): void;
    /**
     * Returns the count of active listeners for a given event.
     */
    listenerCount<E extends keyof AiMemoryEvents>(event: E): number;
    /**
     * Clears all listeners for a given event or all events if none specified.
     */
    removeAllListeners<E extends keyof AiMemoryEvents>(event?: E): void;
}

interface RequestOptions extends Omit<RequestInit, "headers"> {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRetries?: number;
    query?: Record<string, string | number | boolean | undefined | null>;
}
interface HttpClientConfig {
    baseUrl: string;
    getApiKey: () => Promise<string | null>;
    platform: string;
    clientId?: string;
    timeoutMs?: number;
    maxRetries?: number;
    fetch?: typeof globalThis.fetch;
    logger: LoggerAdapter;
    events: TypedEventEmitter;
}
declare class HttpClient {
    private readonly baseUrl;
    private readonly getApiKey;
    private readonly platform;
    private readonly clientId?;
    private readonly defaultTimeoutMs;
    private readonly defaultMaxRetries;
    private readonly fetchImpl;
    private readonly logger;
    private readonly events;
    constructor(config: HttpClientConfig);
    /**
     * Executes a typed HTTP request with automatic timeout, resilience retries, envelope unwrapping, and error mapping.
     */
    request<T>(path: string, options?: RequestOptions): Promise<T>;
    private buildUrl;
}

interface ApiKeyRecord {
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
interface CreateKeyPayload {
    name: string;
    scopes?: string[];
    expiresInDays?: number;
}
interface CreateKeyResult {
    apiKey: ApiKeyRecord;
    rawKey: string;
}
declare class AuthModule {
    private readonly http;
    private readonly storage;
    private inMemoryKey;
    constructor(http: HttpClient, storage: SecureStorageAdapter, initialApiKey?: string);
    /**
     * Sets the active API key and stores it in secure storage.
     */
    setApiKey(apiKey: string): Promise<void>;
    /**
     * Retrieves the active API key from memory or secure storage.
     */
    getApiKey(): Promise<string | null>;
    /**
     * Clears the active API key from memory and secure storage.
     */
    clearApiKey(): Promise<void>;
    /**
     * Lists all registered API keys (Requires admin scope).
     */
    listKeys(): Promise<ApiKeyRecord[]>;
    /**
     * Generates a new API key. Displays rawKey strictly once (Requires admin scope).
     */
    createKey(payload: CreateKeyPayload): Promise<CreateKeyResult>;
    /**
     * Revokes an API key immediately (Requires admin scope).
     */
    revokeKey(id: string): Promise<ApiKeyRecord>;
}

declare class ProjectsModule {
    private readonly http;
    private readonly cache;
    private readonly events;
    constructor(http: HttpClient, cache: CacheAdapter, events: TypedEventEmitter);
    /**
     * Resolves incoming discovery signals (Git remote, monorepo subpath, package manifest, etc.)
     * to an existing Project or automatically provisions a new one.
     */
    resolve(input: ResolveProjectInput): Promise<ResolveProjectResult>;
    /**
     * Lists active or archived projects.
     */
    list(filter?: ListProjectsFilter): Promise<ProjectDto[]>;
    /**
     * Retrieves a single project by its UUID.
     */
    get(id: string): Promise<ProjectDto>;
    /**
     * Creates a new project manually.
     */
    create(payload: CreateProjectPayload): Promise<ProjectDto>;
    /**
     * Updates an existing project's fields.
     */
    update(id: string, payload: UpdateProjectPayload): Promise<ProjectDto>;
    /**
     * Soft-archives a project.
     */
    archive(id: string): Promise<ProjectDto>;
    private invalidateListCache;
}

declare class MemoriesModule {
    private readonly http;
    private readonly cache;
    private readonly events;
    constructor(http: HttpClient, cache: CacheAdapter, events: TypedEventEmitter);
    /**
     * Lists memories strictly scoped to a specified project.
     */
    list(projectId: string, filter?: ListMemoriesFilter): Promise<MemoryDto[]>;
    /**
     * Retrieves a single memory item by its UUID.
     */
    get(id: string): Promise<MemoryDto>;
    /**
     * Creates a new memory record strictly scoped to a project.
     */
    create(projectId: string, payload: CreateMemoryPayload): Promise<MemoryDto>;
    /**
     * Updates an existing memory record.
     */
    update(id: string, payload: UpdateMemoryPayload): Promise<MemoryDto>;
    /**
     * Soft-deprecates a memory record.
     */
    deprecate(id: string): Promise<MemoryDto>;
    /**
     * Soft-archives a memory record.
     */
    archive(id: string): Promise<MemoryDto>;
    private invalidateProjectMemories;
}

declare class ContextModule {
    private readonly http;
    private readonly cache;
    constructor(http: HttpClient, cache: CacheAdapter);
    /**
     * Generates active, token/character-budgeted Markdown AI context for a project.
     */
    get(projectId: string, options?: ContextOptions): Promise<AssembledContextResult>;
}

/**
 * Main platform-independent client facade for AiMemorySync.
 */
declare class AiMemoryClient {
    readonly events: TypedEventEmitter;
    readonly auth: AuthModule;
    readonly projects: ProjectsModule;
    readonly memories: MemoriesModule;
    readonly context: ContextModule;
    private readonly http;
    constructor(options: ClientOptions);
}

interface RetryOptions {
    maxRetries?: number;
    baseBackoffMs?: number;
    maxBackoffMs?: number;
}
/**
 * Calculates exponential backoff with full jitter in milliseconds.
 */
declare function calculateBackoff(attempt: number, baseMs?: number, maxMs?: number): number;
/**
 * Parses standard HTTP 'Retry-After' header (either seconds or RFC 2822 date).
 * Returns delay in milliseconds or null if missing/invalid.
 */
declare function parseRetryAfter(headerValue?: string | null): number | null;
/**
 * Determines if an HTTP request method is safe for automatic retries.
 * By default, only idempotent GET requests are retried.
 */
declare function isRetryableMethod(method?: string): boolean;
/**
 * Determines if an HTTP status code is transient/retryable.
 */
declare function isRetryableStatus(status: number): boolean;
/**
 * Sleep helper for async delay.
 */
declare function sleep(ms: number): Promise<void>;

export { AiMemoryClient, AiMemoryError, type AiMemoryEvents, type ApiErrorResponse, type ApiKeyRecord, type ApiResponse, type AssembledContextResult, type AssembledContextSection, AuthModule, AuthenticationError, AuthorizationError, type CacheAdapter, type CacheOptions, type ClientOptions, ConflictError, ConsoleLogger, ContextModule, type ContextOptions, type CreateKeyPayload, type CreateKeyResult, type CreateMemoryPayload, type CreateProjectPayload, type DiscoverySignals, type DiscoverySource, EphemeralStorageAdapter, type EventHandler, HttpClient, type HttpClientConfig, InMemoryCache, type ListMemoriesFilter, type ListProjectsFilter, type LoggerAdapter, MemoriesModule, type MemoryDto, type MemoryPriority, type MemoryStatus, type MemoryType, NetworkError, NoopLogger, NotFoundError, type PackageManifestSignal, type PaginationOptions, type ProjectCreationSource, type ProjectDto, type ProjectIdentityType, type ProjectStatus, ProjectsModule, RateLimitError, type RequestOptions, type ResolveProjectInput, type ResolveProjectResult, type ResolvedClientConfig, type RetryOptions, type SafeLogMetadata, type SecureStorageAdapter, ServerError, TimeoutError, TypedEventEmitter, type UpdateMemoryPayload, type UpdateProjectPayload, ValidationError, calculateBackoff, isRetryableMethod, isRetryableStatus, parseRetryAfter, resolveConfig, sleep };
