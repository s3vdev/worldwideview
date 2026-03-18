import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for isDemoAdminRequest.
 *
 * The function depends on module-level constants (isDemo) and
 * process.env.WWV_DEMO_ADMIN_SECRET, so we reset modules between tests.
 */

function makeRequest(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost:3000/api/test", { headers });
}

describe("isDemoAdminRequest", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("returns false on non-demo editions regardless of header", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "local");
        vi.stubEnv("WWV_DEMO_ADMIN_SECRET", "secret123");
        const { isDemoAdminRequest } = await import("./edition");
        expect(isDemoAdminRequest(makeRequest({ "x-wwv-admin-secret": "secret123" }))).toBe(false);
    });

    it("returns false on demo when no secret is configured", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        delete process.env.WWV_DEMO_ADMIN_SECRET;
        const { isDemoAdminRequest } = await import("./edition");
        expect(isDemoAdminRequest(makeRequest({ "x-wwv-admin-secret": "anything" }))).toBe(false);
    });

    it("returns false on demo when header is missing", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        vi.stubEnv("WWV_DEMO_ADMIN_SECRET", "secret123");
        const { isDemoAdminRequest } = await import("./edition");
        expect(isDemoAdminRequest(makeRequest())).toBe(false);
    });

    it("returns false on demo when header has wrong secret", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        vi.stubEnv("WWV_DEMO_ADMIN_SECRET", "secret123");
        const { isDemoAdminRequest } = await import("./edition");
        expect(isDemoAdminRequest(makeRequest({ "x-wwv-admin-secret": "wrong" }))).toBe(false);
    });

    it("returns true on demo when header matches configured secret", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        vi.stubEnv("WWV_DEMO_ADMIN_SECRET", "secret123");
        const { isDemoAdminRequest } = await import("./edition");
        expect(isDemoAdminRequest(makeRequest({ "x-wwv-admin-secret": "secret123" }))).toBe(true);
    });

    it("trims whitespace from configured secret", async () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", "demo");
        vi.stubEnv("WWV_DEMO_ADMIN_SECRET", "  secret123  ");
        const { isDemoAdminRequest } = await import("./edition");
        expect(isDemoAdminRequest(makeRequest({ "x-wwv-admin-secret": "secret123" }))).toBe(true);
    });
});
