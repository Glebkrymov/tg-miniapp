# CONTEXT.md — Telegram Mini App на PoYo.ai API

> Этот файл — главный источник истины для Cowork.
> Читай его перед началом любой задачи по проекту.

---

## 🎯 Цель проекта

Telegram Mini App (WebApp) с ботом, который предоставляет пользователям доступ ко всем AI-моделям
платформы PoYo.ai: генерация изображений, видео и музыки. Монетизация через кредитную систему
и Telegram Payments. Реферальная программа для роста.

---

## 🏗️ Архитектура

```
Пользователь (Telegram)
        │
        ▼
  Telegram Bot API
        │
   ┌────┴────┐
   │  Bot    │  ← команды /start /balance /history
   │ Handler │
   └────┬────┘
        │
        ▼
  Mini App (WebApp)                  ← статика в YC Object Storage
  React + Vite                          + YC API Gateway (домен)
        │
        ▼
  Backend API                        ← YC Serverless Containers
  api.yourdomain.com                    (автомасштабирование)
        │
   ┌────┴────────────────────┐
   │                         │
   ▼                         ▼
YC Managed PostgreSQL    YC Managed Valkey (Redis-совместимый)
(users, tasks,           (очередь задач,
 transactions,            кэш статусов,
 referrals)               rate limits)
        │
        ▼
  PoYo.ai API
  api.poyo.ai
  (46 моделей)
```

### Yandex Cloud сервисы
| Сервис                          | Назначение                                  |
|---------------------------------|---------------------------------------------|
| Serverless Containers           | Запуск backend (Node.js Docker-образ)       |
| Container Registry (cr.yandex) | Хранение Docker-образов                      |
| Managed PostgreSQL              | База данных (users, tasks, transactions)     |
| Managed Valkey™ (Redis-совмест) | Кэш, очередь задач, rate limiting           |
| Object Storage                  | Хостинг фронтенда (React SPA)               |
| API Gateway                     | HTTPS-домен для фронтенда и webhook-ов      |
| Lockbox                         | Хранение секретов (BOT_TOKEN, POYO_API_KEY) |
| Cloud Logging                   | Централизованные логи из контейнеров        |
| Certificate Manager             | TLS-сертификаты для доменов                 |

---

## 🛠️ Стек технологий

### Backend
- **Runtime:** Node.js 20+ с TypeScript
- **Framework:** Express.js + express-validator
- **БД:** PostgreSQL 16 (через библиотеку `pg` или Drizzle ORM)
- **Кэш / очередь:** Redis (через `ioredis`)
- **Авторизация:** Telegram initData + HMAC-SHA256 валидация (библиотека `@telegram-apps/init-data-node`)
- **Payments:** Telegram Bot API (Stars + Stripe через WebApp)
- **Деплой:** Yandex Cloud Serverless Containers

### Frontend (Mini App)
- **Framework:** React 18 + Vite
- **Telegram SDK:** `@telegram-apps/sdk-react`
- **Стили:** Tailwind CSS
- **Состояние:** Zustand
- **HTTP клиент:** Axios
- **Деплой:** Yandex Cloud Object Storage (статика) + API Gateway

### Инфраструктура
- **CI/CD:** GitHub Actions + yc-actions/yc-sls-container-deploy
- **Мониторинг:** Sentry (ошибки) + Yandex Cloud Logging + Telegram-алерт бот
- **Логирование:** Winston → stdout (подхватывает Yandex Cloud Logging)
- **Контейнеризация:** Docker → Yandex Container Registry (cr.yandex)
- **Секреты:** Yandex Lockbox (вместо .env на сервере)

---

## 🗄️ Схема базы данных

