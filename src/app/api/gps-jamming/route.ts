import { NextResponse } from "next/server";
import { cellToBoundary } from "h3-js";
import { get, set, TTL } from "@/lib/serverCache";

/**
 * GPS Jamming / GNSS Interference API Route
 *
 * Data source: gpsjam.org (verified via browser network inspection).
 * - Manifest: https://gpsjam.org/data/manifest.csv (date,suspect,num_bad_aircraft_hexes)
 * - Daily data: https://gpsjam.org/data/{YYYY-MM-DD}-h3_4.csv (hex,count_good_aircraft,count_bad_aircraft)
 *
 * Date resolution: try manifest first for latest available date; if unavailable, try today, today-1, today-2, today-3.
 * Caching: manifest 30 min, daily CSV 4 h; failed fetches cached briefly to avoid hammering.
 * No dummy/fallback data; empty polygons with debug if no valid dataset.
 */

const GPSJAM_BASE = "https://gpsjam.org/data";
const MANIFEST_URL = `${GPSJAM_BASE}/manifest.csv`;
const USER_AGENT = "Mozilla/5.0 (compatible; WorldwideView/1.0; +https://github.com/worldwideview)";
const MAX_POLYGONS = 2000;
const CACHE_KEY_MANIFEST = "gpsjam:manifest";
const LOOKBACK_DAYS = 3; // fallback: today, today-1, ... today-LOOKBACK_DAYS

export interface GpsJammingPolygon {
    id: string;
    severity: "low" | "medium" | "high";
    affectedPercent: number;
    positions: Array<{ latitude: number; longitude: number; altitude?: number }>;
    timestamp: string;
}

export interface GpsJammingDebug {
    source: "gpsjam-real" | "gpsjam-unavailable";
    requestedDate: string;
    resolvedDate: string | null;
    manifestUsed: boolean;
    cacheHit: boolean;
    cacheKey: string | null;
    fetchAttempts: string[];
    sourceUrlTried: string[];
    finalUrlUsed: string | null;
    urlUsed?: string;
    contentType: string;
    dateUsed?: string;
    rawRecordCount: number;
    polygonCount: number;
    format: "csv";
    usedTransformation: boolean;
    notes: string[];
}

/** GPSJAM formula: percent_bad = 100 * (bad - 1) / (good + bad); subtract 1 from bad to limit false positives */
function computePercentBad(countGood: number, countBad: number): number {
    if (countBad <= 0) return 0;
    const badAdjusted = Math.max(0, countBad - 1);
    const total = countGood + countBad;
    if (total <= 0) return 0;
    return (100 * badAdjusted) / total;
}

/** Severity from percent (GPSJAM: green <2%, yellow 2-10%, red >10%). We only emit yellow/red for interference. */
function percentToSeverity(percent: number): "low" | "medium" | "high" {
    if (percent > 10) return "high";
    if (percent >= 2) return "medium";
    return "low";
}

/** Parse CSV line; handle quoted fields if needed */
function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        } else if ((c === "," && !inQuotes) || (c === "\r" && !inQuotes)) {
            out.push(cur.trim());
            cur = "";
        } else if (c !== "\r") {
            cur += c;
        }
    }
    out.push(cur.trim());
    return out;
}

/** Fetch manifest.csv and return latest available date (YYYY-MM-DD) or null. Successful result cached 30 min. */
async function fetchLatestDateFromManifest(
    fetchAttempts: string[],
    sourceUrlTried: string[]
): Promise<{ latestDate: string | null; manifestUsed: boolean }> {
    const cached = get<string>(CACHE_KEY_MANIFEST);
    if (cached != null && cached !== "") {
        fetchAttempts.push("manifest(cached)");
        sourceUrlTried.push(MANIFEST_URL + " (cached)");
        return { latestDate: cached, manifestUsed: true };
    }

    fetchAttempts.push("manifest");
    sourceUrlTried.push(MANIFEST_URL);

    const res = await fetch(MANIFEST_URL, {
        cache: "no-store",
        headers: { Accept: "text/csv, text/plain, */*", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return { latestDate: null, manifestUsed: false };
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return { latestDate: null, manifestUsed: false };
    const header = parseCsvLine(lines[0]);
    const dateIdx = header.indexOf("date");
    if (dateIdx < 0) return { latestDate: null, manifestUsed: false };
    const dates: string[] = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i]);
        const d = parts[dateIdx]?.trim();
        if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) dates.push(d);
    }
    if (dates.length === 0) return { latestDate: null, manifestUsed: false };
    const latestDate = dates.sort().reverse()[0];
    set(CACHE_KEY_MANIFEST, latestDate, TTL.MANIFEST_MS);
    return { latestDate, manifestUsed: true };
}

