import { createClient } from "@supabase/supabase-js";

// Global state to survive HMR in Next.js development
const globalState = globalThis as unknown as {
    aviationData: any;
    aviationTimestamp: number;
    aviationPollingStarted: boolean;
    aviationPollingInterval: NodeJS.Timeout | null;
    accessToken: string | null;
    tokenExpiry: number;
    isFetching: boolean;
};

if (globalState.aviationPollingStarted === undefined) {
    globalState.aviationData = null;
    globalState.aviationTimestamp = 0;
    globalState.aviationPollingStarted = false;
    globalState.aviationPollingInterval = null;
    globalState.accessToken = null;
    globalState.tokenExpiry = 0;
    globalState.isFetching = false;
}

const POLL_INTERVAL = 5000; // 5 seconds

export function getCachedAviationData() {
    return {
        data: globalState.aviationData,
        timestamp: globalState.aviationTimestamp,
    };
}

export function startAviationPolling() {
    if (globalState.aviationPollingStarted) {
        return;
    }

    globalState.aviationPollingStarted = true;
    console.log(`[Aviation Polling] Starting background polling every ${POLL_INTERVAL}ms`);

    // Run immediately, then interval
    pollAviation();
    globalState.aviationPollingInterval = setInterval(pollAviation, POLL_INTERVAL);
}

async function pollAviation() {
    if (globalState.isFetching) return;
    globalState.isFetching = true;

    try {
        const now = Date.now();
        const username = process.env.OPENSKY_USERNAME;
        const password = process.env.OPENSKY_PASSWORD;
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
            cache: "no-store"
        });

        if (!res.ok) {
            console.warn(`[Aviation Polling] OpenSky returned ${res.status}: ${res.statusText}`);

            // If rate limited and we have NO cache, we might want to try fallback. 
            // We'll update the cache with fallback data if needed.
            if (res.status === 429 && !globalState.aviationData) {
                console.log("[Aviation Polling] Rate limited by OpenSky and no cache. Attempting fallback to Supabase history...");
                const fallbackData = await getLatestFromSupabase();
                if (fallbackData) {
                    console.log(`[Aviation Polling] Fallback successful. Cached ${fallbackData.states.length} historical states.`);
                    globalState.aviationData = fallbackData;
                    globalState.aviationTimestamp = now;
                }
            }
        } else {
            const data = await res.json();
            data._source = "live";

            console.log(`[Aviation Polling] Successfully fetched ${data.states ? data.states.length : 0} states from OpenSky`);
            globalState.aviationData = data;
            globalState.aviationTimestamp = now;

            // Asynchronously save to Supabase to build history (do not block)
            if (data.states && Array.isArray(data.states)) {
                recordToSupabase(data.states, data.time || Math.floor(now / 1000)).catch(err => {
                    console.error("[Aviation Polling] Supabase record error:", err);
                });
            }
        }
    } catch (err) {
        console.error("[Aviation Polling] Error during poll:", err);
        // On unexpected error, try fallback if we have no cache
        if (!globalState.aviationData) {
            const fallbackData = await getLatestFromSupabase();
            if (fallbackData) {
                globalState.aviationData = fallbackData;
                globalState.aviationTimestamp = Date.now();
            }
        }
    } finally {
        globalState.isFetching = false;
    }
}

async function getOpenSkyAccessToken() {
    const now = Date.now();
    if (globalState.accessToken && now < globalState.tokenExpiry) {
        return globalState.accessToken;
    }

    const clientId = process.env.OPENSKY_USERNAME;
    const clientSecret = process.env.OPENSKY_PASSWORD;

    if (!clientId || !clientSecret) return null;

    if (!clientId.includes("@") && !clientId.endsWith("-api-client")) {
        return null;
    }

    try {
        const response = await fetch("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret,
            }),
            cache: "no-store"
        });

        if (!response.ok) {
            console.error(`[Aviation Polling] OAuth token error (${response.status}):`, await response.text());
            return null;
        }

        const data = await response.json();
        globalState.accessToken = data.access_token;
        globalState.tokenExpiry = now + (data.expires_in * 1000) - 30000;

        console.log("[Aviation Polling] Successfully acquired new OpenSky OAuth token");
        return globalState.accessToken;
    } catch (error) {
        console.error("[Aviation Polling] OAuth token request failed:", error);
        return null;
    }
}

export async function getLatestFromSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { data: latestTS, error: tsError } = await supabase
            .from("aviation_history")
            .select("timestamp")
            .order("timestamp", { ascending: false })
            .limit(1);

        if (tsError || !latestTS || latestTS.length === 0) return null;

        const timestamp = latestTS[0].timestamp;

        const { data: records, error: recError } = await supabase
            .from("aviation_history")
            .select("*")
            .eq("timestamp", timestamp);

        if (recError || !records) return null;

        const states = records.map(r => [
            r.icao24, r.callsign, null, Math.floor(new Date(r.timestamp).getTime() / 1000), Math.floor(new Date(r.timestamp).getTime() / 1000), r.longitude, r.latitude, r.altitude, r.altitude === null || r.altitude <= 0, r.speed, r.heading, null, null, r.altitude, null, false, 0
        ]);

        return {
            states,
            time: Math.floor(new Date(timestamp).getTime() / 1000),
            _source: "supabase",
            _isFallback: true
        };
    } catch (e) {
        console.error("[Aviation Polling] Fallback error:", e);
        return null;
    }
}

async function recordToSupabase(states: any[], timeSecs: number) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const timestamp = new Date(timeSecs * 1000).toISOString();

    const records = states
        .filter(s => s[5] !== null && s[6] !== null)
        .map(s => ({
            timestamp,
            icao24: s[0],
            callsign: s[1]?.trim() || null,
            longitude: s[5],
            latitude: s[6],
            altitude: s[7],
            speed: s[9],
            heading: s[10],
        }));

    if (records.length === 0) return;

    const CHUNK_SIZE = 500;
    let successCount = 0;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("aviation_history").insert(chunk);

        if (error) {
            console.error(`[Aviation Polling] Failed to insert chunk:`, error.message);
        } else {
            successCount += chunk.length;
        }
    }

    console.log(`[Aviation Polling] Recorded ${successCount}/${records.length} states to Supabase.`);
}
