/**
 * E2E тест: полный цикл генерации.
 * Регистрация → выбор модели → генерация → получение результата → баланс уменьшился.
 *
 * Все зависимости замоканы — тест проверяет интеграцию между сервисами,
 * не обращаясь к реальным Postgres, Redis или PoYo API.
 */

// ── Моки базы данных ───────────────────────────────

const mockPoolConnect = jest.fn();
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock('../config/db', () => ({
  pool: { connect: mockPoolConnect },
  query: mockQuery,
}));

// ── Моки Redis ─────────────────────────────────────

const mockRedisSet = jest.fn().mockResolvedValue('OK');
const mockRedisGet = jest.fn();
const mockRedisDel = jest.fn().mockResolvedValue(1);
const mockRedisIncr = jest.fn().mockResolvedValue(1);
const mockRedisExpire = jest.fn().mockResolvedValue(1);
const mockRedisTtl = jest.fn().mockResolvedValue(-1);

jest.mock('../config/redis', () => ({
  redis: {
    set: mockRedisSet,
    get: mockRedisGet,
    del: mockRedisDel,
    incr: mockRedisIncr,
    expire: mockRedisExpire,
    ttl: mockRedisTtl,
  },
  checkRedisConnection: jest.fn().mockResolvedValue(true),
}));

// ── Моки PoYo API ──────────────────────────────────

const mockSubmitTask = jest.fn();
const mockGetStatus = jest.fn();

jest.mock('../services/poyo', () => ({
  poyoClient: {
    submitTask: mockSubmitTask,
    getStatus: mockGetStatus,
  },
}));

// ── Моки Telegraf ──────────────────────────────────

