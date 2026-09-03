export interface RetryOptions {
  maxRetries?: number;      // Default: 3 for GET, 0 for mutations
  baseBackoffMs?: number;   // Default: 300ms
  maxBackoffMs?: number;    // Default: 5000ms
}

/**
 * Calculates exponential backoff with full jitter in milliseconds.
 */
export function calculateBackoff(
  attempt: number,
  baseMs: number = 300,
  maxMs: number = 5000
): number {
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  // Apply jitter between 75% and 125% of calculated backoff
  const jitterFactor = 0.75 + Math.random() * 0.5;
  return Math.floor(exponential * jitterFactor);
}

/**
 * Parses standard HTTP 'Retry-After' header (either seconds or RFC 2822 date).
 * Returns delay in milliseconds or null if missing/invalid.
 */
export function parseRetryAfter(headerValue?: string | null): number | null {
  if (!headerValue || typeof headerValue !== "string") return null;

  const trimmed = headerValue.trim();
  if (!trimmed) return null;

  // 1. Try integer seconds
  const seconds = Number(trimmed);
  if (!isNaN(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1000);
  }

  // 2. Try HTTP-date string
  const dateMs = Date.parse(trimmed);
  if (!isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return Math.max(0, diff);
  }

  return null;
}

/**
 * Determines if an HTTP request method is safe for automatic retries.
 * By default, only idempotent GET requests are retried.
 */
export function isRetryableMethod(method: string = "GET"): boolean {
  return method.toUpperCase() === "GET";
}

/**
 * Determines if an HTTP status code is transient/retryable.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Sleep helper for async delay.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
