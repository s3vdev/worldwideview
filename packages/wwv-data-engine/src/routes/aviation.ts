import { fastify } from '../server';
import { db } from '../db';
import { redis, getLiveSnapshot } from '../redis';

fastify.get('/data/aviation', async (request: any, reply) => {
  const { lookback, time } = request.query;
  
  // Historical playback mode snapshot
  if (time && typeof time === 'string') {
    const targetTs = Math.floor(parseInt(time, 10) / 1000);
    // Find closest records within 60 seconds
    const historyQuery = db.prepare(`
        SELECT icao24, ts, lat, lon, hdg, spd, alt
        FROM aviation_history
        WHERE ts BETWEEN @start AND @end
    `);
    const historyRows = historyQuery.all({ start: targetTs - 60, end: targetTs + 60 }) as any[];
    
    // Group to latest reading per icao
    const closest = new Map();
    for (const r of historyRows) {
        if (!closest.has(r.icao24) || Math.abs(r.ts - targetTs) < Math.abs(closest.get(r.icao24).ts - targetTs)) {
            closest.set(r.icao24, {
              ...r,
              on_ground: r.alt <= 0
            });
        }
    }
    
    return {
        source: "aviation",
        fetchedAt: new Date().toISOString(),
        lookbackSeconds: 0,
        items: Array.from(closest.values()),
        totalCount: closest.size
    };
  }

  // Parse lookback (e.g., "1h" -> seconds)
  let lookbackSeconds = 0;
  if (lookback && typeof lookback === 'string') {
    const match = lookback.match(/^(\d+)([hm])$/);
    if (match) {
      const val = parseInt(match[1], 10);
      lookbackSeconds = match[2] === 'h' ? val * 3600 : val * 60;
    }
  }

  // 1. Get hot fleet from Redis
  const fleetObj = await getLiveSnapshot('aviation') || {};
  const activeFleet = Object.values(fleetObj) as any[];
  const nowTs = Math.floor(Date.now() / 1000);

  // Filter out planes that haven't updated
  const maxAge = lookbackSeconds > 0 ? lookbackSeconds : 3600;
  let items = activeFleet.filter(plane => (nowTs - plane.last_updated) <= maxAge);

  // 2. Attach history trails from SQLite if requested
  if (lookbackSeconds > 0) {
    const startTs = nowTs - lookbackSeconds;
    
    // One big query grouped by plane
    const allHistoryQuery = db.prepare(`
      SELECT icao24, ts, lat, lon, hdg, spd, alt 
      FROM aviation_history 
      WHERE ts >= @start_ts
      ORDER BY ts ASC
    `);
    
    const allRows = allHistoryQuery.all({ start_ts: startTs }) as any[];
    
    const historyMap = new Map<string, any[]>();
    for (const row of allRows) {
      if (!historyMap.has(row.icao24)) historyMap.set(row.icao24, []);
      historyMap.get(row.icao24)!.push({
        ts: row.ts,
        lat: row.lat,
        lon: row.lon,
        hdg: row.hdg,
        spd: row.spd,
        alt: row.alt
      });
    }

    // Attach to active fleet
    items = items.map(plane => ({
      ...plane,
      history: historyMap.get(plane.icao24) || []
    }));
  }

  return {
    source: "aviation",
    fetchedAt: new Date().toISOString(),
    lookbackSeconds: lookbackSeconds || null,
    items,
    totalCount: items.length
  };
});
