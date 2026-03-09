import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseRateLimitHeaders, computeBackoff } from "./rate-limit";
import { globalState, POLL_INTERVAL } from "./state";
import { initCredentialPool, resetPool } from "./credentials";

/** Helper to create a Headers object from a plain record. */
function makeHeaders(entries: Record<string, string>): Headers {
    return new Headers(entries);
}

describe("Rate Limit", () => {
    beforeEach(() => {
        globalState.retryAfterSec = null;
        globalState.currentBackoff = POLL_INTERVAL;
        resetPool();
        vi.stubEnv("OPENSKY_CREDENTIALS", "test-id:test-secret");
        initCredentialPool();
    });

    describe("parseRateLimitHeaders", () => {
        it("should extract credits remaining", () => {
            const headers = makeHeaders({ "X-Rate-Limit-Remaining": "3200" });
            parseRateLimitHeaders(headers);
            // Credits are now stored per-credential (tested in credentials.test.ts)
        });

        it("should extract retry-after seconds", () => {
            const headers = makeHeaders({ "X-Rate-Limit-Retry-After-Seconds": "120" });
            parseRateLimitHeaders(headers);
            expect(globalState.retryAfterSec).toBe(120);
        });

        it("should handle missing headers gracefully", () => {
            const headers = makeHeaders({});
            parseRateLimitHeaders(headers);
            expect(globalState.retryAfterSec).toBeNull();
        });
    });

    describe("computeBackoff", () => {
        it("should return server retry-after when available", () => {
            globalState.retryAfterSec = 60;
            const result = computeBackoff();
            expect(result).toBe(60_000);
            expect(globalState.retryAfterSec).toBeNull();
        });

        it("should cap retry-after at 5 minutes", () => {
            globalState.retryAfterSec = 600;
            const result = computeBackoff();
            expect(result).toBe(5 * 60 * 1000);
        });

        it("should return base interval when no credit info", () => {
            globalState.currentBackoff = POLL_INTERVAL;
            const result = computeBackoff();
            expect(result).toBe(POLL_INTERVAL);
        });
    });
});
