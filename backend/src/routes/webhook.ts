import { Router, Request, Response } from 'express';
import { handleTaskResult } from '../services/queue';
import { logger } from '../config/logger';

const router = Router();

/**
 * POST /webhook/poyo — принимает callback от PoYo API.
 * Формат: { task_id, status, files?, error? }
 */
router.post('/poyo', async (req: Request, res: Response) => {
  try {
    // Логируем полное тело webhook для отладки
    logger.info('Webhook от PoYo: сырые данные', {
      body: JSON.stringify(req.body).slice(0, 1000),
    });

    // Поддержка разных форматов: плоский или вложенный в data
    const payload = req.body.data || req.body;
    const task_id = payload.task_id || payload.id;
    const status = payload.status;
    const files = payload.files || payload.output?.files;
    const error = payload.error || payload.message;

    if (!task_id || !status) {
      logger.warn('Webhook: отсутствует task_id или status', { body: JSON.stringify(req.body).slice(0, 500) });
      res.status(400).json({ success: false, error: 'Отсутствует task_id или status' });
      return;
    }

    logger.info('Webhook от PoYo', { task_id, status, hasFiles: !!files });

    if (status === 'finished' || status === 'failed') {
      await handleTaskResult(
        task_id,
        status as 'finished' | 'failed',
        files,
        error
      );
    }

    // Всегда отвечаем 200, чтобы PoYo не ретраил
    res.json({ success: true });
  } catch (err) {
    logger.error('Ошибка webhook PoYo', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Внутренняя ошибка' });
  }
});

export default router;
