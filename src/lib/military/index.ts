import { globalState, POLL_INTERVAL } from "./state";
import { getCachedMilitaryData } from "./cache";
import { pollMilitary, fetchMilitaryIfNeeded } from "./polling";

export { getCachedMilitaryData, fetchMilitaryIfNeeded };

export function startMilitaryPolling() {
    if (globalState.militaryPollingStarted) {
        return;
    }

    globalState.militaryPollingStarted = true;
    globalState.currentMilitaryBackoff = POLL_INTERVAL;
    console.log(
        `[Military Polling] Starting background polling with initial interval ${POLL_INTERVAL}ms`,
    );

    // Run immediately, the next poll will be scheduled in the finally block
    pollMilitary();
}
