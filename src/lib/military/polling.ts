import { globalState, POLL_INTERVAL } from "./state";
import { updateMilitaryCache, getCachedMilitaryData } from "./cache";

const ADSB_FI_MIL_URL = "https://opendata.adsb.fi/api/v2/mil";

/** Cache considered fresh for this many ms (slightly less than client poll interval). */
const CACHE_FRESH_MS = 55_000;

/**
 * Fetch from adsb.fi if cache is empty or stale. Used by GET /api/military when layer is enabled.
 * Prevents concurrent fetches via isMilitaryFetching.
 */
export async function fetchMilitaryIfNeeded(): Promise<void> {
    const cached = getCachedMilitaryData();
    if (cached.data && Date.now() - cached.timestamp < CACHE_FRESH_MS) return;
    if (globalState.isMilitaryFetching) return;

    globalState.isMilitaryFetching = true;
    try {
        const res = await fetch(ADSB_FI_MIL_URL, {
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
            console.warn(`[Military] adsb.fi returned ${res.status}: ${res.statusText}`);
            return;
        }
        const data = await res.json();
        const now = Date.now();
        updateMilitaryCache(data, now);
        const count = (data as { ac?: unknown[] }).ac?.length ?? 0;
        console.log(`[Military] Fetched ${count} military aircraft from adsb.fi (on-demand)`);
    } catch (err) {
        console.warn("[Military] Fetch error:", err instanceof Error ? err.message : err);
    } finally {
        globalState.isMilitaryFetching = false;
    }
}

export async function pollMilitary() {
    if (globalState.isMilitaryFetching) return;
    globalState.isMilitaryFetching = true;

    try {
        const res = await fetch(ADSB_FI_MIL_URL, {
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            globalState.currentMilitaryBackoff = Math.min(
                (globalState.currentMilitaryBackoff || POLL_INTERVAL) * 2,
                5 * 60 * 1000,
            );
            console.warn(
                `[Military Polling] adsb.fi returned ${res.status}: ${res.statusText} ` +
                `(Backing off to ${globalState.currentMilitaryBackoff / 1000}s)`,
            );
            return;
        }

        globalState.currentMilitaryBackoff = POLL_INTERVAL;
        const data = await res.json();
        const now = Date.now();

        console.log(
            `[Military Polling] Fetched ${(data as { ac?: unknown[] }).ac?.length ?? 0} military aircraft from adsb.fi`,
        );

        updateMilitaryCache(data, now);
    } catch (err) {
        globalState.currentMilitaryBackoff = Math.min(
            (globalState.currentMilitaryBackoff || POLL_INTERVAL) * 2,
            5 * 60 * 1000,
        );

        const error = err as Error & { cause?: { code?: string } };
        const isTimeout =
            error?.name === "AbortError" ||
            error?.name === "TimeoutError" ||
            error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
        const message = isTimeout
            ? "Connection timed out"
            : error?.message || String(error);
        console.error(
            `[Military Polling] Error (Backing off to ${globalState.currentMilitaryBackoff / 1000}s): ${message}`,
        );
    } finally {
        globalState.isMilitaryFetching = false;

        if (globalState.militaryPollingInterval) {
            clearTimeout(globalState.militaryPollingInterval);
        }
        const jitter = Math.floor(Math.random() * 5000);
        globalState.militaryPollingInterval = setTimeout(
            pollMilitary,
            globalState.currentMilitaryBackoff + jitter,
        );
    }
}
