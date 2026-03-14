import { globalState, POLL_INTERVAL } from "./state";
import { getOpenSkyAccessToken } from "./auth";
import { getLatestFromSupabase, recordToSupabase } from "./supabase";
import { updateFileCache } from "./cache";
import { set } from "@/lib/serverCache";
import { CACHE_KEY_AVIATION, LAST_GOOD_KEY_AVIATION, STALE_MAX_AGE_MS, AVIATION_CACHE_TTL_MS } from "./cacheKeys";

export async function pollAviation() {
    // Prevent overlapping requests and accidental double-entry (e.g. from multiple register() calls)
    if (globalState.isFetching) return;
    globalState.isFetching = true;

    try {
        const now = Date.now();
        const username = process.env.OPENSKY_CLIENTID;
        const password = process.env.OPENSKY_CLIENTSECRET;
        const headers: Record<string, string> = {};

        // Try OAuth2 token first (for new accounts created after March 2025)
        const token = await getOpenSkyAccessToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        } else if (username && password) {
            // Fallback to Basic Auth (for legacy accounts)
            headers["Authorization"] =
                "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
        }

        const res = await fetch("https://opensky-network.org/api/states/all", {
            headers,
            // Don't cache via Next.js fetch cache, we manage our own manual interval
            cache: "no-store",
            signal: AbortSignal.timeout(8000), // 8 second timeout to prevent hanging
        });

        if (!res.ok) {
            globalState.openskyLastStatus = res.status;
            // Invalidate token so next poll uses a fresh one (rotate immediately on any API failure)
            globalState.accessToken = null;
            globalState.tokenExpiry = 0;

            globalState.currentBackoff = Math.min((globalState.currentBackoff || POLL_INTERVAL) * 2, 5 * 60 * 1000);

            const retryAfter = res.headers.get("Retry-After");
            const retryInfo = retryAfter ? ` [Retry after: ${retryAfter}s]` : "";

            console.warn(`[Aviation Polling] OpenSky returned ${res.status}: ${res.statusText}${retryInfo} (Backing off to ${globalState.currentBackoff / 1000}s)`);

            // If rate limited and we have NO cache, try fallback.
            if (res.status === 429 && !globalState.aviationData) {
                console.log("[Aviation Polling] Rate limited and no cache. Attempting fallback to Supabase history...");
                const { data: fallbackData } = await getLatestFromSupabase();
                if (fallbackData && Array.isArray(fallbackData.states) && fallbackData.states.length > 0) {
                    console.log(`[Aviation Polling] Fallback successful. Cached ${fallbackData.states.length} states. Writing to serverCache keys: ${CACHE_KEY_AVIATION}, ${LAST_GOOD_KEY_AVIATION}`);
                    globalState.aviationData = fallbackData;
                    globalState.aviationTimestamp = now;
                    updateFileCache(fallbackData, now);
                    set(CACHE_KEY_AVIATION, fallbackData, AVIATION_CACHE_TTL_MS);
                    set(LAST_GOOD_KEY_AVIATION, fallbackData, STALE_MAX_AGE_MS);
                }
            }
        } else {
            // Reset backoff on success
            globalState.currentBackoff = POLL_INTERVAL;

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
        // Exponential backoff on error as well
        globalState.currentBackoff = Math.min((globalState.currentBackoff || POLL_INTERVAL) * 2, 5 * 60 * 1000);

        const error = err as any;
        const isTimeout = error?.name === 'AbortError' || error?.name === 'TimeoutError' || error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
        const errorMessage = isTimeout ? 'Connection timed out' : (error?.message || String(error));
        console.error(`[Aviation Polling] Error during poll (Backing off to ${globalState.currentBackoff / 1000}s): ${errorMessage}`);

        // On unexpected error, try fallback if we have no cache
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

        // Schedule next poll using currentBackoff
        if (globalState.aviationPollingInterval) {
            clearTimeout(globalState.aviationPollingInterval);
        }
        // Apply a small random jitter (0-5s) to prevent synchronized requests from multiple clients
        const jitter = Math.floor(Math.random() * 5000);
        globalState.aviationPollingInterval = setTimeout(pollAviation, (globalState.currentBackoff || POLL_INTERVAL) + jitter);
    }
}
