/**
 * Тесты для PoYo API клиента (src/services/poyo.ts).
 * Мокаем axios для изоляции от внешнего API.
 */

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('axios', () => ({
  create: () => ({
    get: mockGet,
    post: mockPost,
  }),
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
    }),
  },
}));

jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Сбрасываем кэш модулей чтобы получить свежий инстанс с мокнутым axios
let poyoClient: any;

beforeAll(async () => {
  const mod = await import('../services/poyo');
  poyoClient = mod.poyoClient;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── submitTask ─────────────────────────────────────

describe('poyoClient.submitTask', () => {
  it('успешно отправляет задачу и возвращает task_id', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          task_id: 'poyo-task-123',
          status: 'not_started',
        },
      },
    });

    const taskId = await poyoClient.submitTask(
      'gpt-4o-image',
      { prompt: 'A cat' },
      'https://example.com/webhook'
    );

    expect(taskId).toBe('poyo-task-123');
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('бросает ошибку на 4xx без retry', async () => {
    const error = Object.assign(new Error('Bad Request'), {
      response: { status: 400 },
    });
    mockPost.mockRejectedValue(error);

    await expect(
      poyoClient.submitTask('bad-model', { prompt: 'test' }, 'https://example.com/webhook')
    ).rejects.toThrow('Bad Request');

    // На 4xx не должно быть retry — только 1 вызов
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('ретраит на 5xx и бросает ошибку после исчерпания попыток', async () => {
    const error = Object.assign(new Error('Internal Server Error'), {
      response: { status: 500 },
    });
    mockPost.mockRejectedValue(error);

    await expect(
      poyoClient.submitTask('gpt-4o-image', { prompt: 'test' }, 'https://example.com/webhook')
    ).rejects.toThrow('Internal Server Error');

    // 3 попытки (MAX_RETRIES)
    expect(mockPost).toHaveBeenCalledTimes(3);
  }, 15_000);
});

// ── getStatus ──────────────────────────────────────

describe('poyoClient.getStatus', () => {
  it('возвращает статус finished с файлами', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          task_id: 'poyo-task-123',
          status: 'finished',
          files: [
            { file_url: 'https://cdn.poyo.ai/result.png', file_type: 'image' },
          ],
        },
      },
    });

    const status = await poyoClient.getStatus('poyo-task-123');

    expect(status.status).toBe('finished');
    expect(status.files).toHaveLength(1);
    expect(status.files![0].file_url).toBe('https://cdn.poyo.ai/result.png');
  });

  it('возвращает статус processing', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          task_id: 'poyo-task-456',
          status: 'processing',
        },
      },
    });

    const status = await poyoClient.getStatus('poyo-task-456');

    expect(status.status).toBe('processing');
    expect(status.files).toBeUndefined();
  });

  it('возвращает статус failed с ошибкой', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          task_id: 'poyo-task-789',
          status: 'failed',
          error: 'Model overloaded',
        },
      },
    });

    const status = await poyoClient.getStatus('poyo-task-789');

    expect(status.status).toBe('failed');
    expect(status.error).toBe('Model overloaded');
  });
});