### Таблица `users`
```sql
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  telegram_id     BIGINT UNIQUE NOT NULL,
  username        VARCHAR(64),
  first_name      VARCHAR(128),
  language_code   VARCHAR(8) DEFAULT 'ru',
  credits         INTEGER NOT NULL DEFAULT 20,  -- стартовые кредиты
  invited_by      BIGINT REFERENCES users(telegram_id),
  referral_code   VARCHAR(16) UNIQUE NOT NULL,
  is_banned       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Таблица `tasks`
```sql
CREATE TABLE tasks (
  id              SERIAL PRIMARY KEY,
  poyo_task_id    VARCHAR(64) UNIQUE NOT NULL,  -- task_id от PoYo API
  user_id         INTEGER REFERENCES users(id) NOT NULL,
  model_id        VARCHAR(64) NOT NULL,          -- идентификатор модели PoYo
  category        VARCHAR(16) NOT NULL,          -- 'image' | 'video' | 'music'
  prompt          TEXT,
  params          JSONB DEFAULT '{}',            -- доп. параметры запроса
  status          VARCHAR(16) DEFAULT 'pending', -- pending|processing|finished|failed
  result_url      TEXT,                          -- URL файла (действует 24ч от PoYo)
  result_saved_url TEXT,                         -- наш S3/сохранённый URL
  credits_cost    INTEGER NOT NULL,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
```

### Таблица `transactions`
```sql
CREATE TABLE transactions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) NOT NULL,
  type            VARCHAR(16) NOT NULL,  -- 'purchase'|'spend'|'refund'|'bonus'|'referral'
  credits_delta   INTEGER NOT NULL,      -- положительное = пополнение, отрицательное = списание
  credits_before  INTEGER NOT NULL,
  credits_after   INTEGER NOT NULL,
  description     TEXT,
  task_id         INTEGER REFERENCES tasks(id),
  payment_id      VARCHAR(128),          -- Telegram payment_charge_id
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Таблица `referrals`
```sql
CREATE TABLE referrals (
  id              SERIAL PRIMARY KEY,
  referrer_id     INTEGER REFERENCES users(id) NOT NULL,
  referred_id     INTEGER REFERENCES users(id) UNIQUE NOT NULL,
  bonus_credited  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 💳 Кредитная система

- **1 кредит = $0.005 (½ цента)** — как у PoYo.ai
- **Стартовый бонус:** 20 кредитов при регистрации
- **Реферальный бонус:** 10 кредитов рефереру + 10 кредитов новому пользователю
- **Пакеты для покупки:**

| Пакет       | Кредиты | Цена    | Цена за кредит |
|-------------|---------|---------|----------------|
| Стартовый   | 200     | $1.00   | $0.005         |
| Базовый     | 600     | $2.50   | $0.0042        |
| Популярный  | 1 500   | $6.00   | $0.004         |
| Профи       | 4 000   | $15.00  | $0.00375       |
| Максимум    | 10 000  | $35.00  | $0.0035        |

- Резервировать кредиты при отправке задачи (статус `pending`)
- Списывать фактическую стоимость при `finished`
- Возвращать при `failed`

---

## 🤖 Модели PoYo.ai

### Image API (10 моделей)
| model_id            | Название          | Кредиты | Цена USD |
|---------------------|-------------------|---------|----------|
| `gpt-image-1-5`     | GPT Image 1.5     | 2       | $0.010   |
| `gpt-4o-image`      | GPT-4o Image      | 4       | $0.020   |
| `nano-banana-2`     | Nano Banana 2     | 5       | $0.025   |
| `nano-banana-pro`   | Nano Banana Pro   | 18      | $0.090   |
| `nano-banana`       | Nano Banana       | 5       | $0.025   |
| `seedream-4-5`      | Seedream 4.5      | 5       | $0.025   |
| `seedream-5-0-lite` | Seedream 5.0 Lite | 5       | $0.025   |
| `grok-imagine`      | Grok Imagine      | 6       | $0.030   |
| `z-image`           | Z-Image           | 2       | $0.010   |
| `flux-2`            | FLUX.2            | 6       | $0.030   |

### Video API (21 модель)
| model_id                  | Название                 | Кредиты/ед    | Цена USD        |
|---------------------------|--------------------------|---------------|-----------------|
| `sora-2-official`         | Sora 2 Official          | 48/4с, 96/8с  | $0.24–$1.20     |
| `sora-2`                  | Sora 2                   | от 20/4с      | от $0.10        |
| `sora-2-pro`              | Sora 2 Pro               | от 30/4с      | от $0.15        |
| `veo-3-1`                 | Veo 3.1                  | от 50         | от $0.25        |
| `kling-2-1`               | Kling 2.1                | 30/5с std     | $0.15–$0.55     |
| `kling-2-6`               | Kling 2.6                | 8/сек 720p    | $0.040/сек      |
| `kling-2-5-turbo-pro`     | Kling 2.5 Turbo Pro      | 42/5с         | $0.210          |
| `kling-3`                 | Kling 3.0                | 27/сек        | $0.135/сек      |
| `kling-2-6-motion-control`| Kling 2.6 Motion Control | 8/сек 720p    | $0.040/сек      |
| `kling-3-0-motion-control`| Kling 3.0 Motion Control | 9/сек 720p    | $0.045/сек      |
| `seedance-1-pro`          | Seedance 1.0 Pro         | от 9          | от $0.045       |
| `seedance-1-5-pro`        | Seedance 1.5 Pro         | от 9/480p 4с  | $0.045–$0.320   |
| `wan-2-2-fast`            | Wan 2.2 Fast             | 6             | $0.030          |
| `wan-2-5`                 | Wan 2.5                  | 30/5с         | $0.150          |
| `wan-2-6`                 | Wan 2.6                  | от 30         | от $0.150       |
| `wan-animate`             | Wan Animate              | от 30         | от $0.150       |
| `hailuo-02`               | Hailuo 02                | от 35         | от $0.175       |
| `hailuo-2-3`              | Hailuo 2.3               | 35/6с 480p    | $0.175–$0.350   |
| `runway-gen-4-5`          | Runway Gen-4.5           | 75/5с         | $0.375          |
| `grok-imagine-video`      | Grok Imagine (видео)     | 6             | $0.030          |

### Music API (15 инструментов)
| model_id                  | Название                 | Кредиты | Цена USD |
|---------------------------|--------------------------|---------|----------|
| `generate-music`          | AI Music (Generate)      | 20      | $0.100   |
| `extend-music`            | Extend Music             | 20      | $0.100   |
| `upload-and-cover-audio`  | Upload & Cover Audio     | 20      | $0.100   |
| `upload-and-extend-audio` | Upload & Extend Audio    | 20      | $0.100   |
| `add-instrumental`        | Add Instrumental         | 20      | $0.100   |
| `add-vocals`              | Add Vocals               | 20      | $0.100   |
| `replace-section`         | Replace Section          | 10      | $0.050   |
| `vocal-remover`           | Vocal Remover            | 15      | $0.075   |
| `create-music-video`      | AI Music Video           | 4       | $0.020   |
| `generate-lyrics`         | Generate Lyrics          | 1       | $0.005   |
| `get-timestamped-lyrics`  | Timestamped Lyrics       | 1       | $0.005   |
| `boost-music-style`       | Boost Music Style        | 1       | $0.005   |
| `generate-music-cover`    | Generate Music Cover     | 1       | $0.005   |
| `generate-persona`        | Generate Persona         | 1       | $0.005   |
| `convert-to-wav`          | Convert to WAV           | 1       | $0.005   |

---

## 🌐 PoYo.ai API — интеграция

### Base URL
```
https://api.poyo.ai
```

### Аутентификация
```
Authorization: Bearer YOUR_POYO_API_KEY
```

### Отправка задачи
```http
POST /api/generate/submit
Content-Type: application/json

