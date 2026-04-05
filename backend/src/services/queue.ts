import { redis } from '../config/redis';
import { query } from '../config/db';
import { logger } from '../config/logger';
import { poyoClient, TaskStatus } from './poyo';
import * as credits from './credits';
import { bot } from '../bot';

const TASK_TTL = 25 * 60 * 60; // 25 часов в секундах
const POLL_INTERVAL_MS = 3_000; // 3 секунды
// Таймаут ожидания webhook: задачи старше 5 мин проверяются polling-ом

// ── Данные задачи в Redis ───────────────────────────

export interface QueuedTask {
  userId: number;
  taskId: number;
  model: string;
  creditsReserved: number;
  telegramId: number;
  category: 'image' | 'video' | 'music';
  createdAt: number; // timestamp
}

/**
 * Сохранить задачу в Redis при отправке в PoYo.
 */
export async function enqueueTask(
  poyoTaskId: string,
  data: QueuedTask
): Promise<void> {
  const key = `task:${poyoTaskId}`;
  await redis.set(key, JSON.stringify(data), 'EX', TASK_TTL);
  logger.info('Задача добавлена в очередь', { poyoTaskId, taskId: data.taskId });
}

/**
 * Получить данные задачи из Redis.
 */
export async function getQueuedTask(poyoTaskId: string): Promise<QueuedTask | null> {
  const key = `task:${poyoTaskId}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as QueuedTask;
}

/**
 * Удалить задачу из Redis.
 */
export async function removeTask(poyoTaskId: string): Promise<void> {
  await redis.del(`task:${poyoTaskId}`);
}

// ── Обработка завершённой задачи ────────────────────

/**
 * Обработать результат от PoYo (вызывается из webhook или polling).
 */
export async function handleTaskResult(
  poyoTaskId: string,
  status: 'finished' | 'failed',
  files?: { file_url: string; file_type: string }[],
  errorMessage?: string
): Promise<void> {
  const taskData = await getQueuedTask(poyoTaskId);

  if (!taskData) {
    logger.warn('Задача не найдена в Redis', { poyoTaskId });
    return;
  }

  const { userId, taskId, creditsReserved, telegramId, category } = taskData;

  try {
    if (status === 'finished' && files && files.length > 0) {
      // Обновляем задачу в БД — поддержка разных форматов файлов (image/video: file_url, music: audio_url)
      const firstFile = files[0];
      const resultUrl = firstFile.file_url || firstFile.audio_url || firstFile.video_url || firstFile.url;
      await query(
        `UPDATE tasks SET status = 'finished', result_url = $1, completed_at = NOW()
         WHERE id = $2`,
        [resultUrl, taskId]
      );

      // Списываем кредиты окончательно
      await credits.charge(userId, creditsReserved, taskId);

      // Уведомляем пользователя
      await notifyUser(telegramId, category, resultUrl);

      logger.info('Задача завершена успешно', { poyoTaskId, taskId, userId });
    } else {
      // Ошибка генерации
      await query(
        `UPDATE tasks SET status = 'failed', error_message = $1, completed_at = NOW()
         WHERE id = $2`,
        [errorMessage || 'Неизвестная ошибка', taskId]
      );

      // Возвращаем кредиты
      await credits.refund(userId, creditsReserved, taskId);

      // Уведомляем об ошибке
      await bot.telegram.sendMessage(
        telegramId,
        `❌ Генерация не удалась.\n\n${errorMessage || 'Попробуйте позже.'}\n\n💰 ${creditsReserved} кредитов возвращены на баланс.`
      );

      logger.info('Задача завершена с ошибкой', { poyoTaskId, taskId, errorMessage });
    }
  } finally {
    // Удаляем из Redis в любом случае
    await removeTask(poyoTaskId);
  }
}

/**
 * Отправить результат пользователю в зависимости от категории.
 */
async function notifyUser(
  telegramId: number,
  category: string,
  resultUrl: string
): Promise<void> {
  try {
    switch (category) {
      case 'image':
        await bot.telegram.sendPhoto(telegramId, resultUrl, {
          caption: '✅ Ваше изображение готово!',
        });
        break;
      case 'video':
        await bot.telegram.sendVideo(telegramId, resultUrl, {
          caption: '✅ Ваше видео готово!',
        });
        break;
      case 'music':
        await bot.telegram.sendAudio(telegramId, resultUrl, {
          caption: '✅ Ваша музыка готова!',
        });
        break;
      default:
        await bot.telegram.sendMessage(telegramId, `✅ Генерация завершена!\n\n${resultUrl}`);
    }
  } catch (err) {
    logger.error('Ошибка отправки уведомления', {
      telegramId,
      error: (err as Error).message,
    });
  }
}

// ── Fallback polling ────────────────────────────────

let pollingTimer: NodeJS.Timeout | null = null;

/**
 * Запустить фоновый polling незавершённых задач.
 * Проверяет задачи, для которых webhook не пришёл за 5 минут.
 */
export function startPolling(): void {
  if (pollingTimer) return;

  pollingTimer = setInterval(async () => {
    try {
      await pollPendingTasks();
    } catch (err) {
      logger.error('Ошибка polling', { error: (err as Error).message });
    }
  }, POLL_INTERVAL_MS);

  logger.info('Fallback polling запущен', { intervalMs: POLL_INTERVAL_MS });
}

/**
 * Остановить polling.
 */
export function stopPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

/**
 * Проверить все незавершённые задачи старше 5 минут.
 */
async function pollPendingTasks(): Promise<void> {
  // Ищем все задачи со статусом pending/processing (включая category для выбора endpoint)
  const result = await query<{ id: number; poyo_task_id: string; category: string }>(
    `SELECT id, poyo_task_id, category FROM tasks
     WHERE status IN ('pending', 'processing')
       AND poyo_task_id NOT LIKE 'pending_%'
     ORDER BY created_at ASC
     LIMIT 10`
  );

  for (const task of result.rows) {
    try {
      // Для музыкальных задач используем отдельный endpoint PoYo
      const statusData: TaskStatus = task.category === 'music'
        ? await poyoClient.getMusicStatus(task.poyo_task_id)
        : await poyoClient.getStatus(task.poyo_task_id);

      if (statusData.status === 'processing') {
        // Обновляем статус в БД
        await query(
          "UPDATE tasks SET status = 'processing' WHERE id = $1 AND status = 'pending'",
          [task.id]
        );
      } else if (statusData.status === 'finished') {
        await handleTaskResult(
          task.poyo_task_id,
          'finished',
          statusData.files
        );
      } else if (statusData.status === 'failed') {
        await handleTaskResult(
          task.poyo_task_id,
          'failed',
          undefined,
          statusData.error
        );
      }
    } catch (err) {
      logger.error('Ошибка polling задачи', {
        taskId: task.id,
        poyoTaskId: task.poyo_task_id,
        error: (err as Error).message,
      });
    }
  }
}
