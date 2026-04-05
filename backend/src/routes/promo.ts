import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authMiddleware } from '../middleware/auth';
import { activatePromoCode, getUserPromos, PromoError } from '../services/promo';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware as any);

/**
 * POST /api/promo/activate — активировать промокод.
 * Body: { code: string }
 */
router.post('/activate', async (req: Request, res: Response) => {
  try {
    const { code } = req.body as { code: string };
    const user = (req as AuthenticatedRequest).user;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Введите промокод' });
      return;
    }

    const result = await activatePromoCode(user.id, code);

    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof PromoError) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    logger.error('Ошибка активации промокода', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Ошибка активации промокода' });
  }
});

/**
 * GET /api/promo/my — мои активные промо-бонусы.
 */
router.get('/my', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const promos = await getUserPromos(user.id);
    res.json({ success: true, data: promos });
  } catch (err) {
    logger.error('Ошибка получения промо', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Ошибка получения данных' });
  }
});

export default router;
