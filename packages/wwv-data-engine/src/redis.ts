import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import zlib from 'zlib';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

// ioredis gracefully handles standard redis:// as well as rediss:// (TLS, used by Upstash)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

console.log(`[Redis] Connecting to ${redisUrl.replace(/:[^:@]+@/, ':***@')} ...`);

export const redis = new Redis(redisUrl, {
  // Common reconnect strategy
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('[Redis] Connection Error against URL:', redisUrl.replace(/:[^:@]+@/, ':***@'));
  console.error('[Redis] Error Object:', err);
});

redis.on('ready', () => {
  console.log('[Redis] Connected and ready.');
});

import { broadcastPluginData } from './websocket';

/**
 * Convenience method to write a JSON payload to Redis with an expiration.
 */
export async function setLiveSnapshot(source: string, payload: any, ttlSeconds: number) {
  const key = `data:${source}:live`;
  try {
    const jsonStr = JSON.stringify(payload);
    // Compress JSON strings to drastically reduce Upstash payload size (bypasses 10MB limits)
    const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));
    await redis.set(key, compressed as any, 'EX', ttlSeconds);
    // Also save a metadata key so healthcheck can verify without pulling full payload
    await redis.set(`meta:${source}:last_run`, Date.now().toString(), 'EX', ttlSeconds * 2);
    
    // Broadcast newly updated entities to any active WebSocket subscribers
    broadcastPluginData(source, payload);

    console.log(`[Redis] Snapshot saved for ${source} (${(compressed.length / 1024).toFixed(2)} KB)`);
  } catch (error) {
    console.error(`[Redis] Failed to snapshot ${source}:`, error);
  }
}

/**
 * Convenience method to read a JSON payload from Redis.
 */
export async function getLiveSnapshot(source: string) {
  const key = `data:${source}:live`;
  try {
    // We must use getBuffer natively in ioredis to prevent it from coercing raw bytes to a utf8 string
    const data = await redis.getBuffer(key);
    if (!data) return null;
    
    try {
      const decompressed = zlib.unzipSync(data);
      return JSON.parse(decompressed.toString('utf-8'));
    } catch {
      // Fallback if data was stored as plain string before compression was introduced
      return JSON.parse(data.toString('utf-8'));
    }
  } catch (error) {
    console.error(`[Redis] Failed to get live snapshot ${source}:`, error);
    return null;
  }
}
