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
    const { task_id, status, files, error } = req.body as {
      task_id: string;
      status: string;
      files?: { file_url: string; file_type: string }[];
      error?: string;
    };

    if (!task_id || !status) {
      res.status(400).json({ success: false, error: 'Отсутствует task_id или status' });
      return;
    }

    logger.info('Webhook от PoYo', { task_id, status });

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