{
  "model": "gpt-4o-image",
  "callback_url": "https://api.yourdomain.com/webhook/poyo",
  "input": {
    "prompt": "...",
    "size": "1:1"
  }
}
```
Ответ: `{ "data": { "task_id": "task-xxx", "status": "not_started" } }`

### Проверка статуса (polling fallback)
```http
GET /api/generate/status/{task_id}
```
Статусы: `not_started` → `processing` → `finished` | `failed`

### Webhook (рекомендован)
PoYo шлёт POST на `callback_url` когда задача завершена:
```json
{
  "task_id": "task-xxx",
  "status": "finished",
  "files": [{ "file_url": "https://storage.poyo.ai/...", "file_type": "image" }]
}
```
**Важно:** файлы живут 24 часа — нужно сразу скачать и переслать пользователю.

---

## 📱 Экраны Mini App

1. **Главная** — 3 категории (Image / Video / Music) с превью примеров
2. **Каталог моделей** — карточки: название, описание, цена в кредитах, скидка
3. **Экран генерации** — поле промпта + параметры конкретной модели + кнопка «Генерировать»
4. **Прогресс** — анимация ожидания + статус
5. **Результат** — превью + кнопки «Скачать» / «Поделиться» / «Сгенерировать ещё»
6. **История** — список задач пользователя с превью и статусами
7. **Баланс** — текущие кредиты + пакеты для пополнения
8. **Профиль** — реферальная ссылка + статистика + история транзакций

---

## 🔒 Безопасность

- Все запросы к Backend API проходят валидацию Telegram initData (HMAC-SHA256)
- PoYo API ключ хранится только в env-переменных сервера, не в коде
- Rate limiting: 10 запросов/мин на пользователя (Redis)
- Webhook от PoYo верифицировать по подписи или IP-whitelist
- Не хранить настоящие токены в репозитории (только .env.example)

---

## 📂 Структура проекта

```
tg-miniapp/
├── CONTEXT.md           ← этот файл
├── TASKS.md             ← задачи для Cowork
├── .env.example         ← шаблон для локальной разработки (без секретов!)
├── docker-compose.yml   ← локальная разработка (postgres + valkey)
├── backend/
│   ├── src/
│   │   ├── index.ts         ← точка входа Express
│   │   ├── bot/             ← Telegraf handlers
│   │   ├── routes/          ← API endpoints
│   │   ├── services/
│   │   │   ├── poyo.ts      ← PoYo API клиент
│   │   │   ├── credits.ts   ← логика кредитов
│   │   │   └── queue.ts     ← Valkey очередь задач
│   │   ├── models/          ← TypeScript типы + DB запросы
│   │   ├── middleware/      ← auth, rate limit, errors
│   │   └── config/          ← env, constants
│   ├── migrations/          ← SQL миграции
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile           ← образ → YC Container Registry (cr.yandex/...)
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   ├── store/
│   │   ├── api/
│   │   └── constants/
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── infra/
│   └── terraform/           ← IaC: все YC ресурсы кодом
│       ├── main.tf           ← провайдер yandex-cloud/yandex
│       ├── postgres.tf       ← Managed PostgreSQL кластер
│       ├── valkey.tf         ← Managed Valkey кластер
│       ├── container.tf      ← Serverless Container + Registry
│       ├── storage.tf        ← Object Storage bucket для фронтенда
│       ├── gateway.tf        ← API Gateway (домены)
│       ├── lockbox.tf        ← секреты Lockbox
│       ├── variables.tf
│       └── outputs.tf
└── .github/
    └── workflows/
        └── deploy.yml        ← build → push cr.yandex → deploy Serverless Container
