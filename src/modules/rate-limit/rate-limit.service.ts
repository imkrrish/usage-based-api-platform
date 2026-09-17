// Rate limiter configuration
const RATE_LIMIT = 100; // Maximum requests per window
const WINDOW_MS = 60000; // 1 minute in milliseconds

// In-memory store: Map<api_key, timestamp[]>
const requestStore: Map<string, number[]> = new Map();

// Result of rate limit check
export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Removes timestamps older than the window
 */
function cleanOldTimestamps(timestamps: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  return timestamps.filter((ts) => ts > cutoff);
}

/**
 * Checks if a request is allowed under the rate limit
 * Uses a rolling window algorithm
 */
export function checkRateLimit(apiKey: string): RateLimitResult {
  const now = Date.now();

  // Get existing timestamps for this API key
  let timestamps = requestStore.get(apiKey);

  if (timestamps === undefined) {
    timestamps = [];
  }

  // Clean old timestamps
  timestamps = cleanOldTimestamps(timestamps, now);

  // Check if under limit
  if (timestamps.length < RATE_LIMIT) {
    // Add current request timestamp
    timestamps.push(now);
    requestStore.set(apiKey, timestamps);
    return { allowed: true };
  }

  // Rate limit exceeded - calculate retry after
  const oldestTimestamp = timestamps[0];
  if (oldestTimestamp === undefined) {
    // Should never happen, but handle gracefully
    return { allowed: true };
  }

  const retryAfterMs = oldestTimestamp + WINDOW_MS - now;
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

  // Update store with cleaned timestamps
  requestStore.set(apiKey, timestamps);

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, retryAfterSeconds),
  };
}

/**
 * Clears all rate limit data (useful for testing)
 */
export function clearRateLimitStore(): void {
  requestStore.clear();
}

/**
 * Gets current request count for an API key (useful for testing/debugging)
 */
export function getRequestCount(apiKey: string): number {
  const timestamps = requestStore.get(apiKey);
  if (timestamps === undefined) {
    return 0;
  }
  const now = Date.now();
  const cleaned = cleanOldTimestamps(timestamps, now);
  return cleaned.length;
}
