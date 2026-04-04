import { Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { AuthenticatedRequest } from '../types';
import { logger } from '../config/logger';

interface RateLimitConfig {
  /** Максимум запросов за windowSec */
  maxRequests: number;
  /** Окно в секундах */
  windowSec: number;
  /** Префикс ключа в Redis */
  keyPrefix: string;
}

/**
 * Фабрика rate-limit middleware через Redis (скользящее окно).
 */
function createRateLimiter(config: RateLimitConfig) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // Если пользователь не авторизован — пропускаем (auth middleware отклонит позже)
    if (!req.user) {
      next();
      return;
    }

    const userId = req.user.id;
    const key = `${config.keyPrefix}:${userId}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      // Инкрементируем счётчик
      const count = await redis.incr(key);

      if (count === 1) {
        // Первый запрос в окне — устанавливаем TTL
        await redis.expire(key, config.windowSec);
      }

      // Получаем оставшееся время
      const ttl = await redis.ttl(key);

      // Устанавливаем заголовки
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count));
      res.setHeader('X-RateLimit-Reset', now + Math.max(0, ttl));

      if (count > config.maxRequests) {
        res.setHeader('Retry-After', Math.max(1, ttl));
        logger.warn('Rate limit превышен', {
          userId,
          keyPrefix: config.keyPrefix,
          count,
          maxRequests: config.maxRequests,
        });
        res.status(429).json({
          success: false,
          error: `Превышен лимит запросов. Попробуйте через ${ttl} сек.`,
        });
        return;
      }

      next();
    } catch (err) {
      // Если Redis недоступен — пропускаем (не блокируем пользователя)
      logger.error('Ошибка rate limiter', { error: (err as Error).message });
      next();
    }
  };
}

/**
 * Rate limiter для генерации: максимум 10 запросов в минуту.
 */
export const generateRateLimit = createRateLimiter({
  maxRequests: 10,
  windowSec: 60,
  keyPrefix: 'rl:gen',
});

/**
 * Общий rate limiter API: максимум 100 запросов в минуту.
 */
export const apiRateLimit = createRateLimiter({
  maxRequests: 100,
  windowSec: 60,
  keyPrefix: 'rl:api',
});
