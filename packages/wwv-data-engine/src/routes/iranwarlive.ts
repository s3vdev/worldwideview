import { fastify } from '../server';
import { db } from '../db';
import { getLiveSnapshot } from '../redis';

const getAllEventsQuery = db.prepare('SELECT payload FROM iranwar_events ORDER BY timestamp DESC');

// Standard live endpoint -> returns Redis snapshot
fastify.get('/data/iranwarlive', async (request, reply) => {
  const liveData = await getLiveSnapshot('iranwarlive');
  if (liveData) {
    return liveData;
  }
  
  // Fallback to SQLite if Redis is empty/cleared
  const rows = getAllEventsQuery.all() as { payload: string }[];
  const history = rows.map(row => JSON.parse(row.payload));
  return {
    source: "iranwarlive",
    fetchedAt: new Date().toISOString(),
    items: history
  };
});

// Full history endpoint -> queries SQLite
fastify.get('/data/iranwarlive/history', async (request, reply) => {
  // Iran war live has small enough history that we can return it all.
  // In a massive set, we would use query params: ?start=ts&end=ts
  const rows = getAllEventsQuery.all() as { payload: string }[];
  const history = rows.map(row => JSON.parse(row.payload));
  
  return {
    version: "2.0",
    source: "iranwarlive",
    last_updated: new Date().toISOString(),
    items: history
  };
});
