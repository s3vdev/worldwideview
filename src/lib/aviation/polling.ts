import { globalState, POLL_INTERVAL, MIN_BACKOFF_AFTER_429_MS, AVIATION_CACHE_FRESH_MS } from "./state";
import { getCachedAviationData } from "./cache";
import { getOpenSkyAccessToken } from "./auth";
import { getLatestFromSupabase, recordToSupabase } from "./supabase";
import { updateFileCache } from "./cache";
import { set } from "@/lib/serverCache";
import { CACHE_KEY_AVIATION, LAST_GOOD_KEY_AVIATION, STALE_MAX_AGE_MS, AVIATION_CACHE_TTL_MS } from "./cacheKeys";

const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
const JITTER_MS = 5000; // 0–5s jitter

/** Parse Retry-After or X-Rate-Limit-Retry-After-Seconds to milliseconds. Returns 0 if missing/invalid. */
function parseRetryAfterMs(res: Response): number {
    const opensky = res.headers.get("X-Rate-Limit-Retry-After-Seconds");
    if (opensky != null) {
        const sec = parseInt(opensky, 10);
        if (Number.isFinite(sec) && sec > 0) return sec * 1000;
    }
    const standard = res.headers.get("Retry-After");
    if (standard != null) {
        const sec = parseInt(standard, 10);
        if (Number.isFinite(sec) && sec > 0) return sec * 1000;
    }
    return 0;
}

/**
 * One-shot fetch for OpenSky when GET /api/aviation is called (layer enabled). Does not schedule next poll.
 * Skips if cache is fresh, already fetching, or we're in backoff after 429.
 */
export async function fetchAviationIfNeeded(): Promise<void> {
    const cached = getCachedAviationData();
    if (cached?.data && cached.timestamp && Date.now() - cached.timestamp < AVIATION_CACHE_FRESH_MS) return;
    if (globalState.isFetching) return;
    const now = Date.now();
    if (globalState.lastFailureTime && now - globalState.lastFailureTime < (globalState.currentBackoff || POLL_INTERVAL)) return;

    globalState.isFetching = true;
    try {
        const username = process.env.OPENSKY_CLIENTID;
        const password = process.env.OPENSKY_CLIENTSECRET;
        const headers: Record<string, string> = {};
        const token = await getOpenSkyAccessToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
        else if (username && password) headers["Authorization"] = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

        const res = await fetch("https://opensky-network.org/api/states/all", { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });

        if (!res.ok) {
            globalState.openskyLastStatus = res.status;
            globalState.accessToken = null;
            globalState.tokenExpiry = 0;
            globalState.lastFailureTime = Date.now();
            const retryAfterMs = parseRetryAfterMs(res);
            if (res.status === 429) {
                globalState.retryAfterMs = retryAfterMs > 0 ? retryAfterMs : MIN_BACKOFF_AFTER_429_MS;
                globalState.currentBackoff = Math.min(Math.max(globalState.currentBackoff || POLL_INTERVAL, globalState.retryAfterMs), MAX_BACKOFF_MS);
            } else {
                globalState.currentBackoff = Math.min((globalState.currentBackoff || POLL_INTERVAL) * 2, MAX_BACKOFF_MS);
            }
            if (res.status === 429 && !globalState.aviationData) {
                const { data: fallbackData } = await getLatestFromSupabase();
                if (fallbackData?.states?.length) {
                    globalState.aviationData = fallbackData;
                    globalState.aviationTimestamp = now;
                    updateFileCache(fallbackData, now);
                    set(CACHE_KEY_AVIATION, fallbackData, AVIATION_CACHE_TTL_MS);
                    set(LAST_GOOD_KEY_AVIATION, fallbackData, STALE_MAX_AGE_MS);
                }
            }
            return;
        }
        globalState.currentBackoff = POLL_INTERVAL;
        globalState.lastFailureTime = 0;
        const data = await res.json();
        data._source = "live";
        globalState.aviationData = data;
        globalState.aviationTimestamp = now;
        updateFileCache(data, now);
        set(CACHE_KEY_AVIATION, data, AVIATION_CACHE_TTL_MS);
        set(LAST_GOOD_KEY_AVIATION, data, STALE_MAX_AGE_MS);
        if (data.states?.length && now - (globalState.lastSupabaseInsert || 0) > 5 * 60 * 1000) {
            globalState.lastSupabaseInsert = now;
            recordToSupabase(data.states, data.time || Math.floor(now / 1000)).catch(() => {});
        }
    } catch (err) {
        globalState.lastFailureTime = Date.now();
        globalState.currentBackoff = Math.min((globalState.currentBackoff || POLL_INTERVAL) * 2, MAX_BACKOFF_MS);
        if (!globalState.aviationData) {
            const { data: fallbackData } = await getLatestFromSupabase();
            if (fallbackData?.states?.length) {
                globalState.aviationData = fallbackData;
                globalState.aviationTimestamp = Date.now();
                updateFileCache(fallbackData, globalState.aviationTimestamp);
                set(CACHE_KEY_AVIATION, fallbackData, AVIATION_CACHE_TTL_MS);
                set(LAST_GOOD_KEY_AVIATION, fallbackData, STALE_MAX_AGE_MS);
            }
        }
    } finally {
        globalState.isFetching = false;
    }
}

