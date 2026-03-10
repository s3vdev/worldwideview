import { NextResponse } from "next/server";
import { getCachedAviationData } from "../../../lib/aviation/cache";
import { getLatestFromSupabase } from "../../../lib/aviation/supabase";
import { CACHE_KEY_AVIATION, LAST_GOOD_KEY_AVIATION, STALE_MAX_AGE_MS } from "../../../lib/aviation/cacheKeys";
import { globalState } from "../../../lib/aviation/state";
import { get, set } from "@/lib/serverCache";

/** Short TTL for empty response to avoid repeated Supabase timeouts */
const EMPTY_RESPONSE_CACHE_MS = 30_000;

export interface AviationDebugMeta {
    source: "opensky" | "supabase" | "last-known-good" | "empty";
    openskyStatus: number | null;
    pollingCachePresent: boolean;
    diskCachePresent: boolean;
    lastKnownGoodPresent: boolean;
    supabaseConfigured: boolean;
    supabaseAttempted: boolean;
    supabaseReturnedRows: number;
    supabaseError: string | null;
    reasonIfEmpty: string;
}

function clampTtl(ms: number): number {
    if (ms <= 0) return 0;
    return Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, ms));
}

function buildDebug(
    source: AviationDebugMeta["source"],
    opts: {
        supabaseDebug?: { supabaseConfigured: boolean; supabaseAttempted: boolean; supabaseReturnedRows: number; supabaseError: string | null };
        reasonIfEmpty?: string;
    }
): AviationDebugMeta {
    const mem = getCachedAviationData();
    const lastGood = get<{ states?: unknown[] }>(LAST_GOOD_KEY_AVIATION);
    return {
        source,
        openskyStatus: globalState.openskyLastStatus ?? null,
        pollingCachePresent: !!(mem?.data && Array.isArray(mem.data.states) && mem.data.states.length > 0),
        diskCachePresent: false,
        lastKnownGoodPresent: !!(lastGood && Array.isArray(lastGood.states) && lastGood.states.length > 0),
        supabaseConfigured: opts.supabaseDebug?.supabaseConfigured ?? false,
        supabaseAttempted: opts.supabaseDebug?.supabaseAttempted ?? false,
        supabaseReturnedRows: opts.supabaseDebug?.supabaseReturnedRows ?? 0,
        supabaseError: opts.supabaseDebug?.supabaseError ?? null,
        reasonIfEmpty: opts.reasonIfEmpty ?? "",
    };
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const cacheMaxAgeParam = url.searchParams.get("cacheMaxAgeMs");
    const cacheTtlMs = clampTtl(cacheMaxAgeParam ? parseInt(cacheMaxAgeParam, 10) : 30 * 60 * 1000);

    if (cacheTtlMs > 0) {
        const cached = get<{ states?: unknown[] }>(CACHE_KEY_AVIATION);
        if (cached && Array.isArray(cached.states) && cached.states.length > 0) {
            console.log(`[API/aviation] Cache hit: key=${CACHE_KEY_AVIATION}, states=${cached.states.length}`);
            return NextResponse.json({ ...cached, _debug: buildDebug("opensky", {}) });
        }
        if (cached && Array.isArray(cached.states) && cached.states.length === 0) {
            const lastGood = get<{ states?: unknown[]; time?: number }>(LAST_GOOD_KEY_AVIATION);
            if (lastGood && Array.isArray(lastGood.states) && lastGood.states.length > 0) {
                console.log(`[API/aviation] Returning last-known-good (stale); serverCache key=${LAST_GOOD_KEY_AVIATION} had ${lastGood.states.length} states`);
                return NextResponse.json({ ...lastGood, _stale: true, _debug: buildDebug("last-known-good", {}) });
            }
        }
    }

    const cache = getCachedAviationData();
    if (cache && cache.data && Array.isArray(cache.data.states) && cache.data.states.length > 0) {
        if (cacheTtlMs > 0) {
            set(CACHE_KEY_AVIATION, cache.data, cacheTtlMs);
            set(LAST_GOOD_KEY_AVIATION, cache.data, STALE_MAX_AGE_MS);
            console.log(`[API/aviation] Wrote serverCache keys ${CACHE_KEY_AVIATION}, ${LAST_GOOD_KEY_AVIATION} from polling memory cache (${cache.data.states.length} states)`);
        }
        return NextResponse.json({ ...cache.data, _debug: buildDebug("opensky", {}) });
    }

    console.log(`[API/aviation] Memory cache empty (timestamp=${cache?.timestamp ?? 0}). Reading Supabase fallback; cache keys: ${CACHE_KEY_AVIATION}, ${LAST_GOOD_KEY_AVIATION}`);
    const { data: fallbackData, debug: supabaseDebug } = await getLatestFromSupabase();
    if (fallbackData && Array.isArray(fallbackData.states) && fallbackData.states.length > 0) {
        console.log(`[API/aviation] Supabase fallback success: ${fallbackData.states.length} rows. Writing serverCache.`);
        if (cacheTtlMs > 0) {
            set(CACHE_KEY_AVIATION, fallbackData, cacheTtlMs);
            set(LAST_GOOD_KEY_AVIATION, fallbackData, STALE_MAX_AGE_MS);
        }
        return NextResponse.json({ ...fallbackData, _debug: buildDebug("supabase", { supabaseDebug }) });
    }

    const lastGood = get<{ states?: unknown[]; time?: number }>(LAST_GOOD_KEY_AVIATION);
    if (lastGood && Array.isArray(lastGood.states) && lastGood.states.length > 0) {
        console.warn("[API/aviation] Returning last-known-good (stale). No live data; OpenSky 429 and Supabase returned no rows.");
        return NextResponse.json({
            ...lastGood,
            _stale: true,
            _debug: buildDebug("last-known-good", { supabaseDebug, reasonIfEmpty: "OpenSky rate-limited; Supabase empty or not configured" }),
        });
    }

    const reasonIfEmpty = [
        globalState.openskyLastStatus === 429 ? "OpenSky 429" : "",
        !cache?.data ? "memory cache empty" : "",
        !supabaseDebug.supabaseConfigured ? "Supabase not configured" : "",
        supabaseDebug.supabaseAttempted && supabaseDebug.supabaseReturnedRows === 0 ? "Supabase returned 0 rows" : "",
        supabaseDebug.supabaseError ? `Supabase error: ${supabaseDebug.supabaseError}` : "",
    ].filter(Boolean).join("; ") || "No data source available";

    console.warn(`[API/aviation] Empty response. reasonIfEmpty=${reasonIfEmpty}. Caching empty 30s to avoid repeated timeouts.`);
    const empty = { states: [], time: Math.floor(Date.now() / 1000) };
    set(CACHE_KEY_AVIATION, empty, EMPTY_RESPONSE_CACHE_MS);
    return NextResponse.json({
        ...empty,
        _debug: buildDebug("empty", { supabaseDebug, reasonIfEmpty }),
    }, { status: 200 });
}
