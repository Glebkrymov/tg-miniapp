-- ============================================
-- Миграция 001: начальная схема базы данных
-- Таблицы: users, tasks, transactions, referrals
-- ============================================

BEGIN;

-- ── Таблица пользователей ───────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  telegram_id     BIGINT UNIQUE NOT NULL,
  username        VARCHAR(64),
  first_name      VARCHAR(128),
  language_code   VARCHAR(8) DEFAULT 'ru',
  credits         INTEGER NOT NULL DEFAULT 20,        -- стартовые кредиты
  invited_by      BIGINT REFERENCES users(telegram_id),
  referral_code   VARCHAR(16) UNIQUE NOT NULL,
  is_banned       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Таблица задач генерации ─────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id              SERIAL PRIMARY KEY,
  poyo_task_id    VARCHAR(64) UNIQUE NOT NULL,         -- task_id от PoYo API
  user_id         INTEGER REFERENCES users(id) NOT NULL,
  model_id        VARCHAR(64) NOT NULL,                 -- идентификатор модели PoYo
  category        VARCHAR(16) NOT NULL,                 -- 'image' | 'video' | 'music'
  prompt          TEXT,
  params          JSONB DEFAULT '{}',                   -- доп. параметры запроса
  status          VARCHAR(16) DEFAULT 'pending',        -- pending | processing | finished | failed
  result_url      TEXT,                                 -- URL файла (действует 24ч от PoYo)
  result_saved_url TEXT,                                -- наш S3/сохранённый URL
  credits_cost    INTEGER NOT NULL,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ── Таблица транзакций кредитов ─────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) NOT NULL,
  type            VARCHAR(16) NOT NULL,                 -- 'purchase' | 'spend' | 'refund' | 'bonus' | 'referral'
  credits_delta   INTEGER NOT NULL,                     -- положительное = пополнение, отрицательное = списание
  credits_before  INTEGER NOT NULL,
  credits_after   INTEGER NOT NULL,
  description     TEXT,
  task_id         INTEGER REFERENCES tasks(id),
  payment_id      VARCHAR(128),                         -- Telegram payment_charge_id
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Таблица рефералов ───────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id              SERIAL PRIMARY KEY,
  referrer_id     INTEGER REFERENCES users(id) NOT NULL,
  referred_id     INTEGER REFERENCES users(id) UNIQUE NOT NULL,
  bonus_credited  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Индексы ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_tasks_poyo_task_id ON tasks(poyo_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- ── Таблица применённых миграций ────────────────────
CREATE TABLE IF NOT EXISTS _migrations (
  id              SERIAL PRIMARY KEY,
  filename        VARCHAR(255) UNIQUE NOT NULL,
  applied_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
