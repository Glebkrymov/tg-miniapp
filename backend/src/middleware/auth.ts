import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../config/db';
import { logger } from '../config/logger';
import { AuthenticatedRequest, AppUser } from '../types';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 часа

/**
 * Генерирует случайный реферальный код (8 символов, буквы + цифры).
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Валидация Telegram initData через HMAC-SHA256.
 * Алгоритм: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateInitData(initData: string): Record<string, string> | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    // Удаляем hash из параметров для проверки
    params.delete('hash');

    // Сортируем параметры по ключу и формируем data-check-string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // HMAC-SHA256: secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return null;
    }

    // Проверяем auth_date — не старше 24 часов
    const authDate = params.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate, 10) * 1000;
      if (Date.now() - authTimestamp > MAX_AGE_MS) {
        return null;
      }
    }

    // Преобразуем в обычный объект
    const result: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    result['hash'] = hash;
    return result;
  } catch {
    return null;
  }
}

/**
 * Upsert пользователя в БД.
 * Если пользователь с telegram_id уже есть — обновляем last_active_at.
 * Если нет — создаём с referral_code.
 * Возвращает { user, isNew }.
 */
async function upsertUser(
  telegramId: number,
  username: string | null,
  firstName: string | null,
  languageCode: string
): Promise<{ user: AppUser; isNew: boolean }> {
  // Пробуем найти существующего пользователя
  const existing = await query<AppUser>(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId]
  );

  if (existing.rows.length > 0) {
    // Обновляем last_active_at и данные профиля
    await query(
      `UPDATE users SET last_active_at = NOW(), username = $2, first_name = $3
       WHERE telegram_id = $1`,
      [telegramId, username, firstName]
    );
    return { user: existing.rows[0], isNew: false };
  }

  // Создаём нового пользователя с уникальным referral_code
  let referralCode = generateReferralCode();
  let attempts = 0;

  while (attempts < 10) {
    try {
      const result = await query<AppUser>(
        `INSERT INTO users (telegram_id, username, first_name, language_code, referral_code)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [telegramId, username, firstName, languageCode, referralCode]
      );
      return { user: result.rows[0], isNew: true };
    } catch (err: unknown) {
      // Коллизия referral_code — генерируем новый
      const pgErr = err as { code?: string };
      if (pgErr.code === '23505') {
        referralCode = generateReferralCode();
        attempts++;
        continue;
      }
      throw err;
    }
  }

  throw new Error('Не удалось сгенерировать уникальный referral_code');
}

/**
 * Обработка реферальной регистрации.
 * Находит реферера по коду, создаёт запись в referrals.
 * Бонусы начисляются отдельно через сервис кредитов (задача 2.2).
 */
async function handleReferral(newUserId: number, refCode: string): Promise<void> {
  try {
    // Находим реферера по коду
    const referrer = await query<AppUser>(
      'SELECT * FROM users WHERE referral_code = $1',
      [refCode]
    );

    if (referrer.rows.length === 0) {
      logger.warn('Реферальный код не найден', { refCode });
      return;
    }

    const referrerId = referrer.rows[0].id;

    // Нельзя быть рефералом самого себя
    if (referrerId === newUserId) {
      return;
    }

    // Создаём запись в referrals (UNIQUE на referred_id предотвращает дубликаты)
    await query(
      `INSERT INTO referrals (referrer_id, referred_id)
       VALUES ($1, $2)
       ON CONFLICT (referred_id) DO NOTHING`,
      [referrerId, newUserId]
    );

    logger.info('Реферальная регистрация', { referrerId, referredId: newUserId, refCode });
  } catch (err) {
    logger.error('Ошибка обработки реферала', { error: (err as Error).message, refCode });
  }
}

/**
 * Express middleware — авторизация через Telegram initData.
 *
 * Извлекает initData из заголовка Authorization: Bearer <initData>,
 * валидирует подпись HMAC-SHA256, upsert пользователя в БД,
 * прикрепляет user к req.user.
 *
 * При невалидной или устаревшей initData возвращает 401.
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Отсутствует авторизация' });
    return;
  }

  const initData = authHeader.slice(7); // убираем "Bearer "

  const validated = validateInitData(initData);
  if (!validated) {
    res.status(401).json({ success: false, error: 'Невалидная или устаревшая initData' });
    return;
  }

  // Извлекаем данные пользователя из initData
  let telegramUser: { id: number; username?: string; first_name?: string; language_code?: string };

  try {
    telegramUser = JSON.parse(validated['user'] || '{}');
  } catch {
    res.status(401).json({ success: false, error: 'Невалидные данные пользователя' });
    return;
  }

  if (!telegramUser.id) {
    res.status(401).json({ success: false, error: 'Отсутствует telegram_id' });
    return;
  }

  // Извлекаем реферальный код из start_param (если есть)
  const refCode = validated['start_param'] || undefined;

  // Upsert пользователя и продолжаем
  upsertUser(
    telegramUser.id,
    telegramUser.username || null,
    telegramUser.first_name || null,
    telegramUser.language_code || 'ru'
  )
    .then(async ({ user, isNew }) => {
      // Если новый пользователь и есть реферальный код — обрабатываем
      if (isNew && refCode) {
        await handleReferral(user.id, refCode);
      }

      req.user = user;
      req.refCode = refCode;
      next();
    })
    .catch((err: Error) => {
      logger.error('Ошибка авторизации', { error: err.message });
      res.status(500).json({ success: false, error: 'Ошибка сервера при авторизации' });
    });
}
