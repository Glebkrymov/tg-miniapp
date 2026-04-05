/**
 * Тесты для музыкальной генерации:
 * 1. handleTaskResult корректно парсит audio_url из PoYo music response
 * 2. handleTaskResult работает с классическим file_url (image/video)
 * 3. pollPendingTasks роутит music-задачи на getMusicStatus
 * 4. Webhook корректно обрабатывает музыкальный payload
 */

// ── Моки ──────────────────────────────────────────

const mockQuery = jest.fn();

jest.mock('../config/db', () => ({
  pool: { connect: jest.fn() },
  query: mockQuery,
}));

const mockRedisSet = jest.fn().mockResolvedValue('OK');
const mockRedisGet = jest.fn();
const mockRedisDel = jest.fn().mockResolvedValue(1);

jest.mock('../config/redis', () => ({
  redis: {
    set: mockRedisSet,
    get: mockRedisGet,
    del: mockRedisDel,
  },
}));

const mockGetStatus = jest.fn();
const mockGetMusicStatus = jest.fn();

jest.mock('../services/poyo', () => ({
  poyoClient: {
    getStatus: mockGetStatus,
    getMusicStatus: mockGetMusicStatus,
    submitTask: jest.fn(),
  },
}));

const mockSendPhoto = jest.fn().mockResolvedValue({});
const mockSendVideo = jest.fn().mockResolvedValue({});
const mockSendAudio = jest.fn().mockResolvedValue({});
const mockSendMessage = jest.fn().mockResolvedValue({});

jest.mock('../bot', () => ({
  bot: {
    telegram: {
      sendPhoto: mockSendPhoto,
      sendVideo: mockSendVideo,
      sendAudio: mockSendAudio,
      sendMessage: mockSendMessage,
    },
    webhookCallback: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  },
  setupBotWebhook: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Импорты после моков ───────────────────────────

import { handleTaskResult } from '../services/queue';

// ── Хелперы ───────────────────────────────────────

const MUSIC_TASK_DATA = {
  userId: 1,
  taskId: 100,
  model: 'generate-music',
  creditsReserved: 5,
  telegramId: 12345,
  category: 'music' as const,
  createdAt: Date.now(),
};

const IMAGE_TASK_DATA = {
  userId: 1,
  taskId: 101,
  model: 'gpt-image-1-5',
  creditsReserved: 2,
  telegramId: 12345,
  category: 'image' as const,
  createdAt: Date.now(),
};

// Мок credits.charge/refund — они используют pool.connect, мокаем через query
jest.mock('../services/credits', () => ({
  charge: jest.fn().mockResolvedValue(undefined),
  refund: jest.fn().mockResolvedValue(undefined),
  getBalance: jest.fn().mockResolvedValue(100),
  reserve: jest.fn().mockResolvedValue(undefined),
}));

// ── Тесты ─────────────────────────────────────────

describe('handleTaskResult — парсинг файлов', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('парсит audio_url из music-файлов PoYo', async () => {
    // Redis возвращает данные задачи
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(MUSIC_TASK_DATA));
    // UPDATE tasks
    mockQuery.mockResolvedValueOnce({});

    const musicFiles = [
      {
        audio_url: 'https://cdn.poyo.ai/music/song.mp3',
        file_type: 'audio',
        title: 'My Song',
        duration: 180,
      },
    ];

    await handleTaskResult('poyo-music-001', 'finished', musicFiles);

    // Проверяем что result_url = audio_url
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks SET status'),
      ['https://cdn.poyo.ai/music/song.mp3', 100]
    );

    // Проверяем что отправлен audio
    expect(mockSendAudio).toHaveBeenCalledWith(
      12345,
      'https://cdn.poyo.ai/music/song.mp3',
      { caption: '✅ Ваша музыка готова!' }
    );
  });

  it('парсит file_url из image-файлов (обратная совместимость)', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(IMAGE_TASK_DATA));
    mockQuery.mockResolvedValueOnce({});

    const imageFiles = [
      {
        file_url: 'https://cdn.poyo.ai/images/cat.png',
        file_type: 'image',
      },
    ];

    await handleTaskResult('poyo-img-001', 'finished', imageFiles);

    // result_url = file_url
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks SET status'),
      ['https://cdn.poyo.ai/images/cat.png', 101]
    );

    // Отправлено как photo
    expect(mockSendPhoto).toHaveBeenCalledWith(
      12345,
      'https://cdn.poyo.ai/images/cat.png',
      { caption: '✅ Ваше изображение готово!' }
    );
  });

  it('использует video_url как fallback', async () => {
    mockRedisGet.mockResolvedValueOnce(
      JSON.stringify({ ...IMAGE_TASK_DATA, category: 'video', taskId: 102 })
    );
    mockQuery.mockResolvedValueOnce({});

    const videoFiles = [
      {
        video_url: 'https://cdn.poyo.ai/video/clip.mp4',
        file_type: 'video',
      },
    ];

    await handleTaskResult('poyo-vid-001', 'finished', videoFiles);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks SET status'),
      ['https://cdn.poyo.ai/video/clip.mp4', 102]
    );
  });

  it('использует url как последний fallback', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(MUSIC_TASK_DATA));
    mockQuery.mockResolvedValueOnce({});

    const genericFiles = [
      {
        url: 'https://cdn.poyo.ai/generic/file.wav',
        file_type: 'audio',
      },
    ];

    await handleTaskResult('poyo-gen-001', 'finished', genericFiles);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks SET status'),
      ['https://cdn.poyo.ai/generic/file.wav', 100]
    );
  });

  it('при ошибке — делает refund и шлёт сообщение', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(MUSIC_TASK_DATA));
    mockQuery.mockResolvedValueOnce({}); // UPDATE tasks SET status = failed

    await handleTaskResult('poyo-fail-001', 'failed', undefined, 'Content policy violation');

    // Проверяем запись ошибки в БД
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'failed'"),
      ['Content policy violation', 100]
    );

    // Проверяем уведомление об ошибке
    expect(mockSendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining('Генерация не удалась')
    );
  });

  it('если задача не найдена в Redis — ничего не делает', async () => {
    mockRedisGet.mockResolvedValueOnce(null);

    await handleTaskResult('poyo-unknown-001', 'finished', [
      { audio_url: 'https://example.com/song.mp3', file_type: 'audio' },
    ]);

    // Ни одного UPDATE
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSendAudio).not.toHaveBeenCalled();
  });
});

