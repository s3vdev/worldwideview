import { NextResponse } from "next/server";
import { getCachedVessels, startAisStream } from "@/lib/ais-stream";
import { get, set } from "@/lib/serverCache";
import { aisShipTypeToCategory } from "@/lib/ais-vessel-types";

export const dynamic = "force-dynamic";

const CACHE_KEY_MARITIME = "maritime";

export interface MaritimeDebug {
    source: "aisstream" | "aisstream-unavailable";
    cacheHit: boolean;
    vesselCount: number;
    recordsDropped?: number;
    reasonIfEmpty?: string;
}

function clampTtl(ms: number): number {
    if (ms <= 0) return 0;
    return Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, ms));
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const cacheMaxAgeParam = url.searchParams.get("cacheMaxAgeMs");
    const cacheTtlMs = clampTtl(cacheMaxAgeParam ? parseInt(cacheMaxAgeParam, 10) : 60 * 1000);

    if (cacheTtlMs > 0) {
        const cached = get<{ vessels: unknown[]; debug: MaritimeDebug }>(CACHE_KEY_MARITIME);
        if (cached) return NextResponse.json(cached);
    }

    startAisStream();
    const rawVessels = getCachedVessels();

    const debug: MaritimeDebug = {
        source: rawVessels.length > 0 ? "aisstream" : "aisstream-unavailable",
        cacheHit: false,
        vesselCount: rawVessels.length,
        reasonIfEmpty: rawVessels.length === 0
            ? "No AIS data available (stream not connected or no vessels in cache)"
            : undefined,
    };

    if (rawVessels.length === 0) {
        const emptyBody = { vessels: [] as unknown[], debug };
        if (cacheTtlMs > 0) set(CACHE_KEY_MARITIME, emptyBody, Math.min(cacheTtlMs, 60 * 1000));
        return NextResponse.json(emptyBody);
    }

    const geoEntities = rawVessels.map((v: { mmsi: number; name: string; shipType?: number; lat: number; lon: number; heading: number; speed: number; timestamp?: string }) => {
        const shipTypeRaw = v.shipType ?? 0;
        const category = aisShipTypeToCategory(shipTypeRaw);
        return {
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
                vesselType: category,
                aisShipTypeRaw: shipTypeRaw,
                speed_knots: v.speed,
                heading: v.heading,
            },
        };
    });

    const body = { vessels: geoEntities, debug };
    if (cacheTtlMs > 0) set(CACHE_KEY_MARITIME, body, cacheTtlMs);
    return NextResponse.json(body);
}
