import { createClient } from "@supabase/supabase-js";

export interface SupabaseFallbackDebug {
    supabaseConfigured: boolean;
    supabaseAttempted: boolean;
    supabaseReturnedRows: number;
    supabaseError: string | null;
}

export interface SupabaseFallbackResult {
    data: {
        states: unknown[][];
        time: number;
        _source: string;
        _isFallback: boolean;
    } | null;
    debug: SupabaseFallbackDebug;
}

export async function getLatestFromSupabase(): Promise<SupabaseFallbackResult> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const configured = !!(supabaseUrl && supabaseServiceKey);

    const debug: SupabaseFallbackDebug = {
        supabaseConfigured: configured,
        supabaseAttempted: false,
        supabaseReturnedRows: 0,
        supabaseError: null,
    };

    if (!configured) {
        console.log("[Aviation Supabase] supabaseConfigured: false (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
        return { data: null, debug };
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    const withTimeout = async <T>(promiseLike: PromiseLike<T>, ms = 10000): Promise<T> => {
        let timeoutId: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`Supabase request timed out after ${ms / 1000}s`)), ms);
        });

        try {
            return await Promise.race([
                Promise.resolve(promiseLike),
                timeoutPromise
            ]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    };

    try {
        debug.supabaseAttempted = true;
        console.log("[Aviation Supabase] Fetching latest timestamp from aviation_history...");
        const { data: latestTS, error: tsError } = await withTimeout(
            supabase.from("aviation_history").select("timestamp").order("timestamp", { ascending: false }).limit(1)
        ) as { data: any, error: any };

        if (tsError) {
            debug.supabaseError = tsError.message ?? String(tsError);
            console.error("[Aviation Supabase] Timestamp fetch error:", debug.supabaseError);
            return { data: null, debug };
        }
        if (!latestTS || latestTS.length === 0) {
            console.log("[Aviation Supabase] No historical data found (aviation_history empty or no rows).");
            return { data: null, debug };
        }

        const timestamp = latestTS[0].timestamp;
        console.log(`[Aviation Supabase] Found latest timestamp ${timestamp}. Fetching record batch...`);

        const { data: records, error: recError } = await withTimeout(
            supabase.from("aviation_history").select("*").eq("timestamp", timestamp)
        ) as { data: any, error: any };

        if (recError) {
            debug.supabaseError = recError.message ?? String(recError);
            console.error("[Aviation Supabase] Records batch fetch error:", debug.supabaseError);
            return { data: null, debug };
        }
        if (!records) return { data: null, debug };

        debug.supabaseReturnedRows = records.length;
        console.log(`[Aviation Supabase] Success. supabaseReturnedRows: ${records.length}`);

        const states = records.map((r: any) => [
            r.icao24, r.callsign, null, Math.floor(new Date(r.timestamp).getTime() / 1000), Math.floor(new Date(r.timestamp).getTime() / 1000), r.longitude, r.latitude, r.altitude, r.altitude === null || r.altitude <= 0, r.speed, r.heading, null, null, r.altitude, null, false, 0
        ]);

        const data = {
            states,
            time: Math.floor(new Date(timestamp).getTime() / 1000),
            _source: "supabase",
            _isFallback: true
        };
        return { data, debug };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        debug.supabaseError = msg;
        console.error("[Aviation Supabase] Fallback error:", msg);
        return { data: null, debug };
    }
}

export async function recordToSupabase(states: any[], timeSecs: number) {
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
            const errorMsg = error.message;
            if (errorMsg && errorMsg.includes("<!DOCTYPE html>")) {
                console.error(`[Aviation Polling] Failed to insert chunk: Supabase Host returned HTML error (likely Cloudflare 522/502). Instance might be paused.`);
                break; // Stop further chunk inserts if host is down
            } else {
                console.error(`[Aviation Polling] Failed to insert chunk:`, error.message);
            }
        } else {
            successCount += chunk.length;
        }
    }

    console.log(`[Aviation Polling] Recorded ${successCount}/${records.length} states to Supabase.`);
}
