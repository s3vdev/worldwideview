import { NextResponse } from "next/server";
import { getCachedVessels, startAisStream } from "@/lib/ais-stream";
import { get, set } from "@/lib/serverCache";

export const dynamic = "force-dynamic";

const CACHE_KEY_MARITIME = "maritime";


/**
 * Maritime AIS proxy.
 * Returns live data from aisstream.io. Response cached by Cache & Limits → Cache Max Age (Ms).
 */
function clampTtl(ms: number): number {
    if (ms <= 0) return 0;
    return Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, ms));
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const cacheMaxAgeParam = url.searchParams.get("cacheMaxAgeMs");
    const cacheTtlMs = clampTtl(cacheMaxAgeParam ? parseInt(cacheMaxAgeParam, 10) : 60 * 1000);

    if (cacheTtlMs > 0) {
        const cached = get<{ vessels: unknown[] }>(CACHE_KEY_MARITIME);
        if (cached) return NextResponse.json(cached);
    }

    startAisStream();
    const vessels = getCachedVessels();

    if (vessels.length === 0) {
        return NextResponse.json({ vessels: null });
    }

    const geoEntities = vessels.map((v) => ({
        id: `maritime-${v.mmsi}`,
        pluginId: "maritime",
        latitude: v.lat,
        longitude: v.lon,
        heading: v.heading,
        speed: v.speed,
        timestamp: v.timestamp ? new Date(v.timestamp) : new Date(),
        label: v.name,
        properties: {
            mmsi: v.mmsi,
            vesselName: v.name,
            vesselType: v.type,
            speed_knots: v.speed,
            heading: v.heading,
        },
    }));

    const body = { vessels: geoEntities };
    if (cacheTtlMs > 0) set(CACHE_KEY_MARITIME, body, cacheTtlMs);
    return NextResponse.json(body);
}
