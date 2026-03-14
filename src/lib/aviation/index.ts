import { globalState, POLL_INTERVAL } from "./state";
import { getCachedAviationData } from "./cache";
import { pollAviation } from "./polling";

export { getCachedAviationData };

/** Delay before first poll to avoid burst on startup and reduce 429 risk. Longer in dev. */
const FIRST_POLL_DELAY_MS = process.env.NODE_ENV === "development" ? 10_000 : 5_000;

export function startAviationPolling() {
    if (globalState.aviationPollingStarted) {
        if (process.env.NODE_ENV === "development") {
            console.log("[Aviation Polling] Start skipped — already running (single chain per process)");
        }
        return;
    }
    globalState.aviationPollingStarted = true;
    globalState.currentBackoff = POLL_INTERVAL;

    if (globalState.aviationPollingInterval) {
        clearTimeout(globalState.aviationPollingInterval);
        globalState.aviationPollingInterval = null;
    }

    console.log(`[Aviation Polling] Starting — first poll in ${FIRST_POLL_DELAY_MS / 1000}s, then ~${POLL_INTERVAL / 1000}s`);

    globalState.aviationPollingInterval = setTimeout(pollAviation, FIRST_POLL_DELAY_MS);
}