/** Generate fallback dates: [today, today-1, ... today-lookback] in UTC */
function getFallbackDates(requestedDate: string, lookback: number): string[] {
    const base = new Date(requestedDate + "T12:00:00Z");
    const out: string[] = [];
    for (let i = 0; i <= lookback; i++) {
        const d = new Date(base);
        d.setUTCDate(d.getUTCDate() - i);
        out.push(d.toISOString().slice(0, 10));
    }
    return out;
}

type CsvResult = { rows: Array<{ hex: string; countGood: number; countBad: number }>; contentType: string };

/** Fetch and parse daily CSV; return rows or null on failure. Does not use cache (caller caches). */
async function fetchDailyCsvUncached(dateStr: string): Promise<CsvResult | null> {
    const url = `${GPSJAM_BASE}/${dateStr}-h3_4.csv`;
    const res = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "text/csv, text/plain, */*", "User-Agent": USER_AGENT },
    });
    const contentType = res.headers.get("content-type") ?? "unknown";
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return { rows: [], contentType };
    const header = parseCsvLine(lines[0]);
    const hexIdx = header.indexOf("hex");
    const goodIdx = header.indexOf("count_good_aircraft");
    const badIdx = header.indexOf("count_bad_aircraft");
    if (hexIdx < 0 || goodIdx < 0 || badIdx < 0) return { rows: [], contentType };
    const rows: Array<{ hex: string; countGood: number; countBad: number }> = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i]);
        const hex = parts[hexIdx] ?? "";
        const countGood = parseInt(parts[goodIdx] ?? "0", 10) || 0;
        const countBad = parseInt(parts[badIdx] ?? "0", 10) || 0;
        if (hex) rows.push({ hex, countGood, countBad });
    }
    return { rows, contentType };
}

/** Convert H3 index to polygon positions (closed ring). */
function h3ToPositions(hex: string): Array<{ latitude: number; longitude: number; altitude?: number }> | null {
    try {
        const boundary = cellToBoundary(hex, false) as [number, number][];
        if (!boundary || boundary.length < 3) return null;
        return boundary.map(([lat, lng]) => ({ latitude: lat, longitude: lng, altitude: 0 }));
    } catch {
        return null;
    }
}

