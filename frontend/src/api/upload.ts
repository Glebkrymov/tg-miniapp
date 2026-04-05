/**
 * Загрузка файлов через presigned URL.
 * Flow: фронтенд → бэкенд (presign) → Yandex Object Storage (PUT) → public URL для PoYo.
 */

import apiClient from './client';
import axios from 'axios';

export type UploadFileType = 'image' | 'video';

interface PresignResponse {
  upload_url: string;
  public_url: string;
  key: string;
  max_size: number;
}

/**
 * Загрузить файл в Object Storage.
 * Возвращает публичный URL для передачи в PoYo API.
 */
export async function uploadFile(
  file: File,
  fileType: UploadFileType,
  onProgress?: (percent: number) => void
): Promise<string> {
  // 1. Получаем presigned URL от бэкенда
  const ext = file.name.split('.').pop() || (fileType === 'image' ? 'jpg' : 'mp4');

  const presignRes = await apiClient.post<{ success: boolean; data: PresignResponse }>(
    '/api/upload/presign',
    {
      file_type: fileType,
      content_type: file.type,
      file_extension: ext,
    }
  );

  if (!presignRes.data.success) {
    throw new Error('Не удалось получить URL для загрузки');
  }

  const { upload_url, public_url, max_size } = presignRes.data.data;

  // 2. Проверяем размер
  if (file.size > max_size) {
    const maxMB = Math.round(max_size / 1024 / 1024);
    throw new Error(`Файл слишком большой. Максимум: ${maxMB} МБ`);
  }

  // 3. Загружаем напрямую в Object Storage через presigned PUT
  await axios.put(upload_url, file, {
    headers: {
      'Content-Type': file.type,
    },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });

  return public_url;
}