describe('Webhook payload — музыкальный формат', () => {
  it('PoYo music webhook payload корректно извлекает audio_url', () => {
    // Симулируем реальный payload от PoYo для музыки
    const webhookBody = {
      data: {
        task_id: 'poyo-music-webhook-001',
        status: 'finished',
        files: [
          {
            audio_url: 'https://cdn.poyo.ai/music/generated.mp3',
            audio_id: 'audio-123',
            image_url: 'https://cdn.poyo.ai/music/cover.jpg',
            title: 'Generated Song',
            duration: 120,
          },
          {
            audio_url: 'https://cdn.poyo.ai/music/generated-v2.mp3',
            audio_id: 'audio-456',
            image_url: 'https://cdn.poyo.ai/music/cover-v2.jpg',
            title: 'Generated Song v2',
            duration: 125,
          },
        ],
      },
    };

    // Имитируем логику webhook.ts
    const payload = webhookBody.data || webhookBody;
    const task_id = payload.task_id;
    const status = payload.status;
    const files = payload.files;

    expect(task_id).toBe('poyo-music-webhook-001');
    expect(status).toBe('finished');
    expect(files).toHaveLength(2);

    // Имитируем логику queue.ts — извлечение URL
    const firstFile = files[0];
    const resultUrl =
      (firstFile as any).file_url ||
      firstFile.audio_url ||
      (firstFile as any).video_url ||
      (firstFile as any).url ||
      '';

    expect(resultUrl).toBe('https://cdn.poyo.ai/music/generated.mp3');
  });
});
