-- Таблица промокодов
CREATE TABLE IF NOT EXISTS promo_codes (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(50) UNIQUE NOT NULL,
  description     TEXT,
  -- Тип: 'credits' (начисление кредитов), 'free_generation' (бесплатная генерация)
  type            VARCHAR(30) NOT NULL DEFAULT 'credits',
  -- Количество кредитов для начисления (type='credits')
  credits_amount  INTEGER NOT NULL DEFAULT 0,
  -- Категория для бесплатной генерации (type='free_generation'): 'video', 'music', 'image', 'any'
  allowed_category VARCHAR(20) DEFAULT 'any',
  -- Конкретные model_id (через запятую), пустое = все модели категории
  allowed_models  TEXT DEFAULT '',
  -- Количество бесплатных генераций (type='free_generation')
  free_generations INTEGER NOT NULL DEFAULT 0,
  -- Сколько раз можно использовать всего (0 = безлимит)
  max_uses        INTEGER NOT NULL DEFAULT 0,
  -- Сколько раз уже использован
  used_count      INTEGER NOT NULL DEFAULT 0,
  -- Срок действия
  expires_at      TIMESTAMPTZ,
  -- Активен ли
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица активаций промокодов (один пользователь — один промокод один раз)
CREATE TABLE IF NOT EXISTS promo_activations (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id),
  activated_at  TIMESTAMPTZ DEFAULT NOW(),
  -- Для free_generation: сколько бесплатных генераций осталось
  remaining_generations INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, promo_code_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_activations_user ON promo_activations(user_id);
