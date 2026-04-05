import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authMiddleware } from '../middleware/auth';
import { getPackage } from '../config/packages';
import { createPayment, verifyWebhookPayment } from '../services/yookassa';
import { addCredits } from '../services/credits';
import { query } from '../config/db';
import { logger } from '../config/logger';
import { alertPaymentSucceeded, alertPaymentCanceled } from '../services/alert';

const router = Router();

const WEBAPP_URL = process.env.WEBAPP_URL || '';

// ── Аутентифицированные роуты ──────────────────────

/**
 * POST /api/payments/create — создаёт платёж в YooKassa.
 * Body: { package_id: string }
 * Возвращает: { confirmation_url: string }
 */
router.post('/create', authMiddleware as any, async (req: Request, res: Response) => {
  try {
    const { package_id } = req.body as { package_id: string };

    const pkg = getPackage(package_id);
    if (!pkg) {
      res.status(400).json({ success: false, error: `Пакет "${package_id}" не найден` });
      return;
    }

    const user = (req as AuthenticatedRequest).user;

    const result = await createPayment({
      amount: pkg.priceRub,
      description: `${pkg.name} — ${pkg.credits} кредитов`,
      returnUrl: `${WEBAPP_URL}?payment=success`,
      metadata: {
        user_id: String(user.id),
        package_id: pkg.id,
        credits: String(pkg.credits),
      },
    });

    // Сохраняем платёж в БД
    await query(
      `INSERT INTO payments (user_id, yookassa_payment_id, package_id, credits, amount_rub, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [user.id, result.paymentId, pkg.id, pkg.credits, pkg.priceRub]
    );

    logger.info('YooKassa платёж создан', {
      userId: user.id,
      packageId: pkg.id,
      paymentId: result.paymentId,
      priceRub: pkg.priceRub,
    });

    res.json({
      success: true,
      data: { confirmation_url: result.confirmationUrl },
    });
  } catch (err) {
    logger.error('Ошибка создания платежа', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Ошибка создания платежа' });
  }
});

/**
 * GET /api/payments/status/:paymentId — проверка статуса платежа.
 * Фронтенд вызывает после возврата с YooKassa.
 */
router.get('/status/:paymentId', authMiddleware as any, async (req: Request, res: Response) => {
  try {
    const paymentId = req.params.paymentId as string;
    const user = (req as AuthenticatedRequest).user;

    // Проверяем что платёж принадлежит пользователю
    const dbPayment = await query<{ id: number; status: string; credits: number }>(
      'SELECT id, status, credits FROM payments WHERE yookassa_payment_id = $1 AND user_id = $2',
      [paymentId, user.id]
    );

    if (dbPayment.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Платёж не найден' });
      return;
    }

    // Если уже обработан — возвращаем статус из БД
    if (dbPayment.rows[0].status === 'succeeded') {
      res.json({ success: true, data: { status: 'succeeded', credits: dbPayment.rows[0].credits } });
      return;
    }

    // Запрашиваем актуальный статус у YooKassa
    const payment = await verifyWebhookPayment(paymentId);

    if (payment && payment.status === 'succeeded' && payment.paid) {
      // Начисляем кредиты (если ещё не начислены)
      if (dbPayment.rows[0].status !== 'succeeded') {
        await processSuccessfulPayment(paymentId);
      }
      res.json({ success: true, data: { status: 'succeeded', credits: dbPayment.rows[0].credits } });
    } else {
      res.json({ success: true, data: { status: payment?.status || 'pending' } });
    }
  } catch (err) {
    logger.error('Ошибка проверки статуса платежа', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Ошибка проверки статуса' });
  }
});

// ── YooKassa webhook (без авторизации) ─────────────

/**
 * POST /api/payments/webhook — получение уведомлений от YooKassa.
 * Не требует авторизации пользователя.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, object: paymentObject } = req.body as {
      event: string;
      object: { id: string; status: string; paid: boolean; metadata?: Record<string, string> };
    };

    logger.info('YooKassa webhook получен', { event, paymentId: paymentObject?.id });

    if (event === 'payment.succeeded' && paymentObject.paid) {
      await processSuccessfulPayment(paymentObject.id);
    } else if (event === 'payment.canceled') {
      // Получаем данные платежа из БД для алерта
      const canceledPayment = await query<{
        user_id: number;
        package_id: string;
        amount_rub: number;
      }>(
        'SELECT user_id, package_id, amount_rub FROM payments WHERE yookassa_payment_id = $1',
        [paymentObject.id]
      );

      await query(
        `UPDATE payments SET status = 'canceled', updated_at = NOW() WHERE yookassa_payment_id = $1`,
        [paymentObject.id]
      );

      // Алерт администратору об отклонённом платеже
      const cp = canceledPayment.rows[0];
      await alertPaymentCanceled({
        yookassaPaymentId: paymentObject.id,
        userId: cp?.user_id,
        packageId: cp?.package_id,
        amountRub: cp?.amount_rub,
      });

      logger.info('Платёж отменён', { paymentId: paymentObject.id });
    }

    // YooKassa ожидает 200 OK
    res.status(200).json({ success: true });
  } catch (err) {
    logger.error('Ошибка обработки YooKassa webhook', { error: (err as Error).message });
    // Всё равно возвращаем 200, чтобы YooKassa не повторяла запрос
    res.status(200).json({ success: true });
  }
});

// ── Обработка успешного платежа ────────────────────

async function processSuccessfulPayment(yookassaPaymentId: string): Promise<void> {
  // Верифицируем через API YooKassa
  const payment = await verifyWebhookPayment(yookassaPaymentId);
  if (!payment || payment.status !== 'succeeded' || !payment.paid) {
    logger.warn('Платёж не подтверждён YooKassa API', { yookassaPaymentId });
    return;
  }

  // Находим платёж в БД
  const dbResult = await query<{
    id: number;
    user_id: number;
    credits: number;
    status: string;
    package_id: string;
  }>(
    'SELECT id, user_id, credits, status, package_id FROM payments WHERE yookassa_payment_id = $1',
    [yookassaPaymentId]
  );

  if (dbResult.rows.length === 0) {
    logger.error('Платёж не найден в БД', { yookassaPaymentId });
    return;
  }

  const dbPayment = dbResult.rows[0];

  // Идемпотентность — не начисляем дважды
  if (dbPayment.status === 'succeeded') {
    logger.info('Платёж уже обработан', { yookassaPaymentId });
    return;
  }

  // Начисляем кредиты
  await addCredits(dbPayment.user_id, dbPayment.credits, 'purchase', yookassaPaymentId);

  // Обновляем статус платежа
  await query(
    `UPDATE payments SET status = 'succeeded', updated_at = NOW() WHERE yookassa_payment_id = $1`,
    [yookassaPaymentId]
  );

  // Алерт администратору об успешной оплате
  const pkg = getPackage(dbPayment.package_id);
  await alertPaymentSucceeded({
    yookassaPaymentId,
    userId: dbPayment.user_id,
    packageId: dbPayment.package_id,
    packageName: pkg?.name ?? dbPayment.package_id,
    credits: dbPayment.credits,
    amountRub: pkg?.priceRub ?? 0,
  });

  logger.info('Платёж обработан, кредиты начислены', {
    yookassaPaymentId,
    userId: dbPayment.user_id,
    credits: dbPayment.credits,
    packageId: dbPayment.package_id,
  });
}

export default router;
