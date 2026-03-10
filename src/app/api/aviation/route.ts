import { NextResponse } from "next/server";
import { getCachedAviationData } from "../../../lib/aviation/cache";
import { getLatestFromSupabase } from "../../../lib/aviation/supabase";
import { get, set } from "@/lib/serverCache";

const CACHE_KEY_AVIATION = "aviation";

function clampTtl(ms: number): number {
    if (ms <= 0) return 0;
    return Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, ms));
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const cacheMaxAgeParam = url.searchParams.get("cacheMaxAgeMs");
    const cacheTtlMs = clampTtl(cacheMaxAgeParam ? parseInt(cacheMaxAgeParam, 10) : 30 * 60 * 1000);

    if (cacheTtlMs > 0) {
        const cached = get<unknown>(CACHE_KEY_AVIATION);
        if (cached) return NextResponse.json(cached);
    }

    const cache = getCachedAviationData();
    if (cache && cache.data) {
        if (cacheTtlMs > 0) set(CACHE_KEY_AVIATION, cache.data, cacheTtlMs);
        return NextResponse.json(cache.data);
    }

    const cacheReason = cache.timestamp === 0 ? "Memory & Disk cache empty" : "Cache potentially stagnant";
    console.log(`[API/aviation] ${cacheReason}. Attempting 10s timeout fallback to Supabase history...`);

    const fallbackData = await getLatestFromSupabase();
    if (fallbackData) {
        console.log(`[API/aviation] Fallback successful: Returning ${fallbackData.states?.length || 0} historical states.`);
        if (cacheTtlMs > 0) set(CACHE_KEY_AVIATION, fallbackData, cacheTtlMs);
        return NextResponse.json(fallbackData);
    }

    console.warn("[API/aviation] All caches were empty and Supabase fallback failed (likely timeout). Returning empty state.");
    const empty = { states: [], time: Math.floor(Date.now() / 1000) };
    if (cacheTtlMs > 0) set(CACHE_KEY_AVIATION, empty, Math.min(cacheTtlMs, 60 * 1000));
    return NextResponse.json(empty, { status: 200 });
}
