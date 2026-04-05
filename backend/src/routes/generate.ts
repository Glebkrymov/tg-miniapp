import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authMiddleware } from '../middleware/auth';
import { getModel } from '../config/models';
import { query } from '../config/db';
import { poyoClient } from '../services/poyo';
import * as credits from '../services/credits';
import { enqueueTask } from '../services/queue';
import { tryUseFreeGeneration } from '../services/promo';
import { logger } from '../config/logger';

const router = Router();

const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || '';

// Все роуты требуют авторизации
router.use(authMiddleware as any); // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * POST /api/generate — запуск генерации.
 * Body: { model: string, prompt: string, params?: object }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { model: modelId, prompt, params = {} } = req.body as {
      model: string;
      prompt: string;
      params?: Record<string, unknown>;
    };

    // 1. Валидация модели
    const model = getModel(modelId);
    if (!model) {
      res.status(400).json({ success: false, error: `Модель "${modelId}" не найдена` });
      return;
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Промпт не может быть пустым' });
      return;
    }

    const user = (req as AuthenticatedRequest).user;
    const creditsCost = model.credits;

    // 2. Проверяем баланс (reserve атомарно проверит и спишет)
    // Но сначала создадим запись в tasks, чтобы получить taskId

    // 3. Создаём запись в tasks со статусом pending
    const taskResult = await query<{ id: number }>(
      `INSERT INTO tasks (poyo_task_id, user_id, model_id, category, prompt, params, status, credits_cost)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id`,
      [
        'pending_' + Date.now(), // временный poyo_task_id, обновим после отправки
        user.id,
        modelId,
        model.category,
        prompt.trim(),
        JSON.stringify(params),
        creditsCost,
      ]
    );

    const taskId = taskResult.rows[0].id;

    // 4. Проверяем бесплатную генерацию по промокоду
    let isFreeGeneration = false;
    try {
      isFreeGeneration = await tryUseFreeGeneration(user.id, modelId, model.category);
    } catch {
      // Ошибка промо — не критично, продолжаем с обычной оплатой
    }

    // 5. Резервируем кредиты (если не бесплатная генерация)
    if (!isFreeGeneration) {
      try {
        await credits.reserve(user.id, creditsCost, taskId);
      } catch (err) {
        // Удаляем задачу при недостаточном балансе
        await query('DELETE FROM tasks WHERE id = $1', [taskId]);

        if (err instanceof credits.InsufficientCreditsError) {
          res.status(402).json({ success: false, error: err.message });
          return;
        }
        throw err;
      }
    } else {
      // Обновляем стоимость на 0 для бесплатной генерации
      await query('UPDATE tasks SET credits_cost = 0 WHERE id = $1', [taskId]);
    }

    // 5. Отправляем в PoYo API
    const callbackUrl = `${WEBHOOK_BASE_URL}/webhook/poyo`;
    let poyoTaskId: string;

    try {
      poyoTaskId = await poyoClient.submitTask(modelId, { prompt, ...params }, callbackUrl);
    } catch (err) {
      // Возвращаем кредиты при ошибке отправки (если не бесплатная генерация)
      if (!isFreeGeneration) {
        await credits.refund(user.id, creditsCost, taskId);
      }
      await query(
        "UPDATE tasks SET status = 'failed', error_message = $1 WHERE id = $2",
        [(err as Error).message, taskId]
      );
      res.status(502).json({ success: false, error: 'Ошибка отправки в PoYo API' });
      return;
    }

    // 6. Обновляем poyo_task_id в задаче
    await query(
      'UPDATE tasks SET poyo_task_id = $1 WHERE id = $2',
      [poyoTaskId, taskId]
    );

    // 8. Сохраняем в Redis для обработки webhook
    await enqueueTask(poyoTaskId, {
      userId: user.id,
      taskId,
      model: modelId,
      creditsReserved: isFreeGeneration ? 0 : creditsCost,
      telegramId: user.telegram_id,
      category: model.category,
      createdAt: Date.now(),
    });

    logger.info('Генерация запущена', {
      taskId,
      poyoTaskId,
      modelId,
      userId: user.id,
      creditsCost,
    });

    res.json({
      success: true,
      data: {
        task_id: taskId,
        poyo_task_id: poyoTaskId,
        status: 'pending',
        credits_reserved: creditsCost,
      },
    });
  } catch (err) {
    logger.error('Ошибка POST /api/generate', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/tasks — история задач пользователя (пагинация).
 */
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const result = await query(
      `SELECT id, model_id, category, prompt, status, result_url, credits_cost,
              error_message, created_at, completed_at
       FROM tasks
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1',
      [user.id]
    );

    res.json({
      success: true,
      data: {
        tasks: result.rows,
        total: parseInt(countResult.rows[0].count, 10),
        limit,
        offset,
      },
    });
  } catch (err) {
    logger.error('Ошибка GET /api/tasks', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/tasks/:taskId — статус конкретной задачи.
 */
router.get('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const taskId = parseInt(req.params.taskId as string, 10);

    if (isNaN(taskId)) {
      res.status(400).json({ success: false, error: 'Невалидный task_id' });
      return;
    }

    const result = await query(
      `SELECT id, poyo_task_id, model_id, category, prompt, params, status,
              result_url, credits_cost, error_message, created_at, completed_at
       FROM tasks
       WHERE id = $1 AND user_id = $2`,
      [taskId, user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Задача не найдена' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Ошибка GET /api/tasks/:taskId', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

export default router;
