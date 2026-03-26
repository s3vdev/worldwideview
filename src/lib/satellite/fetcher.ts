import type { CelesTrakGP } from "./types";
import { getCachedTLEs, setCachedTLEs } from "./cache";

const BASE_URL = "https://celestrak.org/NORAD/elements/gp.php";

/**
 * CelesTrak groups used to build the default satellite set.
 * Each group is fetched separately and tagged.
 */
export const DEFAULT_GROUPS = [
    "stations",       // ISS, Tiangong, etc.
    "visual",         // Brightest 100 satellites
    "weather",        // Weather satellites
    "gps-ops",        // GPS constellation
    "resource",       // Earth observation / reconnaissance
] as const;

/**
 * Fetch TLE data from CelesTrak for a specific satellite group.
 * Uses in-memory cache with 60 min TTL to avoid hammering the API.
 */
export async function fetchTLEGroup(
    group: string,
): Promise<CelesTrakGP[]> {
    const cached = getCachedTLEs(group);
    if (cached) return cached;

    const url = `${BASE_URL}?GROUP=${encodeURIComponent(group)}&FORMAT=tle`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
        console.error(
            `[satellite/fetcher] CelesTrak returned ${res.status} for group=${group}`,
        );
        return [];
    }

    const text = await res.text();
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const data: CelesTrakGP[] = [];
    
    // TLEs come in 3-line sets (Name, Line 1, Line 2)
    for (let i = 0; i < lines.length - 2; i += 3) {
        const nameLines = lines[i].split(" ");
        data.push({
            OBJECT_NAME: lines[i],
            TLE_LINE1: lines[i + 1],
            TLE_LINE2: lines[i + 2],
            NORAD_CAT_ID: parseInt(lines[i + 1].substring(2, 7).trim(), 10),
        } as CelesTrakGP);
    }
    setCachedTLEs(group, data);
    console.log(
        `[satellite/fetcher] Fetched ${data.length} TLEs for group=${group}`,
    );
    return data;
}

/**
 * Fetch TLE data for all default groups.
 * Returns a flat array with each record tagged by group.
 */
export async function fetchDefaultGroups(): Promise<
    { group: string; records: CelesTrakGP[] }[]
> {
    const results = await Promise.all(
        DEFAULT_GROUPS.map(async (group) => ({
            group,
            records: await fetchTLEGroup(group),
        })),
    );
    return results;
}
