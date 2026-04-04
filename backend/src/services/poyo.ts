import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';

// ── Типы ответов PoYo API ───────────────────────────

export interface PoyoFile {
  file_url: string;
  file_type: 'image' | 'video' | 'audio';
}

export interface PoyoSubmitResponse {
  data: {
    task_id: string;
    status: string;
  };
}

export interface PoyoStatusResponse {
  data: {
    task_id: string;
    status: 'not_started' | 'processing' | 'finished' | 'failed';
    files?: PoyoFile[];
    error?: string;
  };
}

export type TaskStatus = PoyoStatusResponse['data'];

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
      const response = await this.requestWithRetry<PoyoSubmitResponse>('POST', '/api/generate/submit', {
        model,
        callback_url: callbackUrl,
        input,
      });

      const taskId = response.data.task_id;
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
      const response = await this.requestWithRetry<PoyoStatusResponse>(
        'GET',
        `/api/generate/status/${taskId}`
      );

      const latency = Date.now() - start;
      logger.info('PoYo: статус получен', {
        taskId,
        status: response.data.status,
        latencyMs: latency,
      });

      return response.data;
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

        // axios ошибка с response
        const axiosErr = err as { response?: { status: number } };
        const status = axiosErr.response?.status;

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
