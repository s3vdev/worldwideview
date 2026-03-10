import { test, expect, describe } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Integration test for insecam_cache table.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

const TEST_CATEGORY = "__test_vitest__";

function getClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase env vars");
    return createClient(url, key, { auth: { persistSession: false } });
}

describe("insecam_cache Supabase table", () => {
    test("can write and read back camera data", async () => {
        const supabase = getClient();
        const fakeCameras = [
            { id: "1", city: "TestCity", loclat: "0", loclon: "0" },
            { id: "2", city: "TestCity2", loclat: "1", loclon: "1" },
        ];

        // 1. Upsert
        const { error: writeError } = await (supabase.from("insecam_cache") as any)
            .upsert(
                { category: TEST_CATEGORY, cameras: fakeCameras, updated_at: new Date().toISOString() },
                { onConflict: "category" },
            );
        expect(writeError).toBeNull();
        console.log("[Test] Write succeeded");

        // 2. Read back
        const { data, error: readError } = await supabase
            .from("insecam_cache")
            .select("cameras, updated_at")
            .eq("category", TEST_CATEGORY)
            .single() as { data: any; error: any };

        expect(readError).toBeNull();
        expect(data).not.toBeNull();
        expect(data.cameras).toHaveLength(2);
        expect(data.cameras[0].city).toBe("TestCity");
        console.log("[Test] Read succeeded:", data.cameras.length, "cameras");

        // 3. Verify freshness (just written = age < TTL)
        const age = Date.now() - new Date(data.updated_at).getTime();
        expect(age).toBeLessThan(60_000); // Should be < 1 minute old
        console.log(`[Test] Cache age: ${age}ms`);

        // 4. Cleanup
        await (supabase.from("insecam_cache") as any)
            .delete()
            .eq("category", TEST_CATEGORY);
        console.log("[Test] Cleanup done");
    });

    test("returns no data for missing category", async () => {
        const supabase = getClient();

        const { data, error } = await supabase
            .from("insecam_cache")
            .select("cameras, updated_at")
            .eq("category", "__nonexistent__")
            .single() as { data: any; error: any };

        // Supabase returns PGRST116 for "no rows" on .single()
        expect(data).toBeNull();
        expect(error).not.toBeNull();
        console.log("[Test] Missing category error code:", error.code);
    });
});
