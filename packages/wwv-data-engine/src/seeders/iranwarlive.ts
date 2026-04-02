import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { db } from '../db';
import { setLiveSnapshot } from '../redis';
import { fetchWithTimeout, withRetry } from '../seed-utils';
import { registerSeeder } from '../scheduler';

// Zod Schema for input validation to strip unrecognized injection keys
const itemSchema = z.object({
  event_id: z.string().max(255),
  type: z.string().max(255).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  timestamp: z.string().max(100),
  confidence: z.string().max(100).nullable().optional(),
  event_summary: z.string().max(10000).nullable().optional(),
  source_url: z.string().max(2000).nullable().optional(),
  preview_image: z.string().url().max(2000).nullable().optional(),
  _osint_meta: z.any().optional()
});

const insertEvent = db.prepare(`
  INSERT INTO iranwar_events (event_id, payload, timestamp, fetched_at) 
  VALUES (@event_id, @payload, @timestamp, @fetched_at)
  ON CONFLICT(event_id) DO UPDATE SET 
    payload=excluded.payload, 
    timestamp=excluded.timestamp
`);
const getTopEvents = db.prepare('SELECT payload FROM iranwar_events ORDER BY timestamp DESC LIMIT 500');

let hasHydratedSeed = false;

export async function seedIranWarLive() {
  // --- SELF-HEALING HISTORY SEED ---
  if (!hasHydratedSeed) {
    console.log('[IranWarLive] Initializing: Hydrating/Upserting active fallback seed...');
    const seedPath = path.join(__dirname, '..', '..', 'data', 'fallback', 'iranwar_seed.json');
    if (fs.existsSync(seedPath)) {
      const fallbackData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      const fetchedAt = Date.now();
      let insertedCount = 0;
      let variables = 0;
      const upsertMany = db.transaction((events: any[]) => {
        for (const item of events) {
          try {
            const validatedItem = itemSchema.parse(item);
            const result = insertEvent.run({
              event_id: validatedItem.event_id,
              payload: JSON.stringify(validatedItem),
              timestamp: validatedItem.timestamp,
              fetched_at: fetchedAt
            });
            if (result.changes > 0) insertedCount++;
          } catch(err) { /* ignore validation errors in fallback */ }
        }
      });
      upsertMany(fallbackData);
      console.log(`[IranWarLive] Boot hydration complete. Merged ${insertedCount} seed events.`);
    }
    hasHydratedSeed = true;
  }

  console.log('[IranWarLive] Polling iranwarlive.com/feed.json...');
  
  let data: any = null;
  try {
    const response = await withRetry(() => fetchWithTimeout('https://iranwarlive.com/feed.json', {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Cache-Control": "no-cache",
        "Accept-Language": "en-US,en;q=0.9"
      }
    }));
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch(err: any) {
    console.warn(`[IranWarLive] Failed to fetch live feed (anti-bot block?): ${err.message}. Using local database cache.`);
  }
  
  if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
    const fetchedAt = Date.now();
    let insertedCount = 0;
    
    // Find completely new items to hydrate
    const placeholders = data.items.map(() => '?').join(',');
    const existingIdsStmt = db.prepare(`SELECT event_id FROM iranwar_events WHERE event_id IN (${placeholders})`);
    const existingIdsRow = existingIdsStmt.all(...data.items.map((i: any) => i.event_id)) as { event_id: string }[];
    const existingIds = new Set(existingIdsRow.map(row => row.event_id));
    
    const newItems = data.items.filter((item: any) => !existingIds.has(item.event_id));
    
    if (newItems.length > 0) {
      console.log(`[IranWarLive] Found ${newItems.length} new events. Hydrating og:images...`);
      for (const item of newItems) {
        if (item.source_url) {
          try {
            const htmlRes = await fetchWithTimeout(item.source_url, { headers: { "User-Agent": "WorldWideView-OSINT/1.0" } }, 5000);
            const html = await htmlRes.text();
            const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) 
                          || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
            if (ogMatch && ogMatch[1]) {
              item.preview_image = ogMatch[1];
            }
          } catch (err: any) {
            console.warn(`[IranWarLive] Failed to hydrate image for ${item.event_id}: ${err.message}`);
          }
        }
      }

      const insertMany = db.transaction((events: any[]) => {
        for (const item of events) {
          try {
            const validatedItem = itemSchema.parse(item);
            const result = insertEvent.run({
              event_id: validatedItem.event_id,
              payload: JSON.stringify(validatedItem),
              timestamp: validatedItem.timestamp,
              fetched_at: fetchedAt
            });
            if (result.changes > 0) insertedCount++;
          } catch(err: any) {
            console.warn(`[IranWarLive] Skipped item due to validation error: ${err.message}`);
          }
        }
      });
      
      insertMany(newItems);
      if (insertedCount > 0) {
         console.log(`[IranWarLive] Added ${insertedCount} new hydrated events to history.`);
      }
    } else {
      console.log('[IranWarLive] No new events found.');
    }
  }

  // ALways update Redis hot cache with the latest 500 events
  const rows = getTopEvents.all() as { payload: string }[];
  const history = rows.map(row => JSON.parse(row.payload));
  
  await setLiveSnapshot('iranwarlive', {
    source: "iranwarlive",
    fetchedAt: new Date().toISOString(),
    items: history
  }, 3600); // 1 hour TTL in Redis
}

// Register with scheduler
registerSeeder({
  name: "iranwarlive",
  cron: "*/1 * * * *", // Every minute
  fn: seedIranWarLive
});
