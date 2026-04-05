import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authMiddleware } from '../middleware/auth';
import { query } from '../config/db';
import { logger } from '../config/logger';

const router = Router();

// Все роуты требуют авторизации
router.use(authMiddleware as any);

/**
 * GET /api/tasks — история задач пользователя (пагинация).
 */
router.get('/', async (req: Request, res: Response) => {
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
router.get('/:taskId', async (req: Request, res: Response) => {
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
