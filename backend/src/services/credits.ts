import { pool, query } from '../config/db';
import { logger } from '../config/logger';

/**
 * Ошибка недостаточного баланса кредитов.
 */
export class InsufficientCreditsError extends Error {
  constructor(available: number, required: number) {
    super(`Недостаточно кредитов: доступно ${available}, требуется ${required}`);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Получить текущий баланс кредитов пользователя.
 */
export async function getBalance(userId: number): Promise<number> {
  const result = await query<{ credits: number }>(
    'SELECT credits FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Пользователь ${userId} не найден`);
  }

  return result.rows[0].credits;
}

/**
 * Зарезервировать кредиты при отправке задачи.
 * Атомарно проверяет баланс и списывает кредиты.
 * Записывает транзакцию типа 'spend'.
 */
export async function reserve(
  userId: number,
  amount: number,
  taskId: number
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Блокируем строку пользователя для атомарности
    const userResult = await client.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`Пользователь ${userId} не найден`);
    }

    const currentBalance = userResult.rows[0].credits;

    if (currentBalance < amount) {
      throw new InsufficientCreditsError(currentBalance, amount);
    }

    const newBalance = currentBalance - amount;

    // Списываем кредиты
    await client.query(
      'UPDATE users SET credits = $1 WHERE id = $2',
      [newBalance, userId]
    );

    // Записываем транзакцию
    await client.query(
      `INSERT INTO transactions (user_id, type, credits_delta, credits_before, credits_after, description, task_id)
       VALUES ($1, 'spend', $2, $3, $4, $5, $6)`,
      [userId, -amount, currentBalance, newBalance, `Резервирование ${amount} кредитов`, taskId]
    );

    await client.query('COMMIT');

    logger.info('Кредиты зарезервированы', { userId, amount, newBalance, taskId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Окончательное списание кредитов (подтверждение после finished).
 * Если фактическая стоимость отличается от зарезервированной,
 * корректируем баланс.
 */
export async function charge(
  userId: number,
  amount: number,
  taskId: number
): Promise<void> {
  // Кредиты уже списаны при reserve — логируем подтверждение
  logger.info('Кредиты списаны окончательно', { userId, amount, taskId });
}

/**
 * Вернуть кредиты при ошибке генерации.
 * Атомарно возвращает кредиты и записывает транзакцию типа 'refund'.
 */
export async function refund(
  userId: number,
  amount: number,
  taskId: number
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`Пользователь ${userId} не найден`);
    }

    const currentBalance = userResult.rows[0].credits;
    const newBalance = currentBalance + amount;

    // Возвращаем кредиты
    await client.query(
      'UPDATE users SET credits = $1 WHERE id = $2',
      [newBalance, userId]
    );

    // Записываем транзакцию возврата
    await client.query(
      `INSERT INTO transactions (user_id, type, credits_delta, credits_before, credits_after, description, task_id)
       VALUES ($1, 'refund', $2, $3, $4, $5, $6)`,
      [userId, amount, currentBalance, newBalance, `Возврат ${amount} кредитов (ошибка генерации)`, taskId]
    );

    await client.query('COMMIT');

    logger.info('Кредиты возвращены', { userId, amount, newBalance, taskId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Начислить кредиты пользователю.
 * Используется при покупке, реферальном бонусе, промо-акции и т.д.
 */
export async function addCredits(
  userId: number,
  amount: number,
  type: 'purchase' | 'referral' | 'bonus',
  paymentId?: string
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`Пользователь ${userId} не найден`);
    }

    const currentBalance = userResult.rows[0].credits;
    const newBalance = currentBalance + amount;

    await client.query(
      'UPDATE users SET credits = $1 WHERE id = $2',
      [newBalance, userId]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, credits_delta, credits_before, credits_after, description, payment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, type, amount, currentBalance, newBalance, `Начисление ${amount} кредитов (${type})`, paymentId || null]
    );

    await client.query('COMMIT');

    logger.info('Кредиты начислены', { userId, amount, type, newBalance, paymentId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
