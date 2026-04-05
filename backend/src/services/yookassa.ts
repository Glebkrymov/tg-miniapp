import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../config/logger';

const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';
const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';

interface CreatePaymentParams {
  /** Сумма в рублях */
  amount: number;
  /** Описание платежа */
  description: string;
  /** URL возврата после оплаты */
  returnUrl: string;
  /** Метаданные (userId, packageId, credits) */
  metadata: Record<string, string | number>;
}

interface YooKassaPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  metadata?: Record<string, string>;
  paid: boolean;
}

/**
 * Создание платежа в YooKassa.
 * Возвращает URL для перенаправления пользователя на страницу оплаты.
 */
export async function createPayment(params: CreatePaymentParams): Promise<{ paymentId: string; confirmationUrl: string }> {
  const idempotenceKey = crypto.randomUUID();

  const response = await axios.post<YooKassaPayment>(
    `${YOOKASSA_API_URL}/payments`,
    {
      amount: {
        value: params.amount.toFixed(2),
        currency: 'RUB',
      },
      capture: true, // автоматическое подтверждение
      confirmation: {
        type: 'redirect',
        return_url: params.returnUrl,
      },
      description: params.description,
      metadata: params.metadata,
    },
    {
      auth: {
        username: YOOKASSA_SHOP_ID,
        password: YOOKASSA_SECRET_KEY,
      },
      headers: {
        'Idempotence-Key': idempotenceKey,
        'Content-Type': 'application/json',
      },
    }
  );

  const payment = response.data;

  if (!payment.confirmation?.confirmation_url) {
    throw new Error('YooKassa не вернула URL подтверждения');
  }

  logger.info('YooKassa платёж создан', {
    paymentId: payment.id,
    amount: params.amount,
    metadata: params.metadata,
  });

  return {
    paymentId: payment.id,
    confirmationUrl: payment.confirmation.confirmation_url,
  };
}

/**
 * Получение статуса платежа.
 */
export async function getPaymentStatus(paymentId: string): Promise<YooKassaPayment> {
  const response = await axios.get<YooKassaPayment>(
    `${YOOKASSA_API_URL}/payments/${paymentId}`,
    {
      auth: {
        username: YOOKASSA_SHOP_ID,
        password: YOOKASSA_SECRET_KEY,
      },
    }
  );
  return response.data;
}

/**
 * Проверка подписи webhook уведомления от YooKassa.
 * YooKassa отправляет уведомления без подписи — проверяем по IP или через повторный запрос статуса.
 */
export async function verifyWebhookPayment(paymentId: string): Promise<YooKassaPayment | null> {
  try {
    const payment = await getPaymentStatus(paymentId);
    return payment;
  } catch (err) {
    logger.error('Ошибка проверки платежа', { paymentId, error: (err as Error).message });
    return null;
  }
}
