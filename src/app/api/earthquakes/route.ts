import { NextResponse } from "next/server";
import { get, set } from "@/lib/serverCache";

/**
 * Earthquake API Route
 * Fetches live earthquake data from USGS GeoJSON feed.
 * Response cached by Data Config → Cache & Limits → Cache Max Age (Ms).
 */

const USGS_FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const CACHE_KEY_EARTHQUAKES = "earthquakes";

function clampTtl(ms: number): number {
    return Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, ms || 5 * 60 * 1000));
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const cacheMaxAgeParam = url.searchParams.get("cacheMaxAgeMs");
    const cacheTtlMs = clampTtl(cacheMaxAgeParam ? parseInt(cacheMaxAgeParam, 10) : 5 * 60 * 1000);

    if (cacheTtlMs > 0) {
        const cached = get<{ type: string; metadata?: unknown; features: unknown[] }>(CACHE_KEY_EARTHQUAKES);
        if (cached) return NextResponse.json(cached);
    }

    try {
        const res = await fetch(USGS_FEED_URL, {
            cache: "no-store",
            headers: { "User-Agent": "WorldWideView/1.0 (Educational Project)" },
        });

        if (!res.ok) {
            console.error(`[Earthquake API] USGS API returned ${res.status}: ${res.statusText}`);
            return NextResponse.json(
                { error: `USGS API error: ${res.statusText}`, features: [] },
                { status: res.status }
            );
        }

        const data = await res.json();

        if (!data.features || !Array.isArray(data.features)) {
            console.error("[Earthquake API] Invalid GeoJSON format from USGS");
            return NextResponse.json(
                { error: "Invalid data format from USGS", features: [] },
                { status: 500 }
            );
        }

        const validFeatures = data.features.filter((feature: any) => {
            const coords = feature?.geometry?.coordinates;
            const mag = feature?.properties?.mag;
            return (
                coords &&
                Array.isArray(coords) &&
                coords.length === 3 &&
                typeof coords[0] === "number" &&
                typeof coords[1] === "number" &&
                typeof mag === "number"
            );
        });

        console.log(`[Earthquake API] Fetched ${validFeatures.length} valid earthquakes from USGS`);

        const body = {
            type: "FeatureCollection",
            metadata: data.metadata || {},
            features: validFeatures,
        };
        if (cacheTtlMs > 0) set(CACHE_KEY_EARTHQUAKES, body, cacheTtlMs);
        return NextResponse.json(body);
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[Earthquake API] Fetch error:", msg);
        const stale = cacheTtlMs > 0 ? get<{ type: string; metadata?: unknown; features: unknown[] }>(CACHE_KEY_EARTHQUAKES) : null;
        if (stale && Array.isArray(stale.features)) {
            return NextResponse.json({ ...stale, _degraded: true, error: msg });
        }
        return NextResponse.json(
            { type: "FeatureCollection", metadata: {}, features: [], _degraded: true, error: msg },
            { status: 200 }
        );
    }
}
