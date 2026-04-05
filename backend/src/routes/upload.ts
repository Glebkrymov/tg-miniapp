import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authMiddleware } from '../middleware/auth';
import {
  createPresignedUpload,
  UploadFileType,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  ALLOWED_CONTENT_TYPES,
} from '../config/s3';
import { logger } from '../config/logger';

const router = Router();

// Все роуты требуют авторизации
router.use(authMiddleware as any);

/**
 * POST /api/upload/presign — получить presigned URL для загрузки файла.
 * Body: { file_type: 'image' | 'video', content_type: string, file_extension: string }
 * Response: { upload_url, public_url, key, max_size }
 */
router.post('/presign', async (req: Request, res: Response) => {
  try {
    const { file_type, content_type, file_extension } = req.body as {
      file_type: UploadFileType;
      content_type: string;
      file_extension: string;
    };

    if (!file_type || !content_type || !file_extension) {
      res.status(400).json({
        success: false,
        error: 'Необходимы file_type, content_type и file_extension',
      });
      return;
    }

    if (!['image', 'video'].includes(file_type)) {
      res.status(400).json({
        success: false,
        error: 'file_type должен быть "image" или "video"',
      });
      return;
    }

    const user = (req as AuthenticatedRequest).user;

    const { uploadUrl, publicUrl, key } = await createPresignedUpload(
      user.id,
      file_type,
      content_type,
      file_extension.replace(/^\./, '') // убираем точку если есть
    );

    const maxSize = file_type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;

    res.json({
      success: true,
      data: {
        upload_url: uploadUrl,
        public_url: publicUrl,
        key,
        max_size: maxSize,
      },
    });
  } catch (err) {
    const message = (err as Error).message;
    logger.error('Ошибка POST /api/upload/presign', { error: message });

    if (message.includes('Недопустимый тип')) {
      res.status(400).json({ success: false, error: message });
      return;
    }

    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/upload/config — допустимые типы и размеры файлов.
 */
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      allowed_types: ALLOWED_CONTENT_TYPES,
      max_sizes: {
        image: MAX_IMAGE_SIZE,
        video: MAX_VIDEO_SIZE,
      },
    },
  });
});

export default router;
