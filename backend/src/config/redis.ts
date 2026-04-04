import Redis from 'ioredis';
import { logger } from './logger';

/**
 * Подключение к Redis / Valkey.
 * Строка подключения из переменной окружения REDIS_URL.
 */
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
});

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
