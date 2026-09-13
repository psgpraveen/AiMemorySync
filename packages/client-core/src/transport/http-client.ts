import type { ApiResponse, ApiErrorResponse } from "../types/index.js";
import type { LoggerAdapter } from "../adapters/index.js";
import type { TypedEventEmitter } from "../events/index.js";
import {
  AiMemoryError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ServerError,
} from "./errors.js";
import {
  calculateBackoff,
  parseRetryAfter,
  isRetryableMethod,
  isRetryableStatus,
  sleep,
} from "./retry.js";

export interface RequestOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export interface HttpClientConfig {
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

export class HttpClient {
  private baseUrl: string;
  private readonly getApiKey: () => Promise<string | null>;
  private readonly platform: string;
  private readonly clientId?: string;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxRetries: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly logger: LoggerAdapter;
  private readonly events: TypedEventEmitter;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.getApiKey = config.getApiKey;
    this.platform = config.platform;
    this.clientId = config.clientId;
    this.defaultTimeoutMs = config.timeoutMs ?? 10000;
    this.defaultMaxRetries = config.maxRetries ?? 3;
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.logger = config.logger;
    this.events = config.events;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, "");
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Executes a typed HTTP request with automatic timeout, resilience retries, envelope unwrapping, and error mapping.
   */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-aimemory-client": "@aimemory/client-core",
          "x-aimemory-platform": this.platform,
          ...(this.clientId ? { "x-aimemory-client-id": this.clientId } : {}),
          ...(options.headers ?? {}),
        };

        if (apiKey && !headers["Authorization"] && !headers["authorization"]) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        this.logger.debug(`HTTP ${method} ${sanitizedPath}`, {
          method,
          url: sanitizedPath,
          retryCount: attempt,
        });

        const response = await this.fetchImpl(url, {
          ...options,
          method,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        // 1. Success path (HTTP 2xx)
        if (response.ok) {
          this.logger.debug(`HTTP ${method} ${sanitizedPath} ${response.status}`, {
            method,
            url: sanitizedPath,
            status: response.status,
            durationMs,
          });

          // Handle 204 No Content or empty bodies
          if (response.status === 204) {
            return undefined as unknown as T;
          }

          const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;
          if (json && typeof json === "object" && "data" in json) {
            return json.data;
          }

          return json as unknown as T;
        }

        // 2. HTTP Error handling
        const errorJson = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        const errorPayload = errorJson?.error;
        const errorMessage = errorPayload?.message || `Request failed with status ${response.status}`;
        const errorDetails = errorPayload?.details;

        this.logger.warn(`HTTP ${method} ${sanitizedPath} returned ${response.status}`, {
          method,
          url: sanitizedPath,
          status: response.status,
          durationMs,
        });

        // 2a. Handle 401 Unauthorized
        if (response.status === 401) {
          const authError = new AuthenticationError(errorMessage, errorDetails);
          this.events.emit("auth:unauthorized", { error: authError });
          throw authError;
        }

        // 2b. Handle 403 Forbidden
        if (response.status === 403) {
          const forbiddenError = new AuthorizationError(errorMessage, errorDetails);
          this.events.emit("auth:forbidden", { error: forbiddenError });
          throw forbiddenError;
        }

        // 2c. Handle 404 Not Found
        if (response.status === 404) {
          throw new NotFoundError(errorMessage, errorDetails);
        }

        // 2d. Handle 409 Conflict
        if (response.status === 409) {
          throw new ConflictError(errorMessage, errorDetails);
        }

        // 2e. Handle 400 Validation Error
        if (response.status === 400) {
          throw new ValidationError(errorMessage, errorDetails);
        }

        // 2f. Handle 429 Rate Limit
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get("Retry-After");
          const retryAfterMs = parseRetryAfter(retryAfterHeader);
          const retryAfterSecs = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined;

          const rateLimitError = new RateLimitError(errorMessage, retryAfterSecs, errorDetails);
          this.events.emit("rate-limit:exceeded", { error: rateLimitError, retryAfterSecs });
          throw rateLimitError;
        }

        // 2g. Check transient 5xx for retry
        if (isSafeToRetry && isRetryableStatus(response.status) && attempt < maxRetries) {
          attempt++;
          const backoff = calculateBackoff(attempt);
          this.logger.info(`Retrying ${method} ${sanitizedPath} (attempt ${attempt}/${maxRetries}) in ${backoff}ms...`, {
            method,
            url: sanitizedPath,
            status: response.status,
            retryCount: attempt,
          });
          await sleep(backoff);
          continue;
        }

        // Unhandled 5xx
        throw new ServerError(errorMessage, response.status, errorDetails);
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        // If it is already one of our typed errors, rethrow directly unless retryable
        if (err instanceof AiMemoryError) {
          throw err;
        }

        const isAbort = (err as { name?: string })?.name === "AbortError";
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

        // Low-level network failure (DNS, ECONNREFUSED)
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
            retryCount: attempt,
          });
          await sleep(backoff);
          continue;
        }

        this.events.emit("network:error", { error: networkErr });
        throw networkErr;
      }
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const fullUrl = `${this.baseUrl}${cleanPath}`;

    if (!query) return fullUrl;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    }

    const queryString = searchParams.toString();
    return queryString ? `${fullUrl}?${queryString}` : fullUrl;
  }
}
