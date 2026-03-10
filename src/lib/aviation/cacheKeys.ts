/**
 * Shared cache key constants so polling writer and API reader use the same keys.
 * Used by: lib/aviation/polling.ts (writes), app/api/aviation/route.ts (reads/writes).
 */
export const CACHE_KEY_AVIATION = "aviation";
export const LAST_GOOD_KEY_AVIATION = "aviation_last_good";
/** Max age for last-known-good when OpenSky 429 and fallback fail */
export const STALE_MAX_AGE_MS = 60 * 60 * 1000;
/** TTL for main aviation cache when written by polling */
export const AVIATION_CACHE_TTL_MS = 5 * 60 * 1000;