export async function pollAviation() {
    if (globalState.isFetching) {
        return;
    }
    globalState.isFetching = true;

    try {
        const now = Date.now();
        const username = process.env.OPENSKY_CLIENTID;
        const password = process.env.OPENSKY_CLIENTSECRET;
        const headers: Record<string, string> = {};

        const token = await getOpenSkyAccessToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        } else if (username && password) {
            headers["Authorization"] =
                "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
        }

        const res = await fetch("https://opensky-network.org/api/states/all", {
            headers,
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            globalState.openskyLastStatus = res.status;
            globalState.accessToken = null;
            globalState.tokenExpiry = 0;

            globalState.lastFailureTime = Date.now();
            const retryAfterMs = parseRetryAfterMs(res);
            if (res.status === 429) {
                globalState.retryAfterMs = retryAfterMs > 0 ? retryAfterMs : MIN_BACKOFF_AFTER_429_MS;
                globalState.currentBackoff = Math.min(
                    Math.max(globalState.currentBackoff || POLL_INTERVAL, globalState.retryAfterMs),
                    MAX_BACKOFF_MS
                );
                const src = retryAfterMs > 0 ? "Retry-After header" : "conservative fallback";
                console.warn(
                    `[Aviation Polling] 429 — next poll in ${globalState.currentBackoff / 1000}s (${src})`
                );
            } else {
                globalState.currentBackoff = Math.min((globalState.currentBackoff || POLL_INTERVAL) * 2, MAX_BACKOFF_MS);
                console.warn(
                    `[Aviation Polling] OpenSky ${res.status}: ${res.statusText} — backing off to ${globalState.currentBackoff / 1000}s`
                );
            }

            if (res.status === 429 && !globalState.aviationData) {
                const { data: fallbackData } = await getLatestFromSupabase();
                if (fallbackData && Array.isArray(fallbackData.states) && fallbackData.states.length > 0) {
                    globalState.aviationData = fallbackData;
                    globalState.aviationTimestamp = now;
                    updateFileCache(fallbackData, now);
                    set(CACHE_KEY_AVIATION, fallbackData, AVIATION_CACHE_TTL_MS);
                    set(LAST_GOOD_KEY_AVIATION, fallbackData, STALE_MAX_AGE_MS);
                }
            }
        } else {
            globalState.currentBackoff = POLL_INTERVAL;
            globalState.lastFailureTime = 0;

            const data = await res.json();
            data._source = "live";

            console.log(`[Aviation Polling] Successfully fetched ${data.states ? data.states.length : 0} states from OpenSky`);
            
            globalState.aviationData = data;
            globalState.aviationTimestamp = now;
            updateFileCache(data, now);

            // Asynchronously save to Supabase to build history (do not block)
            // Throttle to once every 5 minutes to save Supabase CPU and prevent connection timeouts
            if (data.states && Array.isArray(data.states)) {
                if (now - (globalState.lastSupabaseInsert || 0) > 5 * 60 * 1000) {
                    globalState.lastSupabaseInsert = now;
                    recordToSupabase(data.states, data.time || Math.floor(now / 1000)).catch(err => {
                        console.error("[Aviation Polling] Supabase record error:", err);
                    });
                }
            }
        }
    } catch (err) {
        globalState.currentBackoff = Math.min((globalState.currentBackoff || POLL_INTERVAL) * 2, MAX_BACKOFF_MS);
        const error = err as any;
        const isTimeout = error?.name === 'AbortError' || error?.name === 'TimeoutError' || error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
        const errorMessage = isTimeout ? 'Connection timed out' : (error?.message || String(error));
        console.error(`[Aviation Polling] Error — next poll in ${globalState.currentBackoff / 1000}s: ${errorMessage}`);

        if (!globalState.aviationData) {
            const { data: fallbackData } = await getLatestFromSupabase();
            if (fallbackData && Array.isArray(fallbackData.states) && fallbackData.states.length > 0) {
                globalState.aviationData = fallbackData;
                globalState.aviationTimestamp = Date.now();
                updateFileCache(fallbackData, globalState.aviationTimestamp);
                set(CACHE_KEY_AVIATION, fallbackData, AVIATION_CACHE_TTL_MS);
                set(LAST_GOOD_KEY_AVIATION, fallbackData, STALE_MAX_AGE_MS);
            }
        }
    } finally {
        globalState.isFetching = false;

        if (globalState.aviationPollingInterval) {
            clearTimeout(globalState.aviationPollingInterval);
            globalState.aviationPollingInterval = null;
        }

        const usedRetryAfter = globalState.retryAfterMs > 0;
        const baseMs = usedRetryAfter
            ? Math.max(globalState.retryAfterMs, globalState.currentBackoff || POLL_INTERVAL)
            : (globalState.currentBackoff || POLL_INTERVAL);
        globalState.retryAfterMs = 0;
        const jitter = Math.floor(Math.random() * JITTER_MS);
        const nextMs = baseMs + jitter;
        globalState.aviationPollingInterval = setTimeout(pollAviation, nextMs);

        const reason = usedRetryAfter ? "retry-after" : (baseMs > POLL_INTERVAL ? "backoff" : "normal");
        if (process.env.NODE_ENV === "development" || baseMs >= 60_000) {
            console.log(`[Aviation Polling] Next poll in ${(nextMs / 1000).toFixed(0)}s (${reason})`);
        }
    }
}
