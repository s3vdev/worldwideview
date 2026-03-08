import { NextResponse } from "next/server";

/**
 * Earthquake API Route
 * 
 * Fetches live earthquake data from USGS GeoJSON feed
 * Endpoint: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
 * 
 * This feed provides:
 * - All global earthquakes in the last 24 hours
 * - GeoJSON format
 * - Magnitude, depth, coordinates, timestamp
 * - Place description
 * - No authentication required
 */

const USGS_FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

export async function GET() {
    try {
        // Fetch from USGS GeoJSON feed
        const res = await fetch(USGS_FEED_URL, {
            cache: "no-store", // Always fetch fresh data
            headers: {
                "User-Agent": "WorldWideView/1.0 (Educational Project)",
            },
        });

        if (!res.ok) {
            console.error(`[Earthquake API] USGS API returned ${res.status}: ${res.statusText}`);
            return NextResponse.json(
                { error: `USGS API error: ${res.statusText}`, features: [] },
                { status: res.status }
            );
        }

        const data = await res.json();

        // Validate GeoJSON structure
        if (!data.features || !Array.isArray(data.features)) {
            console.error("[Earthquake API] Invalid GeoJSON format from USGS");
            return NextResponse.json(
                { error: "Invalid data format from USGS", features: [] },
                { status: 500 }
            );
        }

        // Filter out invalid entries (missing coordinates or magnitude)
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

        // Return normalized GeoJSON
        return NextResponse.json({
            type: "FeatureCollection",
            metadata: data.metadata || {},
            features: validFeatures,
        });
    } catch (err) {
        console.error("[Earthquake API] Fetch error:", err);
        return NextResponse.json(
            { 
                error: err instanceof Error ? err.message : "Unknown error",
                features: [] 
            },
            { status: 500 }
        );
    }
}
