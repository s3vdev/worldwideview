import WebSocket from 'ws';
import { db } from '../db';
import { redis } from '../redis';
import { registerSeeder } from '../scheduler';

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const API_KEY = process.env.AISSTREAM_API_KEY;

// Buffer to batch SQLite inserts
let messageBuffer: any[] = [];
const FLUSH_INTERVAL_MS = 5000;

// SQLite insert statement
const insertHistory = db.prepare(`
  INSERT OR IGNORE INTO maritime_history (mmsi, ts, lat, lon, hdg, spd, fetched_at)
  VALUES (@mmsi, @ts, @lat, @lon, @hdg, @spd, @fetched_at)
`);

async function flushBuffer() {
  if (messageBuffer.length === 0) return;
  
  const batch = [...messageBuffer];
  messageBuffer = [];

  const fetchedAt = Date.now();
  let insertedCount = 0;

  // 1. Bulk insert to SQLite for permanent history
  const insertMany = db.transaction((msgs) => {
    for (const msg of msgs) {
      if (!msg.MetaData?.MMSI || !msg.Message?.PositionReport) continue;
      
      const mmsi = msg.MetaData.MMSI.toString();
      const report = msg.Message.PositionReport;
      const ts = Math.floor(new Date(msg.MetaData.time_utc).getTime() / 1000); // Epoch seconds
      
      const result = insertHistory.run({
        mmsi,
        ts,
        lat: report.Latitude,
        lon: report.Longitude,
        hdg: report.TrueHeading,
        spd: report.Sog,
        fetched_at: fetchedAt
      });
      if (result.changes > 0) insertedCount++;
    }
  });

  try {
    insertMany(batch);
    if (insertedCount > 0) {
      // console.log(`[Maritime] Flushed ${insertedCount} new positions to SQLite history`);
    }

    // 2. Pipeline update to Redis Hot Cache
    // We maintain a Redis HASH of all active ships: HSET data:maritime:live <mmsi> <json>
    // We use pipelining (Redis best practice: conn-pipelining) for bulk ops
    const pipeline = redis.pipeline();
    
    for (const msg of batch) {
      if (!msg.MetaData?.MMSI || !msg.Message?.PositionReport) continue;
      const mmsi = msg.MetaData.MMSI.toString();
      const report = msg.Message.PositionReport;
      const ts = Math.floor(new Date(msg.MetaData.time_utc).getTime() / 1000);
      
      const shipState = {
        id: `mmsi-${mmsi}`,
        mmsi,
        name: msg.MetaData.ShipName ? msg.MetaData.ShipName.trim() : `Unknown (${mmsi})`,
        lat: report.Latitude,
        lon: report.Longitude,
        hdg: report.TrueHeading,
        spd: report.Sog,
        last_updated: ts
      };
      
      pipeline.hset('data:maritime:live', mmsi, JSON.stringify(shipState));
    }
    
    await pipeline.exec();

    // Expire the entire hash after 6 hours if no updates (best practice: ram-ttl)
    await redis.expire('data:maritime:live', 6 * 3600);

  } catch (err) {
    console.error('[Maritime] Buffer flush failed:', err);
  }
}

export function startMaritimeWebsocket() {
  if (!API_KEY) {
    console.warn('[Maritime] Skipping AIS websocket: AISSTREAM_API_KEY not set.');
    return;
  }

  console.log('[Maritime] Connecting to AisStream.io...');
  const ws = new WebSocket(AISSTREAM_URL);

  ws.on('open', () => {
    console.log('[Maritime] WebSocket connected. Subscribing to global feed...');
    // Bounding box for English Channel / Strait of Hormuz / global (up to API tier)
    // Here we request global or specific high-traffic boxes
    const subscriptionMessage = {
      APIKey: API_KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]], // Global (requires paid tier for real use)
      FiltersShipMMSI: [], // All ships
      FilterMessageTypes: ["PositionReport"]
    };
    ws.send(JSON.stringify(subscriptionMessage));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.MessageType === "PositionReport" || msg.Message?.PositionReport) {
        messageBuffer.push(msg);
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  ws.on('error', (err) => {
    console.error('[Maritime] WebSocket error:', err.message);
  });

  ws.on('close', () => {
    console.log('[Maritime] WebSocket closed. Reconnecting in 5s...');
    setTimeout(startMaritimeWebsocket, 5000);
  });

  // Start background flush loop
  setInterval(flushBuffer, FLUSH_INTERVAL_MS);
}

// Register initialization logic. No cron needed, runs infinitely.
registerSeeder({
  name: "maritime",
  init: startMaritimeWebsocket
});
