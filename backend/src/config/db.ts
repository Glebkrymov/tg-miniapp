import { Pool } from 'pg';
import { logger } from './logger';

/**
 * Пул подключений к PostgreSQL.
 * Строка подключения берётся из переменной окружения DATABASE_URL.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // максимум соединений в пуле
  idleTimeoutMillis: 30_000,  // закрывать неактивные через 30с
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false,
});

// Логируем ошибки пула
pool.on('error', (err) => {
  logger.error('Ошибка PostgreSQL пула', { error: err.message });
});

/**
 * Выполнить SQL-запрос.
 * Обёртка над pool.query с логированием ошибок.
 */
export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params?: unknown[]
) {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug('SQL запрос', { text: text.slice(0, 80), duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('Ошибка SQL запроса', { text: text.slice(0, 80), error: (err as Error).message });
    throw err;
  }
}

/**
 * Проверить подключение к БД.
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
