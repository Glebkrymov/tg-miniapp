import { Telegraf, Markup } from 'telegraf';
import { query } from '../config/db';
import { logger } from '../config/logger';
import { AppUser } from '../types';
import crypto from 'crypto';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEBAPP_URL = process.env.WEBAPP_URL || '';

export const bot = new Telegraf(BOT_TOKEN);

// ── /start — приветствие + кнопка Mini App ──────────
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || null;
  const languageCode = ctx.from.language_code || 'ru';

  // Проверяем реферальный код: /start ref_XXXXXXXX
  const payload = ctx.startPayload; // всё после /start
  const refCode = payload?.startsWith('ref_') ? payload.slice(4) : undefined;

  try {
    // Upsert пользователя
    const existing = await query<AppUser>(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    let isNew = false;

    if (existing.rows.length === 0) {
      // Генерируем referral_code
      const referralCode = generateReferralCode();

      await query(
        `INSERT INTO users (telegram_id, username, first_name, language_code, referral_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (telegram_id) DO NOTHING`,
        [telegramId, username, firstName, languageCode, referralCode]
      );
      isNew = true;

      // Обработка реферала
      if (refCode) {
        await handleBotReferral(telegramId, refCode);
      }

      logger.info('Новый пользователь через бота', { telegramId, refCode });
    } else {
      // Обновляем last_active_at
      await query(
        'UPDATE users SET last_active_at = NOW() WHERE telegram_id = $1',
        [telegramId]
      );
    }

    const greeting = isNew
      ? `Добро пожаловать, ${firstName || 'друг'}! 🎉\n\nТебе начислены 20 стартовых кредитов для генерации изображений, видео и музыки с помощью AI.`
      : `С возвращением, ${firstName || 'друг'}! 👋`;

    const message = `${greeting}\n\nОткрой приложение, чтобы начать генерацию:`;

    await ctx.reply(
      message,
      Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Открыть приложение', WEBAPP_URL)],
      ])
    );
  } catch (err) {
    logger.error('Ошибка в /start', { error: (err as Error).message, telegramId });
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// ── /balance — текущий баланс кредитов ──────────────
bot.command('balance', async (ctx) => {
  const telegramId = ctx.from.id;

  try {
    const result = await query<{ credits: number }>(
      'SELECT credits FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    if (result.rows.length === 0) {
      await ctx.reply('Вы не зарегистрированы. Нажмите /start для начала.');
      return;
    }

    const { credits } = result.rows[0];
    await ctx.reply(`💰 Ваш баланс: ${credits} кредитов`);
  } catch (err) {
    logger.error('Ошибка в /balance', { error: (err as Error).message, telegramId });
    await ctx.reply('Не удалось получить баланс. Попробуйте позже.');
  }
});

// ── /promo CODE — активация промокода ──────────────
bot.command('promo', async (ctx) => {
  const telegramId = ctx.from.id;
  const code = ctx.message.text.split(' ').slice(1).join(' ').trim();

  if (!code) {
    await ctx.reply('Использование: /promo КОД\n\nВведите промокод после команды.');
    return;
  }

  try {
    const userResult = await query<AppUser>(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    if (userResult.rows.length === 0) {
      await ctx.reply('Сначала нажмите /start для регистрации.');
      return;
    }

    const { activatePromoCode } = await import('../services/promo');
    const result = await activatePromoCode(userResult.rows[0].id, code);

    if (result.type === 'credits') {
      await ctx.reply(
        `✅ Промокод активирован!\n\n` +
        `💰 Начислено: ${result.credits_added} кредитов` +
        (result.description ? `\n📝 ${result.description}` : '')
      );
    } else {
      const categoryName = result.allowed_category === 'video' ? 'видео' :
        result.allowed_category === 'music' ? 'музыки' :
        result.allowed_category === 'image' ? 'изображений' : 'любой категории';
      await ctx.reply(
        `✅ Промокод активирован!\n\n` +
        `🎬 Бесплатных генераций: ${result.free_generations}\n` +
        `📂 Категория: ${categoryName}` +
        (result.description ? `\n📝 ${result.description}` : '')
      );
    }
  } catch (err) {
    const message = (err as Error).message;
    if (['Промокод не найден', 'Промокод неактивен', 'Срок действия промокода истёк',
         'Промокод больше не доступен', 'Вы уже использовали этот промокод'].includes(message)) {
      await ctx.reply(`❌ ${message}`);
    } else {
      logger.error('Ошибка /promo', { error: message, telegramId });
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
  }
});

// ── /help — список команд ───────────────────────────
bot.command('help', async (ctx) => {
  await ctx.reply(
    `📋 Доступные команды:\n\n` +
    `/start — запустить бота и открыть приложение\n` +
    `/balance — проверить баланс кредитов\n` +
    `/promo КОД — активировать промокод\n` +
    `/help — показать это сообщение\n\n` +
    `Для генерации изображений, видео и музыки — откройте Mini App по кнопке ниже.`,
    Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Открыть приложение', WEBAPP_URL)],
    ])
  );
});

// ── Вспомогательные функции ─────────────────────────

/**
 * Генерация реферального кода (8 символов).
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Обработка реферальной регистрации через бота.
 */
async function handleBotReferral(newUserTelegramId: number, refCode: string): Promise<void> {
  try {
    // Находим реферера
    const referrer = await query<AppUser>(
      'SELECT * FROM users WHERE referral_code = $1',
      [refCode]
    );

    if (referrer.rows.length === 0) {
      logger.warn('Реферальный код не найден (бот)', { refCode });
      return;
    }

    // Находим нового пользователя
    const newUser = await query<AppUser>(
      'SELECT * FROM users WHERE telegram_id = $1',
      [newUserTelegramId]
    );

    if (newUser.rows.length === 0) return;

    const referrerId = referrer.rows[0].id;
    const referredId = newUser.rows[0].id;

    // Нельзя быть рефералом самого себя
    if (referrerId === referredId) return;

    // Создаём запись (UNIQUE на referred_id предотвращает дубли)
    const insertResult = await query(
      `INSERT INTO referrals (referrer_id, referred_id, bonus_credited)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (referred_id) DO NOTHING
       RETURNING id`,
      [referrerId, referredId]
    );

    // Если запись была вставлена (не дубликат) — начисляем бонусы
    if (insertResult.rowCount && insertResult.rowCount > 0) {
      const { addCredits } = await import('../services/credits');

      // 10 кредитов рефереру
      await addCredits(referrerId, 10, 'referral');

      // 10 кредитов новому пользователю
      await addCredits(referredId, 10, 'referral');

      logger.info('Реферальные бонусы начислены', { referrerId, referredId, bonus: 10 });
    }

    logger.info('Реферал через бота', { referrerId, referredId, refCode });
  } catch (err) {
    logger.error('Ошибка реферала (бот)', { error: (err as Error).message });
  }
}

/**
 * Настройка webhook для бота.
 * Вызывается при запуске сервера.
 */
export async function setupBotWebhook(webhookUrl: string): Promise<void> {
  try {
    await bot.telegram.setWebhook(`${webhookUrl}/webhook/telegram`);
    logger.info('Webhook бота установлен', { url: `${webhookUrl}/webhook/telegram` });
  } catch (err) {
    logger.error('Ошибка установки webhook', { error: (err as Error).message });
  }
}
