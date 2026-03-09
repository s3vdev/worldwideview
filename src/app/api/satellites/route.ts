import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

/**
 * Satellites API Route
 * 
 * Fetches LIVE satellite TLE (Two-Line Element) data from CelesTrak
 * 
 * Data Source: https://celestrak.org/
 * NO DEMO DATA - Real orbital data only
 * 
 * Query Parameters:
 *   - groups: comma-separated list of satellite groups (e.g., "stations,gps-ops,weather")
 *   - starlinkLimit: max number of Starlink satellites (default: 50)
 */

// CelesTrak GP (General Perturbations) endpoint
const CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php";

/**
 * Available satellite groups from CelesTrak
 */
const AVAILABLE_GROUPS = ["stations", "gps-ops", "weather", "starlink"] as const;

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
        
        // Determine which groups to fetch (default: stations, gps-ops, weather)
        const requestedGroups = groupsParam 
            ? groupsParam.split(",").filter(g => AVAILABLE_GROUPS.includes(g as any))
            : ["stations", "gps-ops", "weather"]; // Default: no Starlink
        
        const starlinkLimit = starlinkLimitParam ? parseInt(starlinkLimitParam, 10) : 50;
        
        console.log(`[Satellites API] Requested groups: ${requestedGroups.join(", ")}`);
        console.log(`[Satellites API] Starlink limit: ${starlinkLimit}`);

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
                    continue;
                }

                const text = await res.text();
                
                console.log(`[Satellites API] Received ${text.length} bytes from ${group}`);
                
                // Parse TLE format (3 lines per satellite: name, line1, line2)
                const lines = text.trim().split("\n");
                
                for (let i = 0; i < lines.length; i += 3) {
                    if (i + 2 >= lines.length) break;
                    
                    const name = lines[i].trim();
                    const line1 = lines[i + 1].trim();
                    const line2 = lines[i + 2].trim();
                    
                    // Validate TLE format (line1 starts with "1 ", line2 starts with "2 ")
                    if (line1.startsWith("1 ") && line2.startsWith("2 ")) {
                        // Apply Starlink limit for performance
                        if (group === "starlink" && allTLEs.filter(t => t.group === "starlink").length >= starlinkLimit) {
                            continue;
                        }
                        
                        allTLEs.push({
                            name,
                            line1,
                            line2,
                            group,
                        });
                    }
                }
                
                console.log(`[Satellites API] Fetched ${allTLEs.filter(t => t.group === group).length} TLEs from ${group}`);
            } catch (err) {
                console.error(`[Satellites API] Error fetching group ${group}:`, err);
                // Continue with other groups even if one fails
            }
        }

        console.log(`[Satellites API] Total TLEs fetched: ${allTLEs.length}`);

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
                    error: "No satellite data available from CelesTrak"
                }
                // No caching for errors
            );
        }

        // Return live TLE data WITH CACHING (30 minutes + stale-while-revalidate)
        return NextResponse.json(
            {
                tles: allTLEs,
                timestamp: new Date().toISOString(),
                source: "CelesTrak",
                requestedGroups,
                starlinkLimit,
            },
            {
                headers: {
                    // Cache for 30 minutes, allow stale content for 5 minutes while revalidating
                    "Cache-Control": "public, max-age=1800, stale-while-revalidate=300",
                },
            }
        );
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
