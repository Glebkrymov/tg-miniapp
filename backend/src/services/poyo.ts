import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';

// ── Типы ответов PoYo API ───────────────────────────

export interface PoyoFile {
  file_url: string;
  file_type: 'image' | 'video' | 'audio';
}

export interface TaskStatus {
  task_id: string;
  status: 'not_started' | 'processing' | 'finished' | 'failed';
  files?: PoyoFile[];
  error?: string;
}

// ── PoYo API клиент ─────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class PoyoClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.POYO_BASE_URL || 'https://api.poyo.ai',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.POYO_API_KEY || ''}`,
      },
      timeout: 30_000,
    });
  }

  /**
   * Отправить задачу на генерацию.
   * Возвращает task_id от PoYo.
   */
  async submitTask(
    model: string,
    input: Record<string, unknown>,
    callbackUrl: string
  ): Promise<string> {
    const start = Date.now();

    try {
      const body = await this.requestWithRetry<Record<string, unknown>>('POST', '/api/generate/submit', {
        model,
        callback_url: callbackUrl,
        input,
      });

      logger.info('PoYo: сырой ответ submit', { body: JSON.stringify(body).slice(0, 500) });

      // Поддержка разных форматов ответа: { task_id } или { data: { task_id } }
      const taskId = (body as any).task_id
        || (body as any).data?.task_id
        || (body as any).id;

      if (!taskId) {
        throw new Error(`PoYo: task_id не найден в ответе: ${JSON.stringify(body).slice(0, 300)}`);
      }

      const latency = Date.now() - start;
      logger.info('PoYo: задача отправлена', { model, taskId, latencyMs: latency });
      return taskId;
    } catch (err) {
      const latency = Date.now() - start;
      logger.error('PoYo: ошибка отправки задачи', {
        model,
        latencyMs: latency,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  /**
   * Получить статус задачи (polling fallback).
   */
  async getStatus(taskId: string): Promise<TaskStatus> {
    const start = Date.now();

    try {
      const body = await this.requestWithRetry<Record<string, unknown>>(
        'GET',
        `/api/generate/status/${taskId}`
      );

      logger.info('PoYo: сырой ответ status', { body: JSON.stringify(body).slice(0, 500) });

      // Поддержка разных форматов: { status, files } или { data: { status, files } }
      const data = (body as any).data || body;

      const result: TaskStatus = {
        task_id: data.task_id || taskId,
        status: data.status || 'processing',
        files: data.files || data.output?.files,
        error: data.error || data.message,
      };

      const latency = Date.now() - start;
      logger.info('PoYo: статус получен', {
        taskId,
        status: result.status,
        latencyMs: latency,
      });

      return result;
    } catch (err) {
      const latency = Date.now() - start;
      logger.error('PoYo: ошибка получения статуса', {
        taskId,
        latencyMs: latency,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  /**
   * Получить статус музыкальной задачи (отдельный endpoint PoYo).
   */
  async getMusicStatus(taskId: string): Promise<TaskStatus> {
    const start = Date.now();

    try {
      const body = await this.requestWithRetry<Record<string, unknown>>(
        'GET',
        `/api/generate/detail/music/${taskId}`
      );

      logger.info('PoYo: сырой ответ music status', { body: JSON.stringify(body).slice(0, 500) });

      const data = (body as any).data || body;

      // Music files приходят как { audio_url, audio_id, image_url, title, ... }
      const rawFiles = data.files || data.output?.files;
      const files = rawFiles?.map((f: any) => ({
        file_url: f.audio_url || f.file_url || f.url,
        audio_url: f.audio_url,
        image_url: f.image_url,
        file_type: 'audio' as const,
        title: f.title,
        duration: f.duration,
      }));

      const result: TaskStatus = {
        task_id: data.task_id || taskId,
        status: data.status || 'processing',
        files,
        error: data.error || data.error_message || data.message,
      };

      const latency = Date.now() - start;
      logger.info('PoYo: music статус получен', {
        taskId,
        status: result.status,
        filesCount: files?.length,
        latencyMs: latency,
      });

      return result;
    } catch (err) {
      const latency = Date.now() - start;
      logger.error('PoYo: ошибка получения music статуса', {
        taskId,
        latencyMs: latency,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  /**
   * HTTP запрос с retry на 5xx ошибки.
   * На 4xx — не ретраим, бросаем сразу.
   */
  private async requestWithRetry<T>(
    method: 'GET' | 'POST',
    url: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = method === 'GET'
          ? await this.client.get<T>(url)
          : await this.client.post<T>(url, data);

        return response.data;
      } catch (err: unknown) {
        lastError = err as Error;

        // Логируем полный ответ ошибки
        const axiosErr = err as { response?: { status: number; data?: unknown } };
        const status = axiosErr.response?.status;

        if (axiosErr.response?.data) {
          logger.error('PoYo: ответ ошибки', {
            url,
            status,
            responseData: JSON.stringify(axiosErr.response.data).slice(0, 500),
          });
        }

        // 4xx — не ретраим
        if (status && status >= 400 && status < 500) {
          throw err;
        }

        // 5xx или сетевая ошибка — ретраим
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAY_MS * (attempt + 1);
          logger.warn('PoYo: retry', { attempt: attempt + 1, url, delayMs: delay });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('PoYo: все попытки исчерпаны');
  }
}

/** Синглтон PoYo клиента */
export const poyoClient = new PoyoClient();
