/**
 * Тесты для валидации initData (src/middleware/auth.ts).
 * Тестируем функцию validateInitData через authMiddleware.
 */
import crypto from 'crypto';

// Мокаем модули
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Устанавливаем тестовый BOT_TOKEN до импорта auth
const TEST_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
process.env.BOT_TOKEN = TEST_BOT_TOKEN;

import { authMiddleware } from '../middleware/auth';
import { query } from '../config/db';

const mockQuery = query as jest.Mock;

// ── Утилиты ────────────────────────────────────────

/**
 * Генерирует валидный initData с HMAC-SHA256 подписью.
 */
function createValidInitData(
  user: object,
  authDate?: number
): string {
  const params = new URLSearchParams();
  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(authDate || Math.floor(Date.now() / 1000)));

  // Формируем data-check-string
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // HMAC-SHA256 подпись
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(TEST_BOT_TOKEN)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  params.set('hash', hash);
  return params.toString();
}

/**
 * Создаёт mock Request/Response объекты.
 */
function createMocks(authHeader?: string) {
  const req: any = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

// ── Тесты ──────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authMiddleware', () => {
  it('возвращает 401 без заголовка Authorization', () => {
    const { req, res, next } = createMocks();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Отсутствует авторизация' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('возвращает 401 для невалидного токена', () => {
    const { req, res, next } = createMocks('Bearer invalid_data_here');

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('возвращает 401 для устаревшей initData (>24ч)', () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 25 * 60 * 60; // 25 часов назад
    const initData = createValidInitData(
      { id: 12345, username: 'test', first_name: 'Test' },
      oldAuthDate
    );
    const { req, res, next } = createMocks(`Bearer ${initData}`);

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('авторизует существующего пользователя с валидной initData', async () => {
    const user = { id: 12345, username: 'testuser', first_name: 'Test' };
    const initData = createValidInitData(user);
    const { req, res, next } = createMocks(`Bearer ${initData}`);

    const dbUser = {
      id: 1,
      telegram_id: 12345,
      username: 'testuser',
      first_name: 'Test',
      credits: 20,
      referral_code: 'abc123',
    };

    // SELECT — находим существующего пользователя
    mockQuery
      .mockResolvedValueOnce({ rows: [dbUser] }) // SELECT существующий
      .mockResolvedValueOnce({}); // UPDATE last_active_at

    authMiddleware(req, res, next);

    // Ждём async обработки
    await new Promise(process.nextTick);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(dbUser);
  });

  it('создаёт нового пользователя при первом входе', async () => {
    const user = { id: 99999, username: 'newuser', first_name: 'New' };
    const initData = createValidInitData(user);
    const { req, res, next } = createMocks(`Bearer ${initData}`);

    const newDbUser = {
      id: 42,
      telegram_id: 99999,
      username: 'newuser',
      first_name: 'New',
      credits: 20,
      referral_code: 'xyz789',
    };

    // SELECT — не находим
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT — нет пользователя
      .mockResolvedValueOnce({ rows: [newDbUser] }); // INSERT RETURNING *

    authMiddleware(req, res, next);

    await new Promise(process.nextTick);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(newDbUser);
  });
});
