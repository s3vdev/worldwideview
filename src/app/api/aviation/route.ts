import { NextResponse } from "next/server";
import { getCachedAviationData, getLatestFromSupabase } from "../../../lib/aviation-polling";

export async function GET() {
    // 1. Try to get cached data from our background polling service
    const cache = getCachedAviationData();

    if (cache && cache.data) {
        // We just return whatever is freshest in memory since 
        // the background worker manages the interval.
        return NextResponse.json(cache.data);
    }

    // 2. If background polling hasn't loaded data yet, try Supabase history fallback.
    console.log("[API/aviation] No background cache yet. Falling back to Supabase history...");
    const fallbackData = await getLatestFromSupabase();
    if (fallbackData) {
        return NextResponse.json(fallbackData);
    }

    // 3. Complete fallback empty state
    return NextResponse.json(
        { states: [], time: Math.floor(Date.now() / 1000) },
        { status: 200 }
    );
}
