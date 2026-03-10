/**
 * In-memory server-side cache for API routes (Next.js server).
 * Use for external fetches to avoid repeated identical requests.
 * Key by URL or logical key; TTL per entry.
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached value if present and not expired.
 */
export function get<T>(key: string): T | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.value;
}

/**
 * Set cache entry with TTL in milliseconds.
 */
export function set<T>(key: string, value: T, ttlMs: number): void {
    store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
    });
}

/**
 * Delete a single key (e.g. for invalidation).
 */
export function del(key: string): void {
    store.delete(key);
}

/**
 * TTL constants for reuse (in ms).
 */
export const TTL = {
    /** Short-lived (e.g. manifest / index): 15–60 min */
    MANIFEST_MS: 30 * 60 * 1000,       // 30 min
    /** Daily/snapshot data: several hours */
    DAILY_MS: 4 * 60 * 60 * 1000,     // 4 h
    /** Brief cache for failed fetches to avoid hammering */
    NEGATIVE_MS: 2 * 60 * 1000,       // 2 min
} as const;
