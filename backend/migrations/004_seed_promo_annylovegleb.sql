-- Тестовый промокод AnnyLoveGleb: 500 кредитов + 3 бесплатные генерации видео
-- Код хранится в uppercase, поиск тоже по uppercase — регистр не важен

INSERT INTO promo_codes (code, description, type, credits_amount, max_uses, is_active)
VALUES ('ANNYLOVEGLEB', 'Подарочный промокод — 500 кредитов', 'credits', 500, 0, TRUE)
ON CONFLICT (code) DO NOTHING;