```

---

## ☁️ Yandex Cloud — конфигурация ресурсов

### Serverless Container (backend)
```
Память:       512 MB
CPU:          1 core (100% fraction)
Concurrency:  8 одновременных запросов на инстанс
Timeout:      30s (для долгих webhook-ов)
Provisioned:  1 инстанс (избегаем cold start)
Image:        cr.yandex/{REGISTRY_ID}/tg-miniapp-backend:{git_sha}
```

### Managed PostgreSQL
```
Версия:       PostgreSQL 16
Класс хоста:  s3-c2-m8 (2 vCPU, 8 GB RAM) — старт
Хосты:        1 (для старта, потом 3 для HA)
Диск:         50 GB SSD
Бэкапы:       автоматически, 7 дней
```

### Managed Valkey™ (Redis-совместимый)
```
Версия:       Valkey 8.0
Класс хоста:  hm3-c2-m8 (2 vCPU, 8 GB RAM)
Хосты:        1 (для старта)
Диск:         10 GB
Персистентность: RDB снапшоты
```

### Object Storage (фронтенд)
```
Bucket:       tg-miniapp-frontend
Доступ:       Публичный (для статики)
Хостинг:      Включён (index.html как default)
CDN:          Через API Gateway с кастомным доменом
```

### Lockbox (секреты)
Все секреты хранятся в Yandex Lockbox, НЕ в переменных окружения контейнера напрямую.
Serverless Container получает их через привязанный Service Account.

```
Секрет: tg-miniapp-secrets
  BOT_TOKEN            ← Telegram Bot токен
  POYO_API_KEY         ← PoYo.ai API ключ
  POYO_WEBHOOK_SECRET  ← секрет для верификации webhook
  DATABASE_URL         ← строка подключения к PostgreSQL
  REDIS_URL            ← строка подключения к Valkey
  JWT_SECRET           ← секретный ключ для JWT
  ALERT_BOT_TOKEN      ← токен бота для алертов
  ALERT_CHAT_ID        ← chat_id для алертов
```

---

## ⚙️ Переменные окружения (только для локальной разработки)

В продакшне все секреты берутся из Yandex Lockbox автоматически.
Локально — из `.env` файла:

```env
# Telegram
BOT_TOKEN=           # от @BotFather
WEBAPP_URL=          # URL фронтенда Mini App

# PoYo.ai
POYO_API_KEY=        # от poyo.ai/dashboard/api-key
POYO_BASE_URL=https://api.poyo.ai
POYO_WEBHOOK_SECRET= # для верификации webhook

# База данных (локальная через docker-compose)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tgapp

# Valkey (локальная через docker-compose)
REDIS_URL=redis://localhost:6379

# Сервер
PORT=3000
NODE_ENV=development
WEBHOOK_BASE_URL=    # ngrok URL для локальной разработки с webhook

# Безопасность
JWT_SECRET=          # случайная строка 32+ символа

# Алерты
ALERT_BOT_TOKEN=
ALERT_CHAT_ID=
```

---

## 📌 Соглашения по коду

- Язык: TypeScript strict mode
- Комментарии: на русском
- API responses: всегда `{ success: boolean, data?: any, error?: string }`
- Ошибки: кастомный класс `AppError` с кодом и сообщением
- Логирование: Winston с уровнями `error / warn / info / debug`
- Тесты: Jest (хотя бы для сервисов credits и poyo)
