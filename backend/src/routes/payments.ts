import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authMiddleware } from '../middleware/auth';
import { getPackage } from '../config/packages';
import { bot } from '../bot';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware as any);

/**
 * POST /api/payments/create-invoice — создаёт Telegram Stars invoice.
 * Body: { package_id: string }
 * Возвращает: { invoice_url: string }
 */
router.post('/create-invoice', async (req: Request, res: Response) => {
  try {
    const { package_id } = req.body as { package_id: string };

    const pkg = getPackage(package_id);
    if (!pkg) {
      res.status(400).json({ success: false, error: `Пакет "${package_id}" не найден` });
      return;
    }

    const user = (req as AuthenticatedRequest).user;

    // Формируем payload для идентификации платежа
    const payload = JSON.stringify({
      package_id: pkg.id,
      user_id: user.id,
      credits: pkg.credits,
    });

    // Создаём invoice через Bot API
    const invoiceLink = await bot.telegram.createInvoiceLink({
      title: `${pkg.name} — ${pkg.credits} кредитов`,
      description: `Пополнение баланса на ${pkg.credits} кредитов для AI-генерации`,
      payload,
      provider_token: '', // пустой для Telegram Stars (XTR)
      currency: 'XTR',
      prices: [
        { label: `${pkg.credits} кредитов`, amount: pkg.priceStars },
      ],
    });

    logger.info('Invoice создан', {
      userId: user.id,
      packageId: pkg.id,
      priceStars: pkg.priceStars,
    });

    res.json({
      success: true,
      data: { invoice_url: invoiceLink },
    });
  } catch (err) {
    logger.error('Ошибка создания invoice', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Ошибка создания платежа' });
  }
});

export default router;
