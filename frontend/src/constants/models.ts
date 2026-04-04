/**
 * Полный список моделей PoYo.ai (46 моделей) для фронтенда.
 */

export type Category = 'image' | 'video' | 'music';

export interface Model {
  model_id: string;
  name: string;
  category: Category;
  credits: number;
  priceUsd: number;
  description?: string;
}

export const MODELS: Model[] = [
  // ── Image (10) ──────────────────────────────
  { model_id: 'gpt-image-1-5',     name: 'GPT Image 1.5',      category: 'image', credits: 2,  priceUsd: 0.010, description: 'Быстрая генерация от OpenAI' },
  { model_id: 'gpt-4o-image',      name: 'GPT-4o Image',        category: 'image', credits: 4,  priceUsd: 0.020, description: 'Высокое качество от GPT-4o' },
  { model_id: 'nano-banana-2',     name: 'Nano Banana 2',       category: 'image', credits: 5,  priceUsd: 0.025, description: 'Креативный стиль' },
  { model_id: 'nano-banana-pro',   name: 'Nano Banana Pro',     category: 'image', credits: 18, priceUsd: 0.090, description: 'Премиум качество Nano Banana' },
  { model_id: 'nano-banana',       name: 'Nano Banana',         category: 'image', credits: 5,  priceUsd: 0.025, description: 'Оригинальный Nano Banana' },
  { model_id: 'seedream-4-5',      name: 'Seedream 4.5',        category: 'image', credits: 5,  priceUsd: 0.025, description: 'Фотореалистичные изображения' },
  { model_id: 'seedream-5-0-lite', name: 'Seedream 5.0 Lite',   category: 'image', credits: 5,  priceUsd: 0.025, description: 'Лёгкая версия Seedream 5' },
  { model_id: 'grok-imagine',      name: 'Grok Imagine',        category: 'image', credits: 6,  priceUsd: 0.030, description: 'Генерация от xAI' },
  { model_id: 'z-image',           name: 'Z-Image',             category: 'image', credits: 2,  priceUsd: 0.010, description: 'Бюджетная генерация' },
  { model_id: 'flux-2',            name: 'FLUX.2',              category: 'image', credits: 6,  priceUsd: 0.030, description: 'Высокая детализация' },

  // ── Video (21) ──────────────────────────────
  { model_id: 'sora-2-official',          name: 'Sora 2 Official',          category: 'video', credits: 48,  priceUsd: 0.240, description: 'Официальная Sora от OpenAI' },
  { model_id: 'sora-2',                   name: 'Sora 2',                   category: 'video', credits: 20,  priceUsd: 0.100, description: 'Sora 2 базовая' },
  { model_id: 'sora-2-pro',               name: 'Sora 2 Pro',               category: 'video', credits: 30,  priceUsd: 0.150, description: 'Sora 2 улучшенная' },
  { model_id: 'veo-3-1',                  name: 'Veo 3.1',                  category: 'video', credits: 50,  priceUsd: 0.250, description: 'Veo от Google DeepMind' },
  { model_id: 'kling-2-1',                name: 'Kling 2.1',                category: 'video', credits: 30,  priceUsd: 0.150, description: 'Kling стандартная' },
  { model_id: 'kling-2-6',                name: 'Kling 2.6',                category: 'video', credits: 8,   priceUsd: 0.040, description: 'Kling 2.6 бюджетная' },
  { model_id: 'kling-2-5-turbo-pro',      name: 'Kling 2.5 Turbo Pro',      category: 'video', credits: 42,  priceUsd: 0.210, description: 'Kling быстрая премиум' },
  { model_id: 'kling-3',                  name: 'Kling 3.0',                category: 'video', credits: 27,  priceUsd: 0.135, description: 'Новейшая Kling 3.0' },
  { model_id: 'kling-2-6-motion-control', name: 'Kling 2.6 Motion Control', category: 'video', credits: 8,   priceUsd: 0.040, description: 'Управление движением' },
  { model_id: 'kling-3-0-motion-control', name: 'Kling 3.0 Motion Control', category: 'video', credits: 9,   priceUsd: 0.045, description: 'Kling 3 + управление движением' },
  { model_id: 'seedance-1-pro',           name: 'Seedance 1.0 Pro',         category: 'video', credits: 9,   priceUsd: 0.045, description: 'Видео с танцами' },
  { model_id: 'seedance-1-5-pro',         name: 'Seedance 1.5 Pro',         category: 'video', credits: 9,   priceUsd: 0.045, description: 'Улучшенные танцы' },
  { model_id: 'wan-2-2-fast',             name: 'Wan 2.2 Fast',             category: 'video', credits: 6,   priceUsd: 0.030, description: 'Быстрая генерация видео' },
  { model_id: 'wan-2-5',                  name: 'Wan 2.5',                  category: 'video', credits: 30,  priceUsd: 0.150, description: 'Wan высокое качество' },
  { model_id: 'wan-2-6',                  name: 'Wan 2.6',                  category: 'video', credits: 30,  priceUsd: 0.150, description: 'Wan последняя версия' },
  { model_id: 'wan-animate',              name: 'Wan Animate',              category: 'video', credits: 30,  priceUsd: 0.150, description: 'Анимация изображений' },
  { model_id: 'hailuo-02',                name: 'Hailuo 02',                category: 'video', credits: 35,  priceUsd: 0.175, description: 'Hailuo стандартная' },
  { model_id: 'hailuo-2-3',               name: 'Hailuo 2.3',               category: 'video', credits: 35,  priceUsd: 0.175, description: 'Hailuo улучшенная' },
  { model_id: 'runway-gen-4-5',           name: 'Runway Gen-4.5',           category: 'video', credits: 75,  priceUsd: 0.375, description: 'Runway премиум' },
  { model_id: 'grok-imagine-video',       name: 'Grok Imagine Video',       category: 'video', credits: 6,   priceUsd: 0.030, description: 'Видео от xAI' },

  // ── Music (15) ──────────────────────────────
  { model_id: 'generate-music',          name: 'AI Music',                category: 'music', credits: 20, priceUsd: 0.100, description: 'Генерация музыки с нуля' },
  { model_id: 'extend-music',            name: 'Extend Music',           category: 'music', credits: 20, priceUsd: 0.100, description: 'Продлить трек' },
  { model_id: 'upload-and-cover-audio',  name: 'Upload & Cover',         category: 'music', credits: 20, priceUsd: 0.100, description: 'Кавер на загруженный трек' },
  { model_id: 'upload-and-extend-audio', name: 'Upload & Extend',        category: 'music', credits: 20, priceUsd: 0.100, description: 'Продлить загруженный трек' },
  { model_id: 'add-instrumental',        name: 'Add Instrumental',       category: 'music', credits: 20, priceUsd: 0.100, description: 'Добавить инструментал' },
  { model_id: 'add-vocals',              name: 'Add Vocals',             category: 'music', credits: 20, priceUsd: 0.100, description: 'Добавить вокал' },
  { model_id: 'replace-section',         name: 'Replace Section',        category: 'music', credits: 10, priceUsd: 0.050, description: 'Заменить часть трека' },
  { model_id: 'vocal-remover',           name: 'Vocal Remover',          category: 'music', credits: 15, priceUsd: 0.075, description: 'Удалить вокал из трека' },
  { model_id: 'create-music-video',      name: 'AI Music Video',         category: 'music', credits: 4,  priceUsd: 0.020, description: 'Видеоклип для музыки' },
  { model_id: 'generate-lyrics',         name: 'Generate Lyrics',        category: 'music', credits: 1,  priceUsd: 0.005, description: 'Генерация текста песни' },
  { model_id: 'get-timestamped-lyrics',  name: 'Timestamped Lyrics',     category: 'music', credits: 1,  priceUsd: 0.005, description: 'Текст с таймкодами' },
  { model_id: 'boost-music-style',       name: 'Boost Style',            category: 'music', credits: 1,  priceUsd: 0.005, description: 'Усилить стиль трека' },
  { model_id: 'generate-music-cover',    name: 'Music Cover Art',        category: 'music', credits: 1,  priceUsd: 0.005, description: 'Обложка для трека' },
  { model_id: 'generate-persona',        name: 'Generate Persona',       category: 'music', credits: 1,  priceUsd: 0.005, description: 'AI-персона исполнителя' },
  { model_id: 'convert-to-wav',          name: 'Convert to WAV',         category: 'music', credits: 1,  priceUsd: 0.005, description: 'Конвертация в WAV' },
];

/** Количество моделей по категориям */
export const CATEGORY_COUNTS = {
  image: MODELS.filter((m) => m.category === 'image').length,
  video: MODELS.filter((m) => m.category === 'video').length,
  music: MODELS.filter((m) => m.category === 'music').length,
};

/** Фильтр моделей по категории */
export function getModelsByCategory(category: Category): Model[] {
  return MODELS.filter((m) => m.category === category);
}

/** Найти модель по ID */
export function getModelById(modelId: string): Model | undefined {
  return MODELS.find((m) => m.model_id === modelId);
}
