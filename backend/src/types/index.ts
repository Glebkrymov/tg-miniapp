import { Request } from 'express';

/**
 * Пользователь из БД, прикрепляется к запросу после авторизации.
 */
export interface AppUser {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  language_code: string;
  credits: number;
  referral_code: string;
  is_banned: boolean;
  created_at: Date;
  last_active_at: Date;
}

/**
 * Расширенный Express Request с пользователем.
 */
export interface AuthenticatedRequest extends Request {
  user: AppUser;
  /** Реферальный код, если передан при первом входе */
  refCode?: string;
}

/**
 * Стандартный формат API ответа.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Кастомная ошибка приложения.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}
