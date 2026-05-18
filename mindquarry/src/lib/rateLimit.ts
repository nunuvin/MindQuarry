/**
 * Basic in-memory rate limiter using a Map.
 * Note: In a production environment with multiple server instances or serverless functions,
 * you should replace this with a persistent store like Redis or Upstash.
 */

interface RateLimitTracker {
    count: number;
    resetTime: number;
}

const memoryStore = new Map<string, RateLimitTracker>();

/**
 * Checks if a specific action by a user should be rate limited.
 * @param {string} userId - The identifier of the user (or IP address).
 * @param {string} action - The string grouping the action (e.g. 'post_query', 'send_message').
 * @param {number} maxRequests - The maximum allowed requests within the window.
 * @param {number} windowMs - The time window in milliseconds.
 * @returns {boolean} True if the action should be blocked (rate limited).
 */
export function isRateLimited(userId: string, action: string, maxRequests: number = 5, windowMs: number = 60000): boolean {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const tracker = memoryStore.get(key);

    if (!tracker) {
        memoryStore.set(key, { count: 1, resetTime: now + windowMs });
        return false;
    }

    if (now > tracker.resetTime) {
        // Window expired, reset
        tracker.count = 1;
        tracker.resetTime = now + windowMs;
        return false;
    }

    tracker.count += 1;
    if (tracker.count > maxRequests) {
        return true;
    }

    return false;
}
