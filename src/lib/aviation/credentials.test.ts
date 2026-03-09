import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    initCredentialPool,
    getActiveCredential,
    rotateCredential,
    updateCredentialCredits,
    getUsableCount,
    resetPool,
} from "./credentials";

describe("Credential Pool", () => {
    beforeEach(() => {
        resetPool();
        vi.unstubAllEnvs();
    });

    it("should parse OPENSKY_CREDENTIALS into multiple credentials", () => {
        vi.stubEnv("OPENSKY_CREDENTIALS", "id1:secret1,id2:secret2,id3:secret3");
        initCredentialPool();
        expect(getUsableCount()).toBe(3);
        expect(getActiveCredential()?.clientId).toBe("id1");
    });

    it("should fall back to legacy single env vars", () => {
        vi.stubEnv("OPENSKY_CLIENTID", "legacy-id");
        vi.stubEnv("OPENSKY_CLIENTSECRET", "legacy-secret");
        initCredentialPool();
        expect(getUsableCount()).toBe(1);
        expect(getActiveCredential()?.clientId).toBe("legacy-id");
    });

    it("should return null when no credentials configured", () => {
        initCredentialPool();
        expect(getActiveCredential()).toBeNull();
        expect(getUsableCount()).toBe(0);
    });

    it("should rotate to the next credential", () => {
        vi.stubEnv("OPENSKY_CREDENTIALS", "id1:s1,id2:s2,id3:s3");
        initCredentialPool();
        expect(getActiveCredential()?.clientId).toBe("id1");

        rotateCredential();
        expect(getActiveCredential()?.clientId).toBe("id2");

        rotateCredential();
        expect(getActiveCredential()?.clientId).toBe("id3");
    });

    it("should return null after all credentials exhausted", () => {
        vi.stubEnv("OPENSKY_CREDENTIALS", "id1:s1,id2:s2");
        initCredentialPool();

        rotateCredential(); // exhaust id1
        rotateCredential(); // exhaust id2
        expect(getActiveCredential()).toBeNull();
        expect(getUsableCount()).toBe(0);
    });

    it("should auto-rotate when credits drop below threshold", () => {
        vi.stubEnv("OPENSKY_CREDENTIALS", "id1:s1,id2:s2");
        initCredentialPool();
        expect(getActiveCredential()?.clientId).toBe("id1");

        // High credits — no rotation
        updateCredentialCredits(3000);
        expect(getActiveCredential()?.clientId).toBe("id1");

        // Below threshold (50) — should rotate
        updateCredentialCredits(30);
        expect(getActiveCredential()?.clientId).toBe("id2");
    });

    it("should skip malformed credential pairs", () => {
        vi.stubEnv("OPENSKY_CREDENTIALS", "id1:s1,,bad,id2:s2");
        initCredentialPool();
        expect(getUsableCount()).toBe(2);
    });

    it("should be idempotent on repeated init calls", () => {
        vi.stubEnv("OPENSKY_CREDENTIALS", "id1:s1");
        initCredentialPool();
        initCredentialPool();
        expect(getUsableCount()).toBe(1);
    });
});
