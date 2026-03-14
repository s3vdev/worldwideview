import { NextResponse } from "next/server";
import { get, set } from "@/lib/serverCache";

/**
 * IODA API v2 – Internet Outage Detection and Analysis
 * Base: https://api.ioda.inetintel.cc.gatech.edu/v2/
 * Endpoints: /v2/outages/alerts, /v2/outages/events, /v2/outages/summary
 * V1: country-level only; entityType "country", entityCode = ISO 3166-1 alpha-2 (e.g. DE, US)
 */

const IODA_BASE = "https://api.ioda.inetintel.cc.gatech.edu/v2";
const CACHE_KEY = "internet-outages";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const IODA_FETCH_TIMEOUT_MS = 25 * 1000; // IODA can be slow; 25s to avoid "operation aborted due to timeout"

export interface InternetOutageItem {
    entityType: string;
    entityCode: string;
    name: string;
    severity: "low" | "medium" | "high";
    startTime: string | null;
    endTime: string | null;
    source: string;
}

function normalizeSeverity(val: unknown): "low" | "medium" | "high" {
    if (val === "high" || val === "medium" || val === "low") return val;
    if (typeof val === "number") {
        if (val >= 0.7) return "high";
        if (val >= 0.35) return "medium";
        return "low";
    }
    return "medium";
}

/** IODA v2 uses large score values (e.g. 117089); map to low/medium/high by thresholds */
function severityFromIodaScore(score: number): "low" | "medium" | "high" {
    if (score >= 50000) return "high";
    if (score >= 5000) return "medium";
    return "low";
}

function mapIodaEventToOutage(ev: any): InternetOutageItem | null {
    // IODA v2 format: location = "entityType/entityCode" (e.g. "country/US", "asn/140171")
    const location = String(ev?.location ?? "").trim();
    const [entityType, rawCode] = location.split("/").map((s: string) => s?.trim() ?? "");
    if (!entityType || !rawCode) {
        // Fallback: legacy entity/entityCode fields
        const legacyType = ev?.entity?.type ?? ev?.entityType ?? "country";
        const legacyCode =
            ev?.entity?.code ?? ev?.entityCode ?? ev?.country ?? ev?.country_code ?? ev?.countryCode ?? "";
        const code = String(legacyCode).toUpperCase().trim();
        const entityCode = code.length === 3 ? iso3ToIso2(code) ?? code : code;
        if (legacyType !== "country" || !entityCode || entityCode.length !== 2) return null;
        const name = ev?.entity?.name ?? ev?.name ?? ev?.location_name ?? entityCode;
        const severity = normalizeSeverity(ev?.severity ?? ev?.score ?? ev?.magnitude);
        const startTime = ev?.startTime ?? ev?.start ?? ev?.time ?? ev?.begin ?? null;
        const endTime = ev?.endTime ?? ev?.end ?? ev?.until ?? null;
        return {
            entityType: legacyType,
            entityCode,
            name,
            severity,
            startTime: startTime != null ? (typeof startTime === "number" ? new Date(startTime * 1000).toISOString() : String(startTime)) : null,
            endTime: endTime != null ? (typeof endTime === "number" ? new Date(endTime * 1000).toISOString() : String(endTime)) : null,
            source: "IODA",
        };
    }
    if (entityType !== "country") return null; // V1: country-level only
    const entityCode = rawCode.toUpperCase();
    if (entityCode.length !== 2) return null;
    const name = ev?.location_name ?? ev?.entity?.name ?? ev?.name ?? entityCode;
    const score = typeof ev?.score === "number" ? ev.score : 0;
    const severity = severityFromIodaScore(score);
    const start = ev?.start;
    const duration = ev?.duration;
    const startTime = start != null ? new Date(Number(start) * 1000).toISOString() : null;
    const endTime = start != null && duration != null ? new Date((Number(start) + Number(duration)) * 1000).toISOString() : null;
    return { entityType, entityCode, name, severity, startTime, endTime, source: "IODA" };
}

const ISO3_TO_ISO2: Record<string, string> = {
    USA: "US", GBR: "GB", DEU: "DE", FRA: "FR", RUS: "RU", CHN: "CN", JPN: "JP", IND: "IN", BRA: "BR", IRN: "IR",
    IRQ: "IQ", SYR: "SY", YEM: "YE", AFG: "AF", PAK: "PK", UKR: "UA", TUR: "TR", SAU: "SA", EGY: "EG", LBY: "LY",
    SDN: "SD", ETH: "ET", SOM: "SO", KEN: "KE", NGA: "NG", ZAF: "ZA", AUS: "AU", CAN: "CA", MEX: "MX", COL: "CO",
    VEN: "VE", ARG: "AR", ITA: "IT", ESP: "ES", NLD: "NL", POL: "PL", ROU: "RO", CZE: "CZ", GRC: "GR", PRT: "PT",
    HUN: "HU", BGR: "BG", SRB: "RS", KOR: "KR", THA: "TH", VNM: "VN", IDN: "ID", MYS: "MY", PHL: "PH", BGD: "BD",
    NPL: "NP", LKA: "LK", MMR: "MM", KHM: "KH", LAO: "LA", TWN: "TW", ISR: "IL", PSE: "PS", LBN: "LB", JOR: "JO",
    DZA: "DZ", TUN: "TN", MAR: "MA", NER: "NE", MLI: "ML", TCD: "TD", SSD: "SS", UGA: "UG", COD: "CD", COG: "CG",
    CIV: "CI", GHA: "GH", CMR: "CM", TZA: "TZ", MOZ: "MZ", ZWE: "ZW", MWI: "MW", ZMB: "ZM", AGO: "AO", NAM: "NA",
    BWA: "BW", SWZ: "SZ", LSO: "LS", MDG: "MG", MRT: "MR", SEN: "SN", GIN: "GN", SLE: "SL", LBR: "LR", GMB: "GM",
};
function iso3ToIso2(iso3: string): string | null {
    return ISO3_TO_ISO2[iso3] ?? null;
}

