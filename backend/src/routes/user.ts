import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authMiddleware } from '../middleware/auth';
import { query } from '../config/db';

const router = Router();

router.use(authMiddleware as any);

/**
 * GET /api/user/balance — текущий баланс пользователя.
 */
router.get('/balance', async (req: AuthenticatedRequest & any, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const result = await query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1',
      [user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Пользователь не найден' });
      return;
    }

    res.json({
      success: true,
      data: {
        credits: result.rows[0].credits,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка получения баланса' });
  }
});

export default router;
