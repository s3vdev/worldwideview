import { getSupabaseClient } from "@/lib/supabase";

/** Cache is considered fresh for 24 hours. */
const CACHE_TTL_MS = 86_400_000;

export interface InsecamCacheEntry {
    cameras: any[];
    isFresh: boolean;
}

/**
 * Retrieve cached insecam cameras for a given category.
 * Returns `{ cameras, isFresh }` where `isFresh` indicates
 * whether the cache is within the TTL window.
 */
export async function getCachedInsecam(category: string): Promise<InsecamCacheEntry | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.warn("[InsecamCache] No Supabase client — skipping cache read");
        return null;
    }

    console.log(`[InsecamCache] Reading cache for category="${category}"...`);

    const { data, error } = await supabase
        .from("insecam_cache")
        .select("cameras, updated_at")
        .eq("category", category)
        .single() as { data: { cameras: any[]; updated_at: string } | null; error: any };

    if (error) {
        console.warn(`[InsecamCache] Cache read error: ${error.code} — ${error.message}`);
        return null;
    }
    if (!data) {
        console.log("[InsecamCache] No cache entry found");
        return null;
    }

    const age = Date.now() - new Date(data.updated_at).getTime();
    const cameraCount = Array.isArray(data.cameras) ? data.cameras.length : 0;
    const isFresh = age < CACHE_TTL_MS;

    console.log(`[InsecamCache] Cache hit: ${cameraCount} cameras, age=${Math.round(age / 60000)}m, fresh=${isFresh}`);

    return {
        cameras: data.cameras ?? [],
        isFresh,
    };
}

/**
 * Upsert camera data into the cache for a given category.
 * Overwrites any existing entry and resets `updated_at`.
 */
export async function setCachedInsecam(category: string, cameras: any[]): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.warn("[InsecamCache] No Supabase client — skipping cache write");
        return;
    }

    console.log(`[InsecamCache] Writing ${cameras.length} cameras to cache for category="${category}"...`);

    const { error } = await (supabase
        .from("insecam_cache") as any)
        .upsert(
            { category, cameras, updated_at: new Date().toISOString() },
            { onConflict: "category" },
        );

    if (error) {
        console.error(`[InsecamCache] Cache write FAILED: ${error.code} — ${error.message}`);
    } else {
        console.log(`[InsecamCache] Cache write SUCCESS: ${cameras.length} cameras cached`);
    }
}