function parseOutagesFromResponse(data: unknown): { outages: InternetOutageItem[]; rawList: unknown[] } {
    const obj = data as Record<string, unknown> | undefined;
    let raw: unknown = obj?.data ?? obj?.events ?? obj?.outage_events ?? obj?.outageEvents;
    if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
        const inner = (raw as Record<string, unknown>).events ?? (raw as Record<string, unknown>).data;
        if (Array.isArray(inner)) raw = inner;
    }
    if (raw == null) raw = Array.isArray(data) ? data : [];
    const list = Array.isArray(raw) ? raw : [];
    const mapped = list.map(mapIodaEventToOutage).filter(Boolean) as InternetOutageItem[];
    const byCountry = new Map<string, InternetOutageItem>();
    for (const o of mapped) {
        if (o.entityType !== "country") continue;
        const existing = byCountry.get(o.entityCode);
        if (!existing || o.severity === "high" || (o.severity === "medium" && existing.severity !== "high"))
            byCountry.set(o.entityCode, o);
    }
    return { outages: Array.from(byCountry.values()), rawList: list };
}

export async function GET(request: Request) {
    const url = request.url ? new URL(request.url) : null;
    const fromParam = url?.searchParams.get("from");
    const untilParam = url?.searchParams.get("until");

    const now = Math.floor(Date.now() / 1000);
    const fromNum = fromParam != null ? Number(fromParam) : NaN;
    const untilNum = untilParam != null ? Number(untilParam) : NaN;
    const useParams = Number.isFinite(fromNum) && Number.isFinite(untilNum);
    const fromSec = useParams ? String(Math.floor(fromNum)) : String(now - 6 * 3600);
    const untilSec = useParams ? String(Math.floor(untilNum)) : String(now);

    const cacheKey = `${CACHE_KEY}:${fromSec}:${untilSec}`;
    const cached = get<{ outages: InternetOutageItem[]; debug?: string }>(cacheKey);
    if (cached?.outages && Array.isArray(cached.outages)) {
        return NextResponse.json(cached);
    }

    let outages: InternetOutageItem[] = [];
    let debug = "no data";

    try {
        const eventsUrl = `${IODA_BASE}/outages/events?from=${fromSec}&until=${untilSec}&entityType=country&limit=500`;
        console.log("[API/internet-outages] GET", eventsUrl);

        const res = await fetch(eventsUrl, {
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(IODA_FETCH_TIMEOUT_MS),
        });

        console.log("[API/internet-outages] events status", res.status);

        if (res.ok) {
            const data = await res.json();
            const parsed = parseOutagesFromResponse(data);
            outages = parsed.outages;
            debug =
                parsed.rawList.length === 0
                    ? "ioda-events empty (no events in window)"
                    : `ioda-events raw ${parsed.rawList.length} → ${outages.length} countries`;
            if (process.env.NODE_ENV === "development" && parsed.rawList.length > 0) {
                console.debug("[API/internet-outages] loaded events:", parsed.rawList.length, "→ countries:", outages.length);
            }
            if (parsed.rawList.length > 0) {
                const first = parsed.rawList[0] as Record<string, unknown>;
                const keys = first ? Object.keys(first).join(", ") : "";
                console.log("[API/internet-outages] first event keys:", keys);
                if (outages.length === 0)
                    console.warn("[API/internet-outages] sample event:", JSON.stringify(first)?.slice(0, 400));
            }
        } else {
            const snippet = (await res.text()).slice(0, 300);
            console.warn("[API/internet-outages] events 4xx/5xx body:", snippet);

            // Alerts fallback: same from/until as events for consistent time window and playback
            const alertsUrl = `${IODA_BASE}/outages/alerts?from=${fromSec}&until=${untilSec}&limit=500`;
            const fallbackRes = await fetch(alertsUrl, {
                cache: "no-store",
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(IODA_FETCH_TIMEOUT_MS),
            });
            console.log("[API/internet-outages] alerts status", fallbackRes.status);
            if (fallbackRes.ok) {
                const data = await fallbackRes.json();
                const raw = data?.data ?? data?.alerts ?? (Array.isArray(data) ? data : []);
                const parsed = parseOutagesFromResponse({ data: raw });
                outages = parsed.outages;
                debug =
                    parsed.rawList.length === 0
                        ? "ioda-alerts empty"
                        : `ioda-alerts raw ${parsed.rawList.length} → ${outages.length} countries`;
                if (parsed.rawList.length > 0 && outages.length === 0)
                    console.warn("[API/internet-outages] alerts sample:", JSON.stringify(parsed.rawList[0])?.slice(0, 300));
            } else {
                const fallbackSnippet = (await fallbackRes.text()).slice(0, 200);
                console.warn("[API/internet-outages] alerts 4xx/5xx body:", fallbackSnippet);
                debug = `events ${res.status}; alerts ${fallbackRes.status}`;
            }
        }
    } catch (err) {
        debug = err instanceof Error ? err.message : "fetch error";
        console.warn("[API/internet-outages]", debug);
    }

    const payload = { outages, source: "IODA", debug };
    set(cacheKey, payload, CACHE_TTL_MS);
    return NextResponse.json(payload);
}
