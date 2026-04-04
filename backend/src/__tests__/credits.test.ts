/**
 * Тесты для сервиса кредитов (src/services/credits.ts).
 * Используем моки вместо реального PostgreSQL.
 */

// Мокаем модули до импорта
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock('../config/db', () => ({
  pool: {
    connect: mockConnect,
  },
  query: mockQuery,
}));

jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { getBalance, reserve, refund, addCredits, InsufficientCreditsError } from '../services/credits';

// Мок клиента транзакций
const mockClient = {
  query: mockClientQuery,
  release: mockRelease,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(mockClient);
});

// ── getBalance ─────────────────────────────────────

describe('getBalance', () => {
  it('возвращает баланс существующего пользователя', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ credits: 150 }] });

    const balance = await getBalance(1);
    expect(balance).toBe(150);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT credits FROM users WHERE id = $1',
      [1]
    );
  });

  it('бросает ошибку для несуществующего пользователя', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(getBalance(999)).rejects.toThrow('Пользователь 999 не найден');
  });
});

// ── reserve ────────────────────────────────────────

describe('reserve', () => {
  it('успешно резервирует кредиты при достаточном балансе', async () => {
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ credits: 100 }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({}) // UPDATE credits
      .mockResolvedValueOnce({}) // INSERT transaction
      .mockResolvedValueOnce({}); // COMMIT

    await reserve(1, 30, 10);

    expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockClientQuery).toHaveBeenCalledWith(
      'SELECT credits FROM users WHERE id = $1 FOR UPDATE',
      [1]
    );
    // Проверяем что баланс обновлён на 70 (100 - 30)
    expect(mockClientQuery).toHaveBeenCalledWith(
      'UPDATE users SET credits = $1 WHERE id = $2',
      [70, 1]
    );
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    expect(mockRelease).toHaveBeenCalled();
  });

  it('бросает InsufficientCreditsError при недостаточном балансе', async () => {
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ credits: 5 }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(reserve(1, 30, 10)).rejects.toThrow(InsufficientCreditsError);

    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockRelease).toHaveBeenCalled();
  });

  it('бросает ошибку для несуществующего пользователя', async () => {
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE — пусто
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(reserve(999, 10, 1)).rejects.toThrow('Пользователь 999 не найден');
    expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
  });
});

// ── refund ─────────────────────────────────────────

describe('refund', () => {
  it('успешно возвращает кредиты', async () => {
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ credits: 50 }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({}) // UPDATE credits
      .mockResolvedValueOnce({}) // INSERT transaction
      .mockResolvedValueOnce({}); // COMMIT

    await refund(1, 20, 5);

    // Проверяем что баланс обновлён на 70 (50 + 20)
    expect(mockClientQuery).toHaveBeenCalledWith(
      'UPDATE users SET credits = $1 WHERE id = $2',
      [70, 1]
    );
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
  });
});

// ── addCredits ─────────────────────────────────────

describe('addCredits', () => {
  it('успешно начисляет кредиты при покупке', async () => {
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ credits: 100 }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({}) // UPDATE credits
      .mockResolvedValueOnce({}) // INSERT transaction
      .mockResolvedValueOnce({}); // COMMIT

    await addCredits(1, 200, 'purchase', 'pay_123');

    // Проверяем что баланс обновлён на 300 (100 + 200)
    expect(mockClientQuery).toHaveBeenCalledWith(
      'UPDATE users SET credits = $1 WHERE id = $2',
      [300, 1]
    );
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
  });

  it('начисляет реферальный бонус', async () => {
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ credits: 20 }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({}) // UPDATE credits
      .mockResolvedValueOnce({}) // INSERT transaction
      .mockResolvedValueOnce({}); // COMMIT

    await addCredits(2, 10, 'referral');

    expect(mockClientQuery).toHaveBeenCalledWith(
      'UPDATE users SET credits = $1 WHERE id = $2',
      [30, 2]
    );
  });
});
