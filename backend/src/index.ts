import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './config/logger';
import { bot, setupBotWebhook } from './bot';
import generateRouter from './routes/generate';
import webhookRouter from './routes/webhook';
import paymentsRouter from './routes/payments';
import referralsRouter from './routes/referrals';
import promoRouter from './routes/promo';
import userRouter from './routes/user';
import tasksRouter from './routes/tasks';
import { apiRateLimit, generateRateLimit } from './middleware/rateLimit';
import { startPolling } from './services/queue';
import { checkConnection as checkDb, pool } from './config/db';
import { checkRedisConnection } from './config/redis';
import fs from 'fs';
import path from 'path';

const startedAt = Date.now();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || '';

// ── Middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Логирование запросов ────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP запрос', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });
  next();
});

// ── Healthcheck ─────────────────────────────────────
app.get('/health', async (_req, res) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  try {
    await checkDb();
  } catch {
    dbStatus = 'error';
  }

  try {
    await checkRedisConnection();
  } catch {
    redisStatus = 'error';
  }

  const mem = process.memoryUsage();
  const status = dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded';

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    db: dbStatus,
    redis: redisStatus,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ── Telegram Bot webhook ────────────────────────────
app.use('/webhook/telegram', bot.webhookCallback('/webhook/telegram'));

// ── PoYo webhook ────────────────────────────────────
app.use('/webhook', webhookRouter);

// ── API роуты ───────────────────────────────────────
app.use('/api/generate', apiRateLimit as any, generateRateLimit as any, generateRouter);
app.use('/api/tasks', apiRateLimit as any, tasksRouter);
app.use('/api/payments', apiRateLimit as any, paymentsRouter);
app.use('/api/referrals', apiRateLimit as any, referralsRouter);
app.use('/api/promo', apiRateLimit as any, promoRouter);
app.use('/api/user', apiRateLimit as any, userRouter);

// ── Автоматические миграции при старте ──────────────
async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const applied = await client.query<{ filename: string }>('SELECT filename FROM _migrations');
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.info('Папка миграций не найдена, пропуск');
      return;
    }

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (appliedSet.has(file)) continue;
      logger.info(`Применяю миграцию: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      logger.info(`Миграция применена: ${file}`);
    }
  } finally {
    client.release();
  }
}

// ── Запуск сервера ──────────────────────────────────
app.listen(PORT, async () => {
  logger.info(`Сервер запущен на порту ${PORT}`, { port: PORT });

  // Запускаем миграции
  try {
    await runMigrations();
    logger.info('Миграции выполнены');
  } catch (err) {
    logger.error('Ошибка миграций', { error: (err as Error).message });
  }

  // Устанавливаем webhook, если задан базовый URL
  if (WEBHOOK_BASE_URL) {
    await setupBotWebhook(WEBHOOK_BASE_URL);
  } else {
    logger.warn('WEBHOOK_BASE_URL не задан — webhook бота не установлен. Используйте ngrok для локальной разработки.');
  }

  // Запускаем fallback polling для незавершённых задач
  startPolling();
});

export default app;
