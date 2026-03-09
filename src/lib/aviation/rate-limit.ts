import { globalState, POLL_INTERVAL } from "./state";
import { getActiveCredential, updateCredentialCredits } from "./credentials";

const MAX_BACKOFF = 5 * 60 * 1000; // 5 minutes
const DAILY_AUTH_CREDITS = 4000;

/**
 * Parse OpenSky rate-limit headers and store values on the active credential.
 * Headers: X-Rate-Limit-Remaining, X-Rate-Limit-Retry-After-Seconds
 */
export function parseRateLimitHeaders(headers: Headers): void {
    const remaining = headers.get("X-Rate-Limit-Remaining");
    if (remaining !== null) {
        const value = parseInt(remaining, 10);
        console.log(`[Aviation RateLimit] Credits remaining: ${value}`);
        updateCredentialCredits(value);
    }

    const retryAfter = headers.get("X-Rate-Limit-Retry-After-Seconds");
    if (retryAfter !== null) {
        globalState.retryAfterSec = parseInt(retryAfter, 10);
    }
}

/**
 * Compute the next poll backoff interval (ms) using:
 * 1. Server-requested retry-after (highest priority, from 429)
 * 2. Credit-aware adaptive scaling (reads from active credential)
 * 3. Base poll interval fallback
 */
export function computeBackoff(): number {
    // If the server told us to wait, honour that
    if (globalState.retryAfterSec && globalState.retryAfterSec > 0) {
        const retryMs = globalState.retryAfterSec * 1000;
        globalState.retryAfterSec = null; // consume once
        return Math.min(retryMs, MAX_BACKOFF);
    }

    const base = globalState.currentBackoff || POLL_INTERVAL;

    // Read credits from the active credential
    const cred = getActiveCredential();
    if (cred?.creditsRemaining !== null && cred?.creditsRemaining !== undefined) {
        const ratio = cred.creditsRemaining / DAILY_AUTH_CREDITS;

        if (ratio < 0.2) {
            return MAX_BACKOFF;
        }
        if (ratio < 0.5) {
            return Math.min(base * 2, MAX_BACKOFF);
        }
    }

    return Math.min(base, MAX_BACKOFF);
}
