/**
 * S3-совместимый клиент для Yandex Object Storage.
 * Используется для генерации presigned PUT URL (загрузка файлов из фронтенда).
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';

const UPLOAD_BUCKET = process.env.S3_UPLOAD_BUCKET || 'tgapp-uploads';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://storage.yandexcloud.net';
const S3_REGION = process.env.S3_REGION || 'ru-central1';

// Presigned URL живёт 15 минут
const PRESIGN_EXPIRES_SEC = 15 * 60;

// Максимальный размер файлов
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true, // Yandex Object Storage требует path-style
});

export type UploadFileType = 'image' | 'video';

const ALLOWED_CONTENT_TYPES: Record<UploadFileType, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
};

/**
 * Сгенерировать presigned PUT URL для загрузки файла.
 * Возвращает { uploadUrl, publicUrl, key }.
 */
export async function createPresignedUpload(
  userId: number,
  fileType: UploadFileType,
  contentType: string,
  fileExtension: string
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  // Валидация content-type
  const allowed = ALLOWED_CONTENT_TYPES[fileType];
  if (!allowed || !allowed.includes(contentType)) {
    throw new Error(`Недопустимый тип файла: ${contentType}. Допустимые: ${allowed?.join(', ')}`);
  }

  // Генерируем уникальный ключ
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `uploads/${userId}/${timestamp}-${rand}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGN_EXPIRES_SEC,
  });

  // Публичный URL для PoYo API (бакет с публичным чтением)
  const publicUrl = `${S3_ENDPOINT}/${UPLOAD_BUCKET}/${key}`;

  logger.info('Presigned URL создан', { userId, key, fileType, contentType });

  return { uploadUrl, publicUrl, key };
}

export { MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, ALLOWED_CONTENT_TYPES };
