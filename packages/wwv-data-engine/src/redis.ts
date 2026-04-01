import Redis from 'ioredis';
import 'dotenv/config';

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
  console.error('[Redis] Connection Error:', err.message);
});

redis.on('ready', () => {
  console.log('[Redis] Connected and ready.');
});

/**
 * Convenience method to write a JSON payload to Redis with an expiration.
 */
export async function setLiveSnapshot(source: string, payload: any, ttlSeconds: number) {
  const key = `data:${source}:live`;
  try {
    await redis.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
    // Also save a metadata key so healthcheck can verify without pulling full payload
    await redis.set(`meta:${source}:last_run`, Date.now().toString(), 'EX', ttlSeconds * 2);
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
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[Redis] Failed to get live snapshot ${source}:`, error);
    return null;
  }
}
