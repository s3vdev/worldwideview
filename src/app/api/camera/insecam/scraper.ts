import * as insecam from "insecam-api";
import * as cheerio from "cheerio";

const MAX_CONCURRENT = 10;

/** Scrape a single page of Insecam and return camera IDs. */
async function scrapePageIds(category: string, page: number): Promise<string[]> {
    const url = `http://www.insecam.org/en/by${category}/?page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": "WorldWideView/1.0" } });
    const text = await res.text();
    const $ = cheerio.load(text);
    const ids: string[] = [];
    $(".thumbnail-item__wrap").each(function () {
        const href = $(this).attr("href");
        if (href) ids.push(href.slice(9, -1));
    });
    return ids;
}

/** Fetch camera details for a batch of IDs, returning non-null results. */
async function fetchCameraBatch(ids: string[]): Promise<any[]> {
    const results = await Promise.all(
        ids.map(async (id) => {
            try { return await insecam.camera(id); }
            catch { return null; }
        })
    );
    return results.filter(Boolean);
}

/**
 * Scrape insecam cameras for a category up to a limit.
 * Calls `onBatch` for each batch of camera details fetched.
 */
export async function scrapeInsecamCameras(
    category: string,
    limit: number,
    onBatch: (cameras: any[]) => void,
): Promise<void> {
    const pagesToFetch = Math.ceil(limit / 6);

    const pagePromises = Array.from({ length: pagesToFetch }, (_, i) =>
        scrapePageIds(category, i + 1).catch(() => [] as string[])
    );
    const pageResults = await Promise.all(pagePromises);
    const cameraIds = pageResults.flat().slice(0, limit);

    for (let i = 0; i < cameraIds.length; i += MAX_CONCURRENT) {
        const batch = cameraIds.slice(i, i + MAX_CONCURRENT);
        const cameras = await fetchCameraBatch(batch);
        if (cameras.length > 0) onBatch(cameras);
    }
}
