-- Таблица платежей YooKassa
CREATE TABLE IF NOT EXISTS payments (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  yookassa_payment_id VARCHAR(255) UNIQUE NOT NULL,
  package_id          VARCHAR(100) NOT NULL,
  credits             INTEGER NOT NULL,
  amount_rub          NUMERIC(10,2) NOT NULL,
  status              VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_yookassa_id ON payments(yookassa_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
