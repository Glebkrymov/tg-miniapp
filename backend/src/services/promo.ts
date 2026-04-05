import { pool, query } from '../config/db';
import { logger } from '../config/logger';
import { addCredits } from './credits';

export interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  type: 'credits' | 'free_generation';
  credits_amount: number;
  allowed_category: string;
  allowed_models: string;
  free_generations: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
}

export interface PromoActivation {
  id: number;
  user_id: number;
  promo_code_id: number;
  remaining_generations: number;
  activated_at: string;
}

export interface ActivateResult {
  type: 'credits' | 'free_generation';
  credits_added?: number;
  free_generations?: number;
  allowed_category?: string;
  description?: string;
}

/**
 * Активировать промокод для пользователя.
 */
export async function activatePromoCode(
  userId: number,
  code: string
): Promise<ActivateResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Находим промокод
    const promoResult = await client.query<PromoCode>(
      'SELECT * FROM promo_codes WHERE code = $1 FOR UPDATE',
      [code.toUpperCase().trim()]
    );

    if (promoResult.rows.length === 0) {
      throw new PromoError('Промокод не найден');
    }

    const promo = promoResult.rows[0];

    // Проверки
    if (!promo.is_active) {
      throw new PromoError('Промокод неактивен');
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      throw new PromoError('Срок действия промокода истёк');
    }

    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
      throw new PromoError('Промокод больше не доступен');
    }

    // Проверяем, не активировал ли уже
    const existingActivation = await client.query(
      'SELECT id FROM promo_activations WHERE user_id = $1 AND promo_code_id = $2',
      [userId, promo.id]
    );

    if (existingActivation.rows.length > 0) {
      throw new PromoError('Вы уже использовали этот промокод');
    }

    // Активируем
    if (promo.type === 'credits') {
      // Начисляем кредиты
      await addCredits(userId, promo.credits_amount, 'bonus', `promo:${promo.code}`);

      await client.query(
        `INSERT INTO promo_activations (user_id, promo_code_id, remaining_generations) VALUES ($1, $2, 0)`,
        [userId, promo.id]
      );
    } else {
      // free_generation — сохраняем количество оставшихся генераций
      await client.query(
        `INSERT INTO promo_activations (user_id, promo_code_id, remaining_generations) VALUES ($1, $2, $3)`,
        [userId, promo.id, promo.free_generations]
      );
    }

    // Увеличиваем счётчик использований
    await client.query(
      'UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1',
      [promo.id]
    );

    await client.query('COMMIT');

    logger.info('Промокод активирован', {
      userId,
      code: promo.code,
      type: promo.type,
      credits: promo.credits_amount,
      freeGens: promo.free_generations,
    });

    if (promo.type === 'credits') {
      return {
        type: 'credits',
        credits_added: promo.credits_amount,
        description: promo.description || undefined,
      };
    }

    return {
      type: 'free_generation',
      free_generations: promo.free_generations,
      allowed_category: promo.allowed_category,
      description: promo.description || undefined,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Проверяет, есть ли у пользователя бесплатная генерация для данной модели.
 * Если есть — списывает одну и возвращает true.
 */
export async function tryUseFreeGeneration(
  userId: number,
  modelId: string,
  category: string
): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Ищем активные промо-активации с оставшимися бесплатными генерациями
    const activations = await client.query<PromoActivation & { allowed_category: string; allowed_models: string }>(
      `SELECT pa.*, pc.allowed_category, pc.allowed_models
       FROM promo_activations pa
       JOIN promo_codes pc ON pc.id = pa.promo_code_id
       WHERE pa.user_id = $1
         AND pa.remaining_generations > 0
         AND pc.type = 'free_generation'
       ORDER BY pa.activated_at ASC
       FOR UPDATE OF pa`,
      [userId]
    );

    for (const activation of activations.rows) {
      // Проверяем категорию
      if (activation.allowed_category !== 'any' && activation.allowed_category !== category) {
        continue;
      }

      // Проверяем конкретные модели
      if (activation.allowed_models) {
        const allowedList = activation.allowed_models.split(',').map((s) => s.trim());
        if (!allowedList.includes(modelId)) {
          continue;
        }
      }

      // Подходит — списываем одну бесплатную генерацию
      await client.query(
        'UPDATE promo_activations SET remaining_generations = remaining_generations - 1 WHERE id = $1',
        [activation.id]
      );

      await client.query('COMMIT');

      logger.info('Бесплатная генерация по промокоду использована', {
        userId,
        modelId,
        activationId: activation.id,
        remaining: activation.remaining_generations - 1,
      });

      return true;
    }

    await client.query('COMMIT');
    return false;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Получить активные промо-бонусы пользователя.
 */
export async function getUserPromos(userId: number): Promise<{
  free_generations: { category: string; remaining: number; description: string | null }[];
}> {
  const result = await query<{
    remaining_generations: number;
    allowed_category: string;
    description: string | null;
  }>(
    `SELECT pa.remaining_generations, pc.allowed_category, pc.description
     FROM promo_activations pa
     JOIN promo_codes pc ON pc.id = pa.promo_code_id
     WHERE pa.user_id = $1
       AND pa.remaining_generations > 0
       AND pc.type = 'free_generation'`,
    [userId]
  );

  return {
    free_generations: result.rows.map((r) => ({
      category: r.allowed_category,
      remaining: r.remaining_generations,
      description: r.description,
    })),
  };
}

/**
 * Ошибка промокода.
 */
export class PromoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromoError';
  }
}
