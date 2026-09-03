interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic garbage collection every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    const validTimestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key);
    } else {
      entry.timestamps = validTimestamps;
    }
  }
}

export interface RateLimitResult {
  isAllowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix epoch ms
}

/**
 * In-memory sliding window rate limiter.
 * Tracks requests per identifier (e.g. keyId or client IP).
 *
 * @param identifier Unique key (API Key ID or IP address)
 * @param limit Maximum allowed requests in the time window (default: 60)
 * @param windowMs Time window in milliseconds (default: 60,000ms / 1 min)
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 60,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  cleanupExpiredEntries(windowMs);

  let entry = rateLimitStore.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(identifier, entry);
  }

  // Filter timestamps within the current sliding window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  const resetAt = entry.timestamps.length > 0
    ? entry.timestamps[0] + windowMs
    : now + windowMs;

  if (entry.timestamps.length >= limit) {
    return {
      isAllowed: false,
      limit,
      remaining: 0,
      resetAt,
    };
  }

  entry.timestamps.push(now);

  return {
    isAllowed: true,
    limit,
    remaining: Math.max(0, limit - entry.timestamps.length),
    resetAt,
  };
}

/**
 * Resets rate limit store (used in test suites).
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
