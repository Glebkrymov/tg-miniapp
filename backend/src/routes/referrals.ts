import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authMiddleware } from '../middleware/auth';
import { query } from '../config/db';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware as any);

/**
 * GET /api/referrals — статистика рефералов пользователя.
 * Возвращает: количество рефералов, общее число генераций, потраченных кредитов.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;

    // Количество рефералов
    const referralsResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1',
      [user.id]
    );

    // Общее количество генераций пользователя
    const generationsResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1',
      [user.id]
    );

    // Сумма потраченных кредитов
    const spentResult = await query<{ total: string | null }>(
      `SELECT COALESCE(SUM(ABS(credits_delta)), 0) as total
       FROM transactions
       WHERE user_id = $1 AND type = 'spend'`,
      [user.id]
    );

    res.json({
      success: true,
      data: {
        total_referrals: parseInt(referralsResult.rows[0].count, 10),
        total_generations: parseInt(generationsResult.rows[0].count, 10),
        total_spent: parseInt(spentResult.rows[0].total || '0', 10),
        referral_code: user.referral_code,
      },
    });
  } catch (err) {
    logger.error('Ошибка GET /api/referrals', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

export default router;
