import { NextResponse } from "next/server";

/**
 * Satellites API Route
 * 
 * Fetches LIVE satellite TLE (Two-Line Element) data from CelesTrak
 * 
 * Data Source: https://celestrak.org/
 * NO DEMO DATA - Real orbital data only
 */

// CelesTrak GP (General Perturbations) endpoint
const CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php";

/**
 * Satellite groups to fetch from CelesTrak
 */
const SATELLITE_GROUPS = [
    "stations",   // Space stations (ISS, Tiangong, etc.)
    "gps-ops",    // GPS operational satellites
    "weather",    // Weather satellites (NOAA, Metop, etc.)
    "starlink",   // Starlink constellation (limited to 50)
] as const;

export interface TLERecord {
    name: string;
    line1: string;
    line2: string;
    group: string;
}

export async function GET() {
    try {
        const allTLEs: TLERecord[] = [];

        // Fetch TLEs for each group from CelesTrak
        for (const group of SATELLITE_GROUPS) {
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
                        // Limit Starlink to 50 satellites for performance
                        if (group === "starlink" && allTLEs.filter(t => t.group === "starlink").length >= 50) {
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

        // If no data was fetched, return empty result with error
        if (allTLEs.length === 0) {
            console.error("[Satellites API] No satellite data available from CelesTrak");
            return NextResponse.json(
                { 
                    tles: [],
                    timestamp: new Date().toISOString(),
                    source: "CelesTrak",
                    groups: SATELLITE_GROUPS,
                    error: "No satellite data available from CelesTrak"
                },
                { status: 200 } // Still return 200 but with empty data
            );
        }

        // Return live TLE data
        return NextResponse.json({
            tles: allTLEs,
            timestamp: new Date().toISOString(),
            source: "CelesTrak",
            groups: SATELLITE_GROUPS,
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
