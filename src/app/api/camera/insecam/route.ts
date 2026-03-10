import { NextRequest } from "next/server";
import { getCachedInsecam, setCachedInsecam } from "@/lib/camera/insecamCache";
import { scrapeInsecamCameras } from "./scraper";

const MAX_LIMIT = 2000;

/** Scrape and persist cameras to cache (runs in background). */
async function refreshCache(category: string): Promise<void> {
    const allCameras: any[] = [];
    await scrapeInsecamCameras(category, MAX_LIMIT, (batch: any[]) => allCameras.push(...batch));
    if (allCameras.length > 0) {
        await setCachedInsecam(category, allCameras);
        console.log(`[Insecam] Cache refreshed: ${allCameras.length} cameras (category=${category})`);
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "rating";

    // 1. Check cache
    const cached = await getCachedInsecam(category).catch((err) => {
        console.error("[Insecam] Cache check failed:", err);
        return null;
    });

    // 2. If we have ANY cached data, return it immediately
    if (cached && cached.cameras.length > 0) {
        if (!cached.isFresh) {
            refreshCache(category).catch((err) =>
                console.error("[Insecam] Background refresh failed:", err)
            );
        }
        console.log(`[Insecam] Serving ${cached.cameras.length} cameras from cache (fresh=${cached.isFresh})`);
        return Response.json({ cameras: cached.cameras });
    }

    // 3. No cache — scrape synchronously, cache, and return
    try {
        const allCameras: any[] = [];
        await scrapeInsecamCameras(category, MAX_LIMIT, (batch: any[]) => {
            allCameras.push(...batch);
        });

        if (allCameras.length > 0) {
            setCachedInsecam(category, allCameras).catch((err) =>
                console.error("[Insecam] Cache write failed:", err)
            );
        }

        return Response.json({ cameras: allCameras });
    } catch (err: any) {
        console.error("[Insecam] Scrape error:", err);
        return Response.json({ cameras: [], error: err.message }, { status: 502 });
    }
}
