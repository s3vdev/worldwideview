import { globalState, POLL_INTERVAL } from "./state";
import { getCachedAviationData } from "./cache";
import { pollAviation } from "./polling";

export { getCachedAviationData };

/** Delay before first poll to avoid burst if register() runs in multiple contexts and to reduce 429 risk on startup. */
const FIRST_POLL_DELAY_MS = 3000;

export function startAviationPolling() {
    if (globalState.aviationPollingStarted) {
        return;
    }
    globalState.aviationPollingStarted = true;
    globalState.currentBackoff = POLL_INTERVAL;

    // Clear any stale timeout from a previous lifecycle (ensures single chain)
    if (globalState.aviationPollingInterval) {
        clearTimeout(globalState.aviationPollingInterval);
        globalState.aviationPollingInterval = null;
    }

    console.log(`[Aviation Polling] Starting (first poll in ${FIRST_POLL_DELAY_MS}ms, then every ${POLL_INTERVAL}ms)`);

    // Single scheduled chain: first poll after delay, then polling.ts schedules further polls
    globalState.aviationPollingInterval = setTimeout(pollAviation, FIRST_POLL_DELAY_MS);
}
