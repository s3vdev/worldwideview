import { fastify } from '../server';
import { db } from '../db';
import { redis } from '../redis';

const getHistoryQuery = db.prepare(`
  SELECT ts, lat, lon, hdg, spd 
  FROM maritime_history 
  WHERE mmsi = @mmsi AND ts >= @start_ts
  ORDER BY ts ASC
`);

fastify.get('/data/maritime', async (request: any, reply) => {
  const { lookback } = request.query;
  
  // Parse lookback (e.g., "6h" -> seconds)
  let lookbackSeconds = 0;
  if (lookback && typeof lookback === 'string') {
    const match = lookback.match(/^(\d+)([hm])$/);
    if (match) {
      const val = parseInt(match[1], 10);
      lookbackSeconds = match[2] === 'h' ? val * 3600 : val * 60;
    }
  }

  // 1. Get hot fleet from Redis (O(1) HGETALL)
  const activeFleetRaw = await redis.hgetall('data:maritime:live');
  const activeFleet = Object.values(activeFleetRaw).map(str => JSON.parse(str));
  const nowTs = Math.floor(Date.now() / 1000);

  // Filter out ships that haven't moved in the lookback window (or 1 hour default)
  const maxAge = lookbackSeconds > 0 ? lookbackSeconds : 3600;
  let items = activeFleet.filter(ship => (nowTs - ship.last_updated) <= maxAge);

  // 2. Attach history trails from SQLite if requested
  if (lookbackSeconds > 0) {
    const startTs = nowTs - lookbackSeconds;
    
    // For large fleets, N+1 queries can be slow. 
    // In production, you would fetch all history in one big query: 
    // SELECT * FROM maritime_history WHERE ts >= @start_ts
    // and group by MMSI in memory. We do the N+1 here for simplicity as SQLite handles it fast.
    
    // Better approach: One big query
    const allHistoryQuery = db.prepare(`
      SELECT mmsi, ts, lat, lon, hdg, spd 
      FROM maritime_history 
      WHERE ts >= @start_ts
      ORDER BY ts ASC
    `);
    
    const allRows = allHistoryQuery.all({ start_ts: startTs }) as any[];
    
    // Group by MMSI
    const historyMap = new Map<string, any[]>();
    for (const row of allRows) {
      if (!historyMap.has(row.mmsi)) historyMap.set(row.mmsi, []);
      historyMap.get(row.mmsi)!.push({
        ts: row.ts,
        lat: row.lat,
        lon: row.lon,
        hdg: row.hdg,
        spd: row.spd
      });
    }

    // Attach to active fleet
    items = items.map(ship => ({
      ...ship,
      history: historyMap.get(ship.mmsi) || []
    }));
  }

  return {
    source: "maritime",
    fetchedAt: new Date().toISOString(),
    lookbackSeconds: lookbackSeconds || null,
    items,
    totalCount: items.length
  };
});