function clampTtl(ms: number): number {
    if (ms <= 0) return 0;
    return Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, ms));
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const requestedDate = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const cacheMaxAgeParam = url.searchParams.get("cacheMaxAgeMs");
    const cacheTtlMs = clampTtl(cacheMaxAgeParam ? parseInt(cacheMaxAgeParam, 10) : 4 * 60 * 60 * 1000);
    const useResponseCache = cacheTtlMs > 0;
    const notes: string[] = [];
    const fetchAttempts: string[] = [];
    const sourceUrlTried: string[] = [];

    try {
        let resolvedDate: string | null = null;
        let manifestUsed = false;
        let cacheHit = false;
        let cacheKey: string | null = null;
        let finalUrlUsed: string | null = null;
        let result: CsvResult | null = null;

        // 1) Try manifest for latest available date
        const manifestResult = await fetchLatestDateFromManifest(fetchAttempts, sourceUrlTried);
        manifestUsed = manifestResult.manifestUsed;
        if (manifestResult.latestDate) {
            resolvedDate = manifestResult.latestDate;
            cacheKey = `gpsjam:csv:${resolvedDate}`;
            const cached = get<CsvResult>(cacheKey);
            if (cached) {
                cacheHit = true;
                result = cached;
                finalUrlUsed = `${GPSJAM_BASE}/${resolvedDate}-h3_4.csv`;
                fetchAttempts.push(`${resolvedDate}(cached)`);
                sourceUrlTried.push(`${GPSJAM_BASE}/${resolvedDate}-h3_4.csv (cached)`);
            } else {
                fetchAttempts.push(resolvedDate);
                sourceUrlTried.push(`${GPSJAM_BASE}/${resolvedDate}-h3_4.csv`);
                result = await fetchDailyCsvUncached(resolvedDate);
                if (result && result.rows.length > 0) {
                    set(cacheKey, result, TTL.DAILY_MS);
                    finalUrlUsed = `${GPSJAM_BASE}/${resolvedDate}-h3_4.csv`;
                } else {
                    set(`gpsjam:fail:${resolvedDate}`, true, TTL.NEGATIVE_MS);
                    result = null;
                }
            }
        }

        // 2) Fallback: try requested date and then lookback days
        if (!result) {
            const candidates = getFallbackDates(requestedDate, LOOKBACK_DAYS);
            for (const dateStr of candidates) {
                if (resolvedDate === dateStr) continue; // already tried
                cacheKey = `gpsjam:csv:${dateStr}`;
                const cached = get<CsvResult>(cacheKey);
                if (cached) {
                    cacheHit = true;
                    result = cached;
                    resolvedDate = dateStr;
                    finalUrlUsed = `${GPSJAM_BASE}/${dateStr}-h3_4.csv`;
                    fetchAttempts.push(`${dateStr}(cached)`);
                    sourceUrlTried.push(`${GPSJAM_BASE}/${dateStr}-h3_4.csv (cached)`);
                    break;
                }
                fetchAttempts.push(dateStr);
                sourceUrlTried.push(`${GPSJAM_BASE}/${dateStr}-h3_4.csv`);
                const fetched = await fetchDailyCsvUncached(dateStr);
                if (fetched && fetched.rows.length > 0) {
                    set(cacheKey, fetched, TTL.DAILY_MS);
                    result = fetched;
                    resolvedDate = dateStr;
                    finalUrlUsed = `${GPSJAM_BASE}/${dateStr}-h3_4.csv`;
                    break;
                }
                set(`gpsjam:fail:${dateStr}`, true, TTL.NEGATIVE_MS);
            }
        }

        if (!result || !resolvedDate) {
            const debug: GpsJammingDebug = {
                source: "gpsjam-unavailable",
                requestedDate,
                resolvedDate: null,
                manifestUsed,
                cacheHit: false,
                cacheKey: null,
                fetchAttempts,
                sourceUrlTried,
                finalUrlUsed: null,
                urlUsed: undefined,
                dateUsed: undefined,
                contentType: "none",
                rawRecordCount: 0,
                polygonCount: 0,
                format: "csv",
                usedTransformation: true,
                notes: ["No valid dataset found. No fallback data used."],
            };
            return NextResponse.json({
                polygons: [],
                timestamp: new Date().toISOString(),
                debug,
            });
        }

        const responseCacheKey = `gpsjam:response:${resolvedDate}`;
        if (useResponseCache) {
            const cachedResponse = get<{ polygons: GpsJammingPolygon[]; timestamp: string; debug: GpsJammingDebug }>(responseCacheKey);
            if (cachedResponse) return NextResponse.json(cachedResponse);
        }

        const { rows, contentType } = result;
        notes.push(`Fetched ${rows.length} CSV rows for ${resolvedDate}`);

        const timestamp = new Date().toISOString();
        const polygons: GpsJammingPolygon[] = [];
        let skippedInvalidHex = 0;
        let skippedLowPercent = 0;

        for (let i = 0; i < rows.length && polygons.length < MAX_POLYGONS; i++) {
            const { hex, countGood, countBad } = rows[i];
            const percent = computePercentBad(countGood, countBad);
            const severity = percentToSeverity(percent);
            if (percent < 2) {
                skippedLowPercent++;
                continue;
            }
            const positions = h3ToPositions(hex);
            if (!positions) {
                skippedInvalidHex++;
                continue;
            }
            polygons.push({
                id: `gpsjam-${hex}`,
                severity,
                affectedPercent: Math.round(percent * 10) / 10,
                positions,
                timestamp,
            });
        }

        if (skippedInvalidHex) notes.push(`${skippedInvalidHex} rows skipped (invalid H3 index)`);
        if (skippedLowPercent) notes.push(`${skippedLowPercent} rows skipped (percent < 2%)`);
        if (polygons.length >= MAX_POLYGONS) notes.push(`Capped at ${MAX_POLYGONS} polygons`);

        const debug: GpsJammingDebug = {
            source: "gpsjam-real",
            requestedDate,
            resolvedDate,
            manifestUsed,
            cacheHit,
            cacheKey,
            fetchAttempts,
            sourceUrlTried,
            finalUrlUsed,
            urlUsed: finalUrlUsed ?? undefined,
            dateUsed: resolvedDate ?? undefined,
            contentType,
            rawRecordCount: rows.length,
            polygonCount: polygons.length,
            format: "csv",
            usedTransformation: true,
            notes,
        };

        const body = { polygons, timestamp, debug };
        if (useResponseCache) set(responseCacheKey, body, cacheTtlMs);
        return NextResponse.json(body);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const debug: GpsJammingDebug = {
            source: "gpsjam-unavailable",
            requestedDate,
            resolvedDate: null,
            manifestUsed: false,
            cacheHit: false,
            cacheKey: null,
            fetchAttempts,
            sourceUrlTried,
            finalUrlUsed: null,
            urlUsed: undefined,
            dateUsed: undefined,
            contentType: "none",
            rawRecordCount: 0,
            polygonCount: 0,
            format: "csv",
            usedTransformation: false,
            notes: [`Error: ${message}. No fallback data used.`],
        };
        return NextResponse.json(
            {
                polygons: [],
                timestamp: new Date().toISOString(),
                debug,
            },
            { status: 200 }
        );
    }
}
