/** Normal interval when no backoff (15s to stay under typical anonymous limits). */
export const POLL_INTERVAL = 15000; // 15 seconds

/** Minimum wait after 429 when server does not send Retry-After (conservative fallback). */
export const MIN_BACKOFF_AFTER_429_MS = 60_000; // 60 seconds

// Global state to survive HMR in Next.js development
export const globalState = globalThis as unknown as {
    aviationData: any;
    aviationTimestamp: number;
    aviationPollingStarted: boolean;
    aviationPollingInterval: NodeJS.Timeout | null;
    accessToken: string | null;
    tokenExpiry: number;
    isFetching: boolean;
    lastSupabaseInsert: number;
    currentBackoff: number;
    /** When set (after 429), next poll must wait at least this many ms (from server Retry-After). */
    retryAfterMs: number;
    /** Last HTTP status from OpenSky (e.g. 429); used by API for debug */
    openskyLastStatus: number | null;
};

if (globalState.aviationPollingStarted === undefined) {
    globalState.aviationData = null;
    globalState.aviationTimestamp = 0;
    globalState.aviationPollingStarted = false;
    globalState.aviationPollingInterval = null;
    globalState.accessToken = null;
    globalState.tokenExpiry = 0;
    globalState.isFetching = false;
    globalState.lastSupabaseInsert = 0;
    globalState.currentBackoff = POLL_INTERVAL;
    globalState.retryAfterMs = 0;
    globalState.openskyLastStatus = null;
}
