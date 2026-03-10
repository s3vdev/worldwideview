import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { get, set } from "@/lib/serverCache";

/**
 * Satellites API Route
 * 
 * Fetches LIVE satellite TLE (Two-Line Element) data from CelesTrak
 * 
 * Data Source: https://celestrak.org/
 * NO DEMO DATA - Real orbital data only
 * 
 * Query Parameters:
 *   - groups: comma-separated list of satellite groups (default: all 9 groups)
 *   - starlinkLimit: max number of Starlink satellites (default: 50)
 *   - activeLimit: max number of Active satellites (default: 100)
 *   - cacheMaxAgeMs: server cache TTL in ms (from Data Config → Cache & Limits; 0 = no cache)
 */

// CelesTrak GP (General Perturbations) endpoint
const CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php";

/**
 * Available satellite groups from CelesTrak
 * See https://celestrak.org/NORAD/elements/
 */
const AVAILABLE_GROUPS = [
    "stations",
    "gps-ops",
    "weather",
    "starlink",
    "oneweb",
    "iridium",
    "planet",
    "military",
    "active",
] as const;

export interface TLERecord {
    name: string;
    line1: string;
    line2: string;
    group: string;
}

export async function GET(request: NextRequest) {
    try {
        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const groupsParam = searchParams.get("groups");
        const starlinkLimitParam = searchParams.get("starlinkLimit");
        const activeLimitParam = searchParams.get("activeLimit");

        const DEFAULT_GROUPS: string[] = [
            "stations", "gps-ops", "weather", "starlink",
            "oneweb", "iridium", "planet", "military", "active",
        ];
        const parsed = groupsParam
            ? groupsParam.split(",").map((g) => g.trim().toLowerCase()).filter((g) => AVAILABLE_GROUPS.includes(g as any))
            : [];
        const requestedGroups = parsed.length > 0 ? parsed : DEFAULT_GROUPS;

        const starlinkLimit = starlinkLimitParam ? parseInt(starlinkLimitParam, 10) : 50;
        const activeLimit = activeLimitParam ? parseInt(activeLimitParam, 10) : 100;
        const cacheMaxAgeParam = searchParams.get("cacheMaxAgeMs");
        const requestedTtlMs = cacheMaxAgeParam ? parseInt(cacheMaxAgeParam, 10) : 30 * 60 * 1000;
        const cacheTtlMs = requestedTtlMs <= 0 ? 0 : Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, requestedTtlMs));

        const cacheKey = `satellites:${[...requestedGroups].sort().join(",")}:${starlinkLimit}:${activeLimit}`;
        if (cacheTtlMs > 0) {
            const cached = get<{ tles: TLERecord[]; timestamp: string; source: string; requestedGroups: string[]; starlinkLimit: number; activeLimit: number; debug: object }>(cacheKey);
            if (cached) {
                const maxAgeSec = Math.floor(cacheTtlMs / 1000);
                return NextResponse.json(cached, {
                    headers: { "Cache-Control": `public, max-age=${maxAgeSec}, stale-while-revalidate=300` },
                });
            }
        }

        console.log(`[Satellites API] Requested groups: ${requestedGroups.join(", ")}`);
        console.log(`[Satellites API] Starlink limit: ${starlinkLimit}, Active limit: ${activeLimit}`);

        const allTLEs: TLERecord[] = [];

        // Fetch TLEs for each requested group from CelesTrak
        for (const group of requestedGroups) {
            try {
                const url = `${CELESTRAK_BASE_URL}?GROUP=${group}&FORMAT=tle`;
                
                console.log(`[Satellites API] Fetching ${url}`);
                
                const res = await fetch(url, {
                    cache: "no-store",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "text/plain, text/html, */*",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Referer": "https://celestrak.org/",
                        "Origin": "https://celestrak.org",
                    },
                    method: "GET",
                });

                console.log(`[Satellites API] Response status for ${group}: ${res.status}`);

                if (!res.ok) {
                    console.error(`[Satellites API] CelesTrak returned ${res.status} for group ${group}`);
                    if (res.status === 403) {
                        console.error(`[Satellites API] 403 Forbidden for ${group} - CelesTrak may be blocking this request`);
                    }
                    continue;
                }

                const text = await res.text();
                
                console.log(`[Satellites API] Received ${text.length} bytes from ${group}`);
                
                if (text.length === 0) {
                    console.warn(`[Satellites API] Empty response for ${group}`);
                    continue;
                }
                
                // Parse TLE format (3 lines per satellite: name, line1, line2)
                const lines = text.trim().split("\n");
                let parsedCount = 0;
                let skippedCount = 0;
                
                for (let i = 0; i < lines.length; i += 3) {
                    if (i + 2 >= lines.length) break;
                    
                    const name = lines[i].trim();
                    const line1 = lines[i + 1].trim();
                    const line2 = lines[i + 2].trim();
                    
                    // Validate TLE format (line1 starts with "1 ", line2 starts with "2 ")
                    if (line1.startsWith("1 ") && line2.startsWith("2 ")) {
                        if (group === "starlink" && allTLEs.filter(t => t.group === "starlink").length >= starlinkLimit) {
                            skippedCount++;
                            continue;
                        }
                        if (group === "active" && allTLEs.filter(t => t.group === "active").length >= activeLimit) {
                            skippedCount++;
                            continue;
                        }

                        allTLEs.push({
                            name,
                            line1,
                            line2,
                            group,
                        });
                        parsedCount++;
                    }
                }
                
                console.log(`[Satellites API] ${group}: parsed ${parsedCount} TLEs${skippedCount > 0 ? `, skipped ${skippedCount} (limit reached)` : ""}`);
            } catch (err) {
                console.error(`[Satellites API] Error fetching group ${group}:`, err);
                // Continue with other groups even if one fails
            }
        }

        // Per-group counts and debug (for initial load verification)
        const countPerGroup: Record<string, number> = {};
        for (const t of allTLEs) {
            countPerGroup[t.group] = (countPerGroup[t.group] ?? 0) + 1;
        }
        const starlinkCount = countPerGroup["starlink"] ?? 0;
        const activeCount = countPerGroup["active"] ?? 0;
        const debug = {
            requestedGroups: [...requestedGroups],
            countPerGroup,
            totalCount: allTLEs.length,
            starlinkIncluded: requestedGroups.includes("starlink"),
            starlinkLimitApplied: requestedGroups.includes("starlink") ? starlinkCount : null as number | null,
            activeIncluded: requestedGroups.includes("active"),
            activeLimitApplied: requestedGroups.includes("active") ? activeCount : null as number | null,
        };
        console.log(`[Satellites API] Total TLEs: ${allTLEs.length}`, JSON.stringify(countPerGroup));

        // If no data was fetched, return empty result with error (NO CACHING)
        if (allTLEs.length === 0) {
            console.error("[Satellites API] No satellite data available from CelesTrak");
            return NextResponse.json(
                {
                    tles: [],
                    timestamp: new Date().toISOString(),
                    source: "CelesTrak",
                    requestedGroups,
                    starlinkLimit,
                    debug: { ...debug, totalCount: 0 },
                    error: "No satellite data available from CelesTrak",
                }
            );
        }

        const body = {
            tles: allTLEs,
            timestamp: new Date().toISOString(),
            source: "CelesTrak",
            requestedGroups,
            starlinkLimit,
            activeLimit,
            debug,
        };
        if (cacheTtlMs > 0) set(cacheKey, body, cacheTtlMs);
        const maxAgeSec = cacheTtlMs > 0 ? Math.floor(cacheTtlMs / 1000) : 0;
        return NextResponse.json(body, {
            headers: { "Cache-Control": maxAgeSec > 0 ? `public, max-age=${maxAgeSec}, stale-while-revalidate=300` : "no-store" },
        });
    } catch (err) {
        console.error("[Satellites API] Fetch error:", err);
        return NextResponse.json(
            { 
                error: err instanceof Error ? err.message : "Unknown error",
                tles: [],
                timestamp: new Date().toISOString(),
                source: "CelesTrak",
            },
            { status: 500 }
        );
    }
}
