import type { SecureStorageAdapter, CacheAdapter, LoggerAdapter } from "./adapters/index.js";
import { EphemeralStorageAdapter, InMemoryCache, NoopLogger } from "./adapters/index.js";
import { ValidationError } from "./transport/errors.js";

export interface ClientOptions {
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

export interface ResolvedClientConfig {
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
export function resolveConfig(options: ClientOptions): ResolvedClientConfig {
  if (!options || typeof options !== "object") {
    throw new ValidationError("Client options must be provided as an object");
  }

  if (!options.baseUrl || typeof options.baseUrl !== "string" || !options.baseUrl.trim()) {
    throw new ValidationError("options.baseUrl is required and must be a non-empty string");
  }

  const normalizedBaseUrl = options.baseUrl.trim().replace(/\/+$/, "");

  // Basic URL validity check
  try {
    const parsed = new URL(normalizedBaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Protocol must be http: or https:");
    }
  } catch (err) {
    throw new ValidationError(
      `Invalid baseUrl: '${options.baseUrl}'. Must be a valid HTTP or HTTPS URL.`,
      err instanceof Error ? err.message : undefined
    );
  }

  const timeoutMs = options.timeoutMs ?? 10000;
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
    logger: options.logger ?? new NoopLogger(),
  };
}
