/**
 * Полный список моделей PoYo.ai с категориями и стоимостью в кредитах.
 */

export interface ModelInfo {
  model_id: string;
  name: string;
  category: 'image' | 'video' | 'music';
  credits: number;       // базовая стоимость в кредитах
  priceUsd: number;      // цена в USD
}

export const MODELS: ModelInfo[] = [
  // ── Image (10 моделей) ──────────────────────────
  { model_id: 'gpt-image-1-5',     name: 'GPT Image 1.5',      category: 'image', credits: 2,  priceUsd: 0.010 },
  { model_id: 'gpt-4o-image',      name: 'GPT-4o Image',        category: 'image', credits: 4,  priceUsd: 0.020 },
  { model_id: 'nano-banana-2',     name: 'Nano Banana 2',       category: 'image', credits: 5,  priceUsd: 0.025 },
  { model_id: 'nano-banana-pro',   name: 'Nano Banana Pro',     category: 'image', credits: 18, priceUsd: 0.090 },
  { model_id: 'nano-banana',       name: 'Nano Banana',         category: 'image', credits: 5,  priceUsd: 0.025 },
  { model_id: 'seedream-4-5',      name: 'Seedream 4.5',        category: 'image', credits: 5,  priceUsd: 0.025 },
  { model_id: 'seedream-5-0-lite', name: 'Seedream 5.0 Lite',   category: 'image', credits: 5,  priceUsd: 0.025 },
  { model_id: 'grok-imagine',      name: 'Grok Imagine',        category: 'image', credits: 6,  priceUsd: 0.030 },
  { model_id: 'z-image',           name: 'Z-Image',             category: 'image', credits: 2,  priceUsd: 0.010 },
  { model_id: 'flux-2',            name: 'FLUX.2',              category: 'image', credits: 6,  priceUsd: 0.030 },

  // ── Video (21 модель) ───────────────────────────
  { model_id: 'sora-2-official',          name: 'Sora 2 Official',          category: 'video', credits: 48,  priceUsd: 0.240 },
  { model_id: 'sora-2',                   name: 'Sora 2',                   category: 'video', credits: 20,  priceUsd: 0.100 },
  { model_id: 'sora-2-pro',               name: 'Sora 2 Pro',               category: 'video', credits: 30,  priceUsd: 0.150 },
  { model_id: 'veo-3-1',                  name: 'Veo 3.1',                  category: 'video', credits: 50,  priceUsd: 0.250 },
  { model_id: 'kling-2-1',                name: 'Kling 2.1',                category: 'video', credits: 30,  priceUsd: 0.150 },
  { model_id: 'kling-2-6',                name: 'Kling 2.6',                category: 'video', credits: 8,   priceUsd: 0.040 },
  { model_id: 'kling-2-5-turbo-pro',      name: 'Kling 2.5 Turbo Pro',      category: 'video', credits: 42,  priceUsd: 0.210 },
  { model_id: 'kling-3',                  name: 'Kling 3.0',                category: 'video', credits: 27,  priceUsd: 0.135 },
  { model_id: 'kling-2-6-motion-control', name: 'Kling 2.6 Motion Control', category: 'video', credits: 8,   priceUsd: 0.040 },
  { model_id: 'kling-3-0-motion-control', name: 'Kling 3.0 Motion Control', category: 'video', credits: 9,   priceUsd: 0.045 },
  { model_id: 'seedance-1-pro',           name: 'Seedance 1.0 Pro',         category: 'video', credits: 9,   priceUsd: 0.045 },
  { model_id: 'seedance-1-5-pro',         name: 'Seedance 1.5 Pro',         category: 'video', credits: 9,   priceUsd: 0.045 },
  { model_id: 'wan-2-2-fast',             name: 'Wan 2.2 Fast',             category: 'video', credits: 6,   priceUsd: 0.030 },
  { model_id: 'wan-2-5',                  name: 'Wan 2.5',                  category: 'video', credits: 30,  priceUsd: 0.150 },
  { model_id: 'wan-2-6',                  name: 'Wan 2.6',                  category: 'video', credits: 30,  priceUsd: 0.150 },
  { model_id: 'wan-animate',              name: 'Wan Animate',              category: 'video', credits: 30,  priceUsd: 0.150 },
  { model_id: 'hailuo-02',                name: 'Hailuo 02',                category: 'video', credits: 35,  priceUsd: 0.175 },
  { model_id: 'hailuo-2-3',               name: 'Hailuo 2.3',               category: 'video', credits: 35,  priceUsd: 0.175 },
  { model_id: 'runway-gen-4-5',           name: 'Runway Gen-4.5',           category: 'video', credits: 75,  priceUsd: 0.375 },
  { model_id: 'grok-imagine-video',       name: 'Grok Imagine (видео)',     category: 'video', credits: 6,   priceUsd: 0.030 },

  // ── Music (15 инструментов) ─────────────────────
  { model_id: 'generate-music',          name: 'AI Music (Generate)',     category: 'music', credits: 20, priceUsd: 0.100 },
  { model_id: 'extend-music',            name: 'Extend Music',           category: 'music', credits: 20, priceUsd: 0.100 },
  { model_id: 'upload-and-cover-audio',  name: 'Upload & Cover Audio',   category: 'music', credits: 20, priceUsd: 0.100 },
  { model_id: 'upload-and-extend-audio', name: 'Upload & Extend Audio',  category: 'music', credits: 20, priceUsd: 0.100 },
  { model_id: 'add-instrumental',        name: 'Add Instrumental',       category: 'music', credits: 20, priceUsd: 0.100 },
  { model_id: 'add-vocals',              name: 'Add Vocals',             category: 'music', credits: 20, priceUsd: 0.100 },
  { model_id: 'replace-section',         name: 'Replace Section',        category: 'music', credits: 10, priceUsd: 0.050 },
  { model_id: 'vocal-remover',           name: 'Vocal Remover',          category: 'music', credits: 15, priceUsd: 0.075 },
  { model_id: 'create-music-video',      name: 'AI Music Video',         category: 'music', credits: 4,  priceUsd: 0.020 },
  { model_id: 'generate-lyrics',         name: 'Generate Lyrics',        category: 'music', credits: 1,  priceUsd: 0.005 },
  { model_id: 'get-timestamped-lyrics',  name: 'Timestamped Lyrics',     category: 'music', credits: 1,  priceUsd: 0.005 },
  { model_id: 'boost-music-style',       name: 'Boost Music Style',      category: 'music', credits: 1,  priceUsd: 0.005 },
  { model_id: 'generate-music-cover',    name: 'Generate Music Cover',   category: 'music', credits: 1,  priceUsd: 0.005 },
  { model_id: 'generate-persona',        name: 'Generate Persona',       category: 'music', credits: 1,  priceUsd: 0.005 },
  { model_id: 'convert-to-wav',          name: 'Convert to WAV',         category: 'music', credits: 1,  priceUsd: 0.005 },
];

/** Быстрый поиск модели по model_id */
export const MODELS_MAP = new Map(MODELS.map((m) => [m.model_id, m]));

/** Получить модель или null */
export function getModel(modelId: string): ModelInfo | undefined {
  return MODELS_MAP.get(modelId);
}
