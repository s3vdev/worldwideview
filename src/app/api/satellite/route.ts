import { fetchDefaultGroups, fetchTLEGroup } from "@/lib/satellite/fetcher";
import { propagateAll } from "@/lib/satellite/propagator";
import type { SatellitePosition } from "@/lib/satellite/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const groupParam = searchParams.get("group");
        const now = new Date();
        let satellites: SatellitePosition[] = [];

        if (groupParam) {
            // Single group requested
            const records = await fetchTLEGroup(groupParam);
            satellites = propagateAll(records, now, groupParam);
        } else {
            // Default: fetch curated set of groups
            const groups = await fetchDefaultGroups();
            for (const { group, records } of groups) {
                const positions = propagateAll(records, now, group);
                satellites.push(...positions);
            }
        }

        // Deduplicate by NORAD ID (a satellite may appear in multiple groups)
        const seen = new Set<number>();
        const unique = satellites.filter((s) => {
            if (seen.has(s.noradId)) return false;
            seen.add(s.noradId);
            return true;
        });

        return NextResponse.json({
            satellites: unique,
            totalCount: unique.length,
            timestamp: now.toISOString(),
        });
    } catch (err) {
        console.error("[API/satellite] Error:", err);
        return NextResponse.json({ satellites: [], totalCount: 0 });
    }
}