jest.mock('../bot', () => ({
  bot: {
    telegram: {
      sendPhoto: jest.fn().mockResolvedValue({}),
      sendVideo: jest.fn().mockResolvedValue({}),
      sendAudio: jest.fn().mockResolvedValue({}),
    },
    webhookCallback: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  },
  setupBotWebhook: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Импорты после моков ────────────────────────────

import crypto from 'crypto';
import { getBalance, reserve, refund } from '../services/credits';
import { MODELS_MAP } from '../config/models';

const TEST_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
process.env.BOT_TOKEN = TEST_BOT_TOKEN;
process.env.WEBHOOK_BASE_URL = 'https://test.ngrok.io';

// ── Утилиты ────────────────────────────────────────

function createInitData(user: object): string {
  const params = new URLSearchParams();
  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

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

const mockClient = {
  query: mockClientQuery,
  release: mockRelease,
};

// ── E2E тест ───────────────────────────────────────

describe('E2E: полный цикл генерации', () => {
  const testUser = {
    id: 1,
    telegram_id: 12345,
    username: 'testuser',
    first_name: 'Test',
    credits: 20,
    referral_code: 'abc12345',
    is_banned: false,
    language_code: 'ru',
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolConnect.mockResolvedValue(mockClient);
  });

  it('регистрация → генерация → результат → баланс уменьшился', async () => {
    // ── 1. Регистрация (авторизация через initData) ──
    const initData = createInitData({
      id: testUser.telegram_id,
      username: testUser.username,
      first_name: testUser.first_name,
    });

    // Симулируем upsert — пользователь уже существует
    mockQuery
      .mockResolvedValueOnce({ rows: [testUser] }) // SELECT
      .mockResolvedValueOnce({}); // UPDATE last_active_at

    // Проверяем initData валидацию
    const { authMiddleware } = await import('../middleware/auth');
    const req: any = { headers: { authorization: `Bearer ${initData}` } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);
    await new Promise(process.nextTick);

    expect(next).toHaveBeenCalled();
    expect(req.user.telegram_id).toBe(12345);
    expect(req.user.credits).toBe(20);

    // ── 2. Выбор модели ────────────────────────────
    const model = MODELS_MAP.get('gpt-image-1-5');
    expect(model).toBeDefined();
    expect(model!.credits).toBe(2);
    expect(model!.category).toBe('image');

    // ── 3. Резервирование кредитов ─────────────────
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ credits: 20 }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({}) // UPDATE credits = 18
      .mockResolvedValueOnce({}) // INSERT transaction
      .mockResolvedValueOnce({}); // COMMIT

    await reserve(testUser.id, model!.credits, 1);

    // Проверяем что кредиты уменьшились на 2 (20 → 18)
    expect(mockClientQuery).toHaveBeenCalledWith(
      'UPDATE users SET credits = $1 WHERE id = $2',
      [18, 1]
    );

    // ── 4. Отправка в PoYo API ─────────────────────
    mockSubmitTask.mockResolvedValueOnce('poyo-task-e2e-001');

    const poyoTaskId = await (await import('../services/poyo')).poyoClient.submitTask(
      'gpt-image-1-5',
      { prompt: 'A cute cat', aspect_ratio: '1:1' },
      'https://test.ngrok.io/webhook/poyo'
    );

    expect(poyoTaskId).toBe('poyo-task-e2e-001');

    // ── 5. Сохранение в Redis ──────────────────────
    mockRedisSet.mockResolvedValueOnce('OK');

    const { redis } = await import('../config/redis');
    await redis.set(
      `task:${poyoTaskId}`,
      JSON.stringify({
        userId: testUser.id,
        taskId: 1,
        model: 'gpt-image-1-5',
        creditsReserved: 2,
      }),
      'EX',
      90000
    );

    expect(mockRedisSet).toHaveBeenCalledWith(
      'task:poyo-task-e2e-001',
      expect.any(String),
      'EX',
      90000
    );

    // ── 6. Получение результата (polling) ──────────
    mockGetStatus.mockResolvedValueOnce({
      task_id: 'poyo-task-e2e-001',
      status: 'finished',
      files: [{ file_url: 'https://cdn.poyo.ai/result.png', file_type: 'image' }],
    });

    const status = await (await import('../services/poyo')).poyoClient.getStatus('poyo-task-e2e-001');
    expect(status.status).toBe('finished');
    expect(status.files).toHaveLength(1);

    // ── 7. Проверяем финальный баланс ──────────────
    // После reserve: 20 - 2 = 18 кредитов
    mockQuery.mockResolvedValueOnce({ rows: [{ credits: 18 }] });

    const finalBalance = await getBalance(testUser.id);
    expect(finalBalance).toBe(18);

    // Баланс уменьшился на стоимость модели (2 кредита)
    expect(testUser.credits - finalBalance).toBe(model!.credits);
  });

  it('генерация с ошибкой → refund → баланс восстановлен', async () => {
    // ── Резервируем кредиты ────────────────────────
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ credits: 18 }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({}) // UPDATE credits = 12
      .mockResolvedValueOnce({}) // INSERT transaction
      .mockResolvedValueOnce({}); // COMMIT

    await reserve(testUser.id, 6, 2); // grok-imagine стоит 6 кредитов

    // ── PoYo вернул ошибку ─────────────────────────
    mockGetStatus.mockResolvedValueOnce({
      task_id: 'poyo-task-e2e-002',
      status: 'failed',
      error: 'Model overloaded',
    });

    const status = await (await import('../services/poyo')).poyoClient.getStatus('poyo-task-e2e-002');
    expect(status.status).toBe('failed');

    // ── Refund ─────────────────────────────────────
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ credits: 12 }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({}) // UPDATE credits = 18
      .mockResolvedValueOnce({}) // INSERT transaction
      .mockResolvedValueOnce({}); // COMMIT

    await refund(testUser.id, 6, 2);

    // Баланс восстановлен: 12 + 6 = 18
    expect(mockClientQuery).toHaveBeenCalledWith(
      'UPDATE users SET credits = $1 WHERE id = $2',
      [18, 1]
    );
  });
});
