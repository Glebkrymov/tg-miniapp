import Redis from 'ioredis';
import { logger } from './logger';

/**
 * Подключение к Redis / Valkey.
 * Поддержка TLS через rediss:// URL (YC Managed Valkey порт 6380).
 */
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let redis: Redis;

if (redisUrl.startsWith('rediss://')) {
  // Парсим URL вручную для корректной настройки TLS
  const url = new URL(redisUrl);
  redis = new Redis({
    host: url.hostname,
    port: parseInt(url.port || '6380', 10),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: parseInt(url.pathname.slice(1) || '0', 10),
    tls: { rejectUnauthorized: false },
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  });
} else {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  });
}

redis.on('connect', () => {
  logger.info('Redis подключён');
});

redis.on('error', (err) => {
  logger.error('Ошибка Redis', { error: err.message });
});

/**
 * Проверить подключение к Redis.
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export { redis };
