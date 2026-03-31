const fastify = require('fastify')({ logger: true });
const fastifyCors = require('@fastify/cors');
const fastifyRateLimit = require('@fastify/rate-limit');
const { z } = require('zod');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

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

// Initialize standalone SQLite Database
const db = new Database(path.join(dataDir, 'history.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS iranwar_events (
    event_id TEXT PRIMARY KEY,
    payload JSON NOT NULL,
    timestamp TEXT NOT NULL
  )
`);

const insertEvent = db.prepare('INSERT OR IGNORE INTO iranwar_events (event_id, payload, timestamp) VALUES (@event_id, @payload, @timestamp)');
const getAllEventsQuery = db.prepare('SELECT payload FROM iranwar_events ORDER BY timestamp DESC');

// Poller Logic
async function pollFeed() {
    try {
        fastify.log.info('Polling iranwarlive.com/feed.json...');
        const response = await fetch('https://iranwarlive.com/feed.json');
        
        if (!response.ok) {
            throw new Error(`Feed responded with HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            // Deduplicate to only hydrate new items
            const placeholders = data.items.map(() => '?').join(',');
            const existingIdsStmt = db.prepare(`SELECT event_id FROM iranwar_events WHERE event_id IN (${placeholders})`);
            const existingIdsRow = existingIdsStmt.all(...data.items.map(i => i.event_id));
            const existingIds = new Set(existingIdsRow.map(row => row.event_id));
            
            const newItems = data.items.filter(item => !existingIds.has(item.event_id));
            
            if (newItems.length > 0) {
                // Async Hydration
                for (const item of newItems) {
                    if (item.source_url) {
                        try {
                            const htmlRes = await fetch(item.source_url, { headers: { "User-Agent": "WorldWideView-OSINT/1.0" } });
                            if (htmlRes.ok) {
                                const html = await htmlRes.text();
                                const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) 
                                             || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
                                if (ogMatch && ogMatch[1]) {
                                    item.preview_image = ogMatch[1];
                                }
                            }
                        } catch (err) {
                            fastify.log.warn(`Failed to hydrate image for ${item.event_id}: ${err.message}`);
                        }
                    }
                }

                // Synchrous Inserts
                let insertedCount = 0;
                const insertMany = db.transaction((events) => {
                    for (const item of events) {
                        try {
                            const validatedItem = itemSchema.parse(item);
                            const result = insertEvent.run({
                                event_id: validatedItem.event_id,
                                payload: JSON.stringify(validatedItem),
                                timestamp: validatedItem.timestamp
                            });
                            if (result.changes > 0) insertedCount++;
                        } catch(err) {
                            fastify.log.warn(`Skipped item due to validation error: ${err.message}`);
                        }
                    }
                });
                
                insertMany(newItems);
                if (insertedCount > 0) {
                   fastify.log.info(`Polled successfully. Added ${insertedCount} new hydrated events to history.`);
                }
            }
        }
    } catch (error) {
        fastify.log.error(`Polling Error: ${error.message}`);
    }
}

// Enable rate limiting DDoS protection
fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

// Enable liberal CORS for frontend plugin
fastify.register(fastifyCors, { origin: '*' });

fastify.get('/api/history', async (request, reply) => {
    // Return all historically cached events from SQLite
    const rows = getAllEventsQuery.all();
    const history = rows.map(row => JSON.parse(row.payload));
    
    return {
        version: "2.0",
        last_updated: new Date().toISOString(),
        items: history
    };
});

// Setup Initial Poll and Interval Iterator
const POLLING_INTERVAL_MS = 60000; // 1 minute
setInterval(pollFeed, POLLING_INTERVAL_MS);

// Boot
const start = async () => {
    try {
        // Run initial seed immediately
        await pollFeed();
        
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        console.log("IranWarLive Microservice backend listening on port 3001");
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
