import { NextRequest } from "next/server";
import * as insecam from "insecam-api";
import * as cheerio from "cheerio";

/** Scrape a single page of Insecam and return camera IDs. */
async function scrapePageIds(category: string, page: number): Promise<string[]> {
    const url = `http://www.insecam.org/en/by${category}/?page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": "WorldWideView/1.0" } });
    const text = await res.text();
    if (typeof text !== "string" || text.length === 0) return [];
    if (!text.includes("<") || !text.includes(">")) return [];
    try {
        const $ = cheerio.load(text);
        const ids: string[] = [];
        $(".thumbnail-item__wrap").each(function () {
            const href = $(this).attr("href");
            if (href) ids.push(href.slice(9, -1));
        });
        return ids;
    } catch {
        return [];
    }
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

const MAX_CONCURRENT = 10;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "rating";
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 90;
    const limitSafe = isNaN(limit) || limit < 6 ? 90 : Math.min(limit, 600);
    const pagesToFetch = Math.ceil(limitSafe / 6);

    const stream = new ReadableStream({
        async start(controller) {
            try {
                // 1. Scrape all pages concurrently to collect camera IDs
                const pagePromises = Array.from({ length: pagesToFetch }, (_, i) =>
                    scrapePageIds(category, i + 1).catch(() => [] as string[])
                );
                const pageResults = await Promise.all(pagePromises);
                const cameraIds = pageResults.flat().slice(0, limitSafe);

                if (cameraIds.length === 0) {
                    controller.enqueue(new TextEncoder().encode(
                        JSON.stringify({ error: "No cameras found" }) + "\n"
                    ));
                    controller.close();
                    return;
                }

                // 2. Fetch details in batches; stream each batch as NDJSON
                for (let i = 0; i < cameraIds.length; i += MAX_CONCURRENT) {
                    const batch = cameraIds.slice(i, i + MAX_CONCURRENT);
                    const cameras = await fetchCameraBatch(batch);
                    if (cameras.length > 0) {
                        const line = JSON.stringify({ cameras }) + "\n";
                        controller.enqueue(new TextEncoder().encode(line));
                    }
                }

                controller.close();
            } catch (err: any) {
                console.error("[Insecam Proxy] Stream error:", err);
                try {
                    controller.enqueue(new TextEncoder().encode(
                        JSON.stringify({ error: err.message }) + "\n"
                    ));
                } catch { /* controller may already be closed */ }
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "application/x-ndjson",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-cache",
        },
    });
}
