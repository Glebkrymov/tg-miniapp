import { logger } from '../config/logger';

const ALERT_BOT_TOKEN = process.env.ALERT_BOT_TOKEN || '';
const ALERT_CHAT_ID = process.env.ALERT_CHAT_ID || '';

/**
 * Отправить сообщение в Telegram-чат администратора.
 * Использует fetch (Node 18+) напрямую к Bot API — без зависимостей.
 */
async function sendAlert(text: string): Promise<void> {
  if (!ALERT_BOT_TOKEN || !ALERT_CHAT_ID) {
    logger.warn('Alert не настроен: ALERT_BOT_TOKEN или ALERT_CHAT_ID отсутствуют');
    return;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${ALERT_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ALERT_CHAT_ID,
          text,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      logger.error('Ошибка отправки alert в Telegram', { status: res.status, body });
    }
  } catch (err) {
    logger.error('Исключение при отправке alert', { error: (err as Error).message });
  }
}

// ── Генерации ──────────────────────────────────────────

export async function alertGenerationFailed(opts: {
  taskId: number;
  userId: number;
  telegramId: number;
  model: string;
  category: string;
  credits: number;
  error?: string;
}): Promise<void> {
  const text =
    `❌ <b>Генерация провалена</b>\n\n` +
    `👤 User ID: <code>${opts.userId}</code> (tg: <code>${opts.telegramId}</code>)\n` +
    `🆔 Task ID: <code>${opts.taskId}</code>\n` +
    `🤖 Модель: <code>${opts.model}</code> [${opts.category}]\n` +
    `💰 Кредитов возвращено: <b>${opts.credits}</b>\n` +
    `⚠️ Ошибка: ${opts.error || 'Неизвестная ошибка'}`;

  await sendAlert(text);
}

export async function alertGenerationSuccess(opts: {
  taskId: number;
  userId: number;
  telegramId: number;
  model: string;
  category: string;
  credits: number;
}): Promise<void> {
  const categoryEmoji: Record<string, string> = {
    image: '🖼',
    video: '🎬',
    music: '🎵',
  };
  const emoji = categoryEmoji[opts.category] ?? '✅';

  const text =
    `${emoji} <b>Генерация завершена</b>\n\n` +
    `👤 User ID: <code>${opts.userId}</code> (tg: <code>${opts.telegramId}</code>)\n` +
    `🆔 Task ID: <code>${opts.taskId}</code>\n` +
    `🤖 Модель: <code>${opts.model}</code> [${opts.category}]\n` +
    `💰 Списано кредитов: <b>${opts.credits}</b>`;

  await sendAlert(text);
}

// ── Платежи ────────────────────────────────────────────

export async function alertPaymentSucceeded(opts: {
  yookassaPaymentId: string;
  userId: number;
  packageId: string;
  packageName: string;
  credits: number;
  amountRub: number;
}): Promise<void> {
  const text =
    `💚 <b>Оплата прошла</b>\n\n` +
    `👤 User ID: <code>${opts.userId}</code>\n` +
    `💳 Payment ID: <code>${opts.yookassaPaymentId}</code>\n` +
    `📦 Пакет: <b>${opts.packageName}</b> (${opts.packageId})\n` +
    `💰 Начислено кредитов: <b>${opts.credits}</b>\n` +
    `💵 Сумма: <b>${opts.amountRub} ₽</b>`;

  await sendAlert(text);
}

export async function alertPaymentCanceled(opts: {
  yookassaPaymentId: string;
  userId?: number;
  packageId?: string;
  amountRub?: number;
}): Promise<void> {
  const text =
    `🔴 <b>Оплата отклонена</b>\n\n` +
    `👤 User ID: <code>${opts.userId ?? '—'}</code>\n` +
    `💳 Payment ID: <code>${opts.yookassaPaymentId}</code>\n` +
    `📦 Пакет: <b>${opts.packageId ?? '—'}</b>\n` +
    `💵 Сумма: <b>${opts.amountRub ? opts.amountRub + ' ₽' : '—'}</b>`;

  await sendAlert(text);
}
