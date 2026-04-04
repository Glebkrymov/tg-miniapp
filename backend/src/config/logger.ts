import winston from 'winston';
import Transport from 'winston-transport';
import axios from 'axios';

/**
 * Telegram-алерт транспорт: при ошибках отправляет сообщение в служебный чат.
 */
class TelegramAlertTransport extends Transport {
  private botToken: string;
  private chatId: string;
  private lastSent = 0;
  private readonly cooldownMs = 10_000; // не чаще раз в 10 секунд

  constructor(opts: { botToken: string; chatId: string; level?: string }) {
    super({ level: opts.level || 'error' });
    this.botToken = opts.botToken;
    this.chatId = opts.chatId;
  }

  log(info: any, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    const now = Date.now();
    if (now - this.lastSent < this.cooldownMs) {
      callback();
      return;
    }
    this.lastSent = now;

    const text = [
      `🚨 *${info.level.toUpperCase()}*`,
      `\`${info.message}\``,
      info.stack ? `\`\`\`\n${info.stack.slice(0, 500)}\n\`\`\`` : '',
    ]
      .filter(Boolean)
      .join('\n');

    axios
      .post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: this.chatId,
        text,
        parse_mode: 'Markdown',
      })
      .catch(() => {
        // Не падаем если алерт не отправился
      });

    callback();
  }
}

// ── Транспорты ──────────────────────────────────────

const transports: winston.transport[] = [new winston.transports.Console()];

// Подключаем Telegram-алерт если заданы токен и chat_id
const alertToken = process.env.ALERT_BOT_TOKEN;
const alertChatId = process.env.ALERT_CHAT_ID;
if (alertToken && alertChatId) {
  transports.push(
    new TelegramAlertTransport({
      botToken: alertToken,
      chatId: alertChatId,
      level: 'error',
    })
  );
}

/**
 * Логгер приложения.
 * В продакшне — JSON формат (для YC Cloud Logging).
 * В разработке — читаемый формат с цветами.
 */
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format:
    process.env.NODE_ENV === 'production'
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} ${level}: ${message}${metaStr}`;
          })
        ),
  transports,
});
