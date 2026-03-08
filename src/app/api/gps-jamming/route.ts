import { NextResponse } from "next/server";

/**
 * GPS Jamming / GNSS Interference API Route (DEMO/FALLBACK ONLY)
 * 
 * ⚠️ WARNING: This endpoint returns STATIC DEMONSTRATION DATA, not live GPS jamming data.
 * 
 * Why No Live Data?
 * - GPSJAM (https://gpsjam.org/) provides NO machine-readable API
 * - Only visual map interface available (web scraping unreliable/against ToS)
 * - Real-time GPS interference detection requires:
 *   a) ADS-B Exchange commercial API access, or
 *   b) Direct ADS-B receiver infrastructure, or
 *   c) Licensed GPS monitoring services
 * 
 * Current Implementation:
 * - Serves curated static hotspot data based on publicly reported interference zones
 * - Data based on conflict regions, aviation authority reports, and news sources
 * - NOT updated in real-time
 * 
 * Future Options:
 * 1. Contact GPSJAM creator for data access
 * 2. License commercial GPS interference data
 * 3. Replace with different plugin using real public API
 */

interface GPSJammingDataPoint {
    id: string;
    latitude: number;
    longitude: number;
    severity: "low" | "medium" | "high";
    affectedPercent: number;
    timestamp: string;
    region?: string;
}

/**
 * Generates static demonstration GPS jamming data based on known hotspots
 * 
 * ⚠️ THIS IS NOT LIVE DATA - Static coordinates from public reports
 * 
 * Sources for hotspot identification:
 * - Aviation authority GPS interference reports
 * - Conflict zone analysis (Ukraine, Syria, etc.)
 * - Public GNSS interference incident databases
 * - News reports and flight tracking anomalies
 * 
 * Note: Real GPSJAM data is not machine-accessible without web scraping
 */
function generateFallbackData(): GPSJammingDataPoint[] {
    const timestamp = new Date().toISOString();
    
    // Known GPS jamming hotspots based on publicly reported regions
    const hotspots = [
        // Eastern Europe / Ukraine conflict zone
        { lat: 50.45, lon: 30.52, severity: "high" as const, percent: 25, region: "Eastern Europe" },
        { lat: 47.91, lon: 33.38, severity: "high" as const, percent: 18, region: "Black Sea" },
        { lat: 46.48, lon: 30.73, severity: "medium" as const, percent: 8, region: "Ukraine South" },
        
        // Baltic Sea region
        { lat: 54.68, lon: 25.28, severity: "medium" as const, percent: 7, region: "Baltic States" },
        { lat: 59.44, lon: 24.75, severity: "medium" as const, percent: 9, region: "Estonia" },
        
        // Middle East
        { lat: 33.51, lon: 36.29, severity: "high" as const, percent: 22, region: "Syria" },
        { lat: 31.77, lon: 35.21, severity: "medium" as const, percent: 6, region: "Israel/Palestine" },
        { lat: 33.31, lon: 44.36, severity: "medium" as const, percent: 5, region: "Iraq" },
        
        // Russia border regions
        { lat: 55.75, lon: 37.62, severity: "low" as const, percent: 3, region: "Moscow vicinity" },
        { lat: 59.93, lon: 30.36, severity: "low" as const, percent: 4, region: "St. Petersburg" },
        
        // Eastern Mediterranean
        { lat: 35.13, lon: 33.35, severity: "medium" as const, percent: 8, region: "Cyprus" },
        
        // Caucasus
        { lat: 42.00, lon: 43.50, severity: "medium" as const, percent: 7, region: "Georgia" },
        
        // Additional sporadic incidents
        { lat: 52.37, lon: 4.89, severity: "low" as const, percent: 2, region: "Netherlands" },
        { lat: 51.51, lon: -0.13, severity: "low" as const, percent: 1, region: "UK" },
    ];

    return hotspots.map((spot, idx) => ({
        id: `fallback-${idx}`,
        latitude: spot.lat,
        longitude: spot.lon,
        severity: spot.severity,
        affectedPercent: spot.percent,
        timestamp,
        region: spot.region,
    }));
}

/**
 * Attempts to fetch real data from GPSJAM
 * 
 * ⚠️ Currently always returns null - GPSJAM has no public API
 * 
 * This function is a placeholder for future integration if:
 * - GPSJAM creates a public API
 * - Commercial data licensing is secured
 * - Alternative real-time source is found
 */
async function fetchGPSJamData(): Promise<GPSJammingDataPoint[] | null> {
    try {
        // GPSJAM does NOT provide a machine-readable API endpoint
        // Only option would be web scraping their map tiles, which is:
        // - Unreliable (changes to frontend break scraper)
        // - Potentially against Terms of Service
        // - Not suitable for production use
        
        console.log("[GPS Jamming API] ⚠️ No live data source available - GPSJAM has no public API");
        return null;
    } catch (err) {
        console.error("[GPS Jamming API] Error fetching data:", err);
        return null;
    }
}

export async function GET() {
    try {
        // Attempt to fetch real data
        let data = await fetchGPSJamData();
        
        // Use fallback demonstration data if real source unavailable
        if (!data) {
            console.warn("[GPS Jamming API] ⚠️ Using STATIC DEMO DATA - not live GPS jamming feed");
            data = generateFallbackData();
        }

        return NextResponse.json({
            dataPoints: data,
            timestamp: new Date().toISOString(),
            source: "DEMO - Static Hotspot Data (Not Live)",
            updateInterval: "N/A (static data)",
            note: "⚠️ DEMONSTRATION DATA ONLY. GPSJAM provides no machine-readable API. Data represents known hotspots from public reports, not real-time interference.",
            disclaimer: "This is NOT live GPS jamming data. For actual interference monitoring, contact aviation authorities or license commercial GPS monitoring services.",
        });
    } catch (err) {
        console.error("[GPS Jamming API] Unexpected error:", err);
        return NextResponse.json(
            { 
                error: "Failed to fetch GPS jamming data",
                dataPoints: [],
            },
            { status: 500 }
        );
    }
}
