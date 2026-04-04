# TASKS.md — Задачи для Cowork

> Перед каждой задачей прочитай CONTEXT.md.
> Выполняй задачи последовательно. Отмечай выполненные: [ ] → [x]

---

## ФАЗА 1 — Инфраструктура и авторизация

### Задача 1.1 — Инициализация монорепозитория
- [x] Создай структуру папок как описано в CONTEXT.md (backend/, frontend/, .github/)
- [x] Создай `.env.example` с переменными из раздела «Переменные окружения»
- [x] Создай `docker-compose.yml` с сервисами: postgres, redis, backend, frontend
- [x] Создай `.gitignore` для Node.js проекта

**Ожидаемый результат:** готовая структура папок, можно запустить `docker-compose up`

---

### Задача 1.2 — Backend: инициализация Express + TypeScript
- [x] В папке `backend/` инициализируй `npm` проект с TypeScript
- [x] Установи зависимости: `express`, `cors`, `helmet`, `dotenv`, `pg`, `ioredis`, `winston`, `telegraf`, `@telegram-apps/init-data-node`, `axios`
- [x] Установи dev-зависимости: `typescript`, `ts-node-dev`, `@types/*`, `jest`, `ts-jest`
- [x] Создай `tsconfig.json` со strict mode
- [x] Создай точку входа `src/index.ts` с базовым Express сервером на порту из env
- [x] Добавь middleware: `cors`, `helmet`, `express.json()`
- [x] Добавь healthcheck endpoint `GET /health` → `{ status: "ok", timestamp }`
- [x] Настрой `package.json` scripts: `dev`, `build`, `start`, `test`
- [x] Создай `Dockerfile` для backend

**Ожидаемый результат:** `npm run dev` запускает сервер, `GET /health` возвращает 200

---

### Задача 1.3 — База данных: миграции
- [x] Создай папку `backend/migrations/`
- [x] Создай файл `001_initial.sql` с таблицами из CONTEXT.md:
  - `users` (со всеми полями включая referral_code)
  - `tasks`
  - `transactions`
  - `referrals`
- [x] Создай индексы: `users(telegram_id)`, `tasks(poyo_task_id)`, `tasks(user_id)`, `transactions(user_id)`
- [x] Создай скрипт `src/config/db.ts` — pool подключения к PostgreSQL через env
- [x] Создай скрипт `scripts/migrate.ts` — применяет SQL миграции по порядку

**Ожидаемый результат:** `npm run migrate` создаёт все таблицы в БД

---

### Задача 1.4 — Авторизация через Telegram initData
- [x] Создай `src/middleware/auth.ts`
- [x] Реализуй валидацию Telegram `initData` через HMAC-SHA256 (библиотека `@telegram-apps/init-data-node`)
- [x] Из валидного `initData` извлекай `user` объект (telegram_id, username, first_name)
- [x] При первом запросе — создавай пользователя в БД (upsert), генерируй `referral_code`
- [x] Прикрепляй `user` к `req.user` для следующих middleware
- [x] Обрабатывай кейс `?ref=CODE` при первом входе (реферальная регистрация)
- [x] Верни 401 если initData невалидна или устарела (>24 часа)

**Ожидаемый результат:** middleware корректно авторизует запросы от Telegram Mini App

---

### Задача 1.5 — Telegram Bot базовые команды
- [x] Создай `src/bot/index.ts` — инициализация Telegraf с BOT_TOKEN
- [x] Команда `/start` — приветственное сообщение + кнопка «Открыть приложение» (WebApp button с WEBAPP_URL)
- [x] Команда `/balance` — текущий баланс кредитов пользователя
- [x] Команда `/help` — список команд
- [x] Обработчик реферальных ссылок: `/start ref_CODE` → регистрация с рефералом
- [x] Настрой webhook для бота (setWebhook на `/webhook/telegram`)
- [x] Запусти бота вместе с Express сервером

**Ожидаемый результат:** бот отвечает на команды, кнопка открывает Mini App

---

## ФАЗА 2 — Интеграция PoYo.ai API

### Задача 2.1 — PoYo API клиент
- [x] Создай `src/services/poyo.ts`
- [x] Класс `PoyoClient` с методами:
  - `submitTask(model: string, input: object, callbackUrl: string): Promise<string>` — возвращает task_id
  - `getStatus(taskId: string): Promise<TaskStatus>` — возвращает статус и файлы
- [x] Типизируй ответы: `PoyoSubmitResponse`, `PoyoStatusResponse`, `PoyoFile`
- [x] Логируй каждый вызов (model, task_id, latency, cost)
- [x] Обрабатывай ошибки PoYo API (retry на 5xx, не retry на 4xx)
- [x] Экспортируй синглтон `poyoClient`

**Ожидаемый результат:** можно вызвать `poyoClient.submitTask(...)` и получить task_id

---

### Задача 2.2 — Сервис кредитов
- [x] Создай `src/services/credits.ts`
- [x] Методы:
  - `getBalance(userId: number): Promise<number>`
  - `reserve(userId: number, amount: number, taskId: number): Promise<void>` — блокирует кредиты
  - `charge(userId: number, amount: number, taskId: number): Promise<void>` — окончательное списание
  - `refund(userId: number, amount: number, taskId: number): Promise<void>` — возврат при ошибке
  - `addCredits(userId: number, amount: number, type: string, paymentId?: string): Promise<void>`
- [x] Все операции записывай в таблицу `transactions`
- [x] Используй транзакции PostgreSQL для атомарности
- [x] Выбрасывай `InsufficientCreditsError` если баланс недостаточен

**Ожидаемый результат:** кредиты корректно списываются и возвращаются

---

### Задача 2.3 — Redis очередь и webhook обработчик
- [x] Создай `src/services/queue.ts`
- [x] При отправке задачи в PoYo → сохраняй в Redis `task:{poyo_task_id}` = `{ userId, taskId, model, creditsReserved }` с TTL 25ч
- [x] Создай endpoint `POST /webhook/poyo` — принимает callback от PoYo
- [x] В webhook handler:
  1. Получить данные задачи из Redis по `task_id`
  2. Обновить статус в таблице `tasks`
  3. При `finished` — скачать файл, сохранить URL, списать кредиты (`credits.charge`)
  4. При `failed` — вернуть кредиты (`credits.refund`)
  5. Уведомить пользователя через Bot API (`bot.telegram.sendPhoto/sendVideo/sendAudio`)
  6. Удалить запись из Redis
- [x] Fallback polling: фоновый процесс каждые 3 сек проверяет незавершённые задачи (если webhook не пришёл за 5 мин)

**Ожидаемый результат:** пользователь получает уведомление когда генерация завершена

---

### Задача 2.4 — API роуты для генерации
- [x] Создай `src/routes/generate.ts`
- [x] `POST /api/generate` — запуск генерации:
  ```json
  { "model": "gpt-4o-image", "prompt": "...", "params": {} }
  ```
  1. Валидация модели (проверка что model_id существует в списке из CONTEXT.md)
  2. Получить стоимость модели
  3. Проверить и зарезервировать кредиты
  4. Создать запись в `tasks` (status: pending)
  5. Отправить в PoYo API
  6. Сохранить poyo_task_id в задаче и Redis
  7. Вернуть `{ task_id, status: "pending", credits_reserved }`
- [x] `GET /api/tasks` — история задач пользователя (пагинация, limit/offset)
- [x] `GET /api/tasks/:taskId` — статус конкретной задачи

**Ожидаемый результат:** можно отправить запрос на генерацию и получать статус

---

### Задача 2.5 — Rate limiting
- [x] Создай `src/middleware/rateLimit.ts`
- [x] Через Redis: максимум 10 запросов на генерацию в минуту на пользователя
- [x] Максимум 100 API запросов в минуту на пользователя (общий)
- [x] При превышении — 429 с заголовком `Retry-After`
- [x] Применить middleware ко всем `/api/generate` роутам

---

## ФАЗА 3 — Frontend (Mini App)

### Задача 3.1 — Инициализация React приложения
- [x] В папке `frontend/` создай Vite + React + TypeScript проект
- [x] Установи зависимости: `@telegram-apps/sdk-react`, `zustand`, `axios`, `tailwindcss`
- [x] Настрой Tailwind CSS
- [x] В `src/main.tsx` инициализируй Telegram SDK: `retrieveLaunchParams()`, `mockTelegramEnv` для разработки
- [x] Настрой axios клиент (`src/api/client.ts`) — автоматически добавляет `Authorization: Bearer {initData}` к каждому запросу
- [x] Создай `src/constants/models.ts` — полный список всех 46 моделей из CONTEXT.md с категориями, ценами, описаниями

**Ожидаемый результат:** `npm run dev` открывает Mini App, Telegram SDK инициализирован

---

### Задача 3.2 — Zustand сторы
- [x] `src/store/userStore.ts` — `{ user, balance, fetchBalance }`
- [x] `src/store/tasksStore.ts` — `{ tasks, currentTask, fetchTasks, submitTask }`
- [x] `src/store/uiStore.ts` — `{ currentPage, selectedModel, setPage, setModel }`

---

### Задача 3.3 — Страница: Главная (Home)
- [x] `src/pages/Home.tsx`
- [x] Три карточки категорий: Image, Video, Music с иконками и количеством моделей
- [x] Текущий баланс кредитов в шапке
- [x] Кнопка перехода в историю
- [x] Адаптирована под тему Telegram (светлая/тёмная через `useTelegramTheme`)

---

### Задача 3.4 — Страница: Каталог моделей (Catalog)
- [x] `src/pages/Catalog.tsx`
- [x] Фильтрация по категории (Image / Video / Music)
- [x] Карточка модели: название, провайдер, стоимость в кредитах, значок скидки (если есть)
- [x] Поиск по названию модели
- [x] При клике — переход на страницу генерации с этой моделью

---

### Задача 3.5 — Страница: Генерация (Generate)
- [x] `src/pages/Generate.tsx`
- [x] Показывает выбранную модель и её стоимость
- [x] Textarea для промпта
- [x] Дополнительные параметры в зависимости от категории:
  - Image: соотношение сторон (1:1, 16:9, 9:16, 4:3)
  - Video: длительность (5с / 10с), разрешение (720p / 1080p)
  - Music: стиль, вокал/инструментал
- [x] Кнопка «Сгенерировать» — показывает стоимость, деактивирована если недостаточно кредитов
- [x] Использует `Telegram.WebApp.MainButton` для кнопки генерации
- [x] После отправки — переход на экран прогресса

---

### Задача 3.6 — Страница: Прогресс (Progress)
- [x] `src/pages/Progress.tsx`
- [x] Анимированный спиннер / индикатор прогресса
- [x] Текст «Генерация может занять 1-3 минуты»
- [x] Polling статуса задачи каждые 3 секунды (пока статус не `finished`/`failed`)
- [x] При `finished` — показать превью результата + кнопки «Скачать», «Поделиться», «Ещё»
- [x] При `failed` — показать ошибку + возврат кредитов + кнопка «Попробовать снова»

---

### Задача 3.7 — Страница: История (History)
- [x] `src/pages/History.tsx`
- [x] Список задач с превью (изображение/видео thumbnail/аудио иконка)
- [x] Статус: pending / processing / ready / failed
- [x] Пагинация (загрузка ещё при скролле вниз)
- [x] Клик на завершённую задачу → полноэкранный просмотр результата

---

### Задача 3.8 — Страница: Баланс (Balance)
- [x] `src/pages/Balance.tsx`
- [x] Текущий баланс (большое число с иконкой кредита)
- [x] Карточки пакетов для покупки (из списка в CONTEXT.md)
- [x] Кнопка «Пополнить» — открывает Telegram invoice через `Telegram.WebApp.openInvoice`
- [x] История последних транзакций (последние 10)

---

### Задача 3.9 — Страница: Профиль (Profile)
- [x] `src/pages/Profile.tsx`
- [x] Аватар и имя пользователя (из Telegram)
- [x] Реферальная ссылка с кнопкой «Скопировать» и «Поделиться»
- [x] Статистика: всего генераций, потрачено кредитов, приглашено друзей
- [x] Кнопка «Поддержка»

---

## ФАЗА 4 — Монетизация

### Задача 4.1 — Telegram Payments (Stars)
- [x] Создай `src/routes/payments.ts` в backend
- [x] `POST /api/payments/create-invoice` — создаёт invoice через Bot API `sendInvoice`
  - Принимает: `package_id` (один из пакетов кредитов)
  - Создаёт Telegram Stars invoice
  - Возвращает `invoice_url` для `openInvoice` в Mini App
- [x] Обработчик `pre_checkout_query` в боте — всегда отвечаем `answerPreCheckoutQuery(true)`
- [x] Обработчик `successful_payment` в боте:
  1. Получить `payment_charge_id` и `invoice_payload`
  2. Начислить кредиты пользователю (`credits.addCredits`)
  3. Записать транзакцию типа `purchase`
  4. Отправить подтверждение пользователю

---

### Задача 4.2 — Реферальная программа
- [x] При регистрации через реферальную ссылку:
  1. Найти пользователя-реферера по коду
  2. Создать запись в `referrals`
  3. Начислить по 10 кредитов обоим (через `credits.addCredits` с type='referral')
- [x] `GET /api/referrals` — статистика рефералов пользователя
- [x] Защита от накрутки: один telegram_id = одна регистрация

---

## ФАЗА 5 — Yandex Cloud: инфраструктура и деплой

### Задача 5.1 — Terraform: описание инфраструктуры YC
- [x] Создай `infra/terraform/main.tf` — провайдер `yandex-cloud/yandex`, укажи `folder_id` и `zone`
- [x] Создай `infra/terraform/postgres.tf` — Managed PostgreSQL 16:
  ```hcl
  resource "yandex_mdb_postgresql_cluster" "tgapp" {
    name        = "tgapp-postgres"
    environment = "PRODUCTION"
    config { version = "16" resources { ... } }
  }
  ```
- [x] Создай `infra/terraform/valkey.tf` — Managed Valkey (Redis-совместимый):
  ```hcl
  resource "yandex_mdb_redis_cluster" "tgapp" {
    name        = "tgapp-valkey"
    environment = "PRODUCTION"
    config { version = "8.0" }
  }
  ```
- [x] Создай `infra/terraform/container.tf` — Container Registry + Serverless Container:
  ```hcl
  resource "yandex_container_registry" "tgapp" { name = "tgapp-registry" }
  resource "yandex_serverless_container" "backend" {
    name   = "tgapp-backend"
    memory = 512
    image  { url = "cr.yandex/${yandex_container_registry.tgapp.id}/backend:latest" }
    secrets { ... }  # из Lockbox
    provision_policy { min_instances = 1 }
  }
  ```
- [x] Создай `infra/terraform/lockbox.tf` — секрет со всеми переменными из CONTEXT.md
- [x] Создай `infra/terraform/storage.tf` — Object Storage bucket для фронтенда (публичный, static website)
- [x] Создай `infra/terraform/gateway.tf` — API Gateway для домена фронтенда и бэкенда
- [x] Создай `infra/terraform/outputs.tf` — выводи: container_url, frontend_url, registry_id

**Ожидаемый результат:** `terraform apply` создаёт все ресурсы в YC Console

---

### Задача 5.2 — Dockerfile для backend
- [x] Создай `backend/Dockerfile`:
  ```dockerfile
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:20-alpine
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  EXPOSE 3000
  CMD ["node", "dist/index.js"]
  ```
- [x] Убедись что `PORT` читается из env (YC Serverless Containers передаёт его автоматически)
- [x] Добавь `.dockerignore`: `node_modules`, `.env`, `src`, `*.md`
- [ ] Протестируй локально: `docker build -t tgapp-backend . && docker run -p 3000:3000 tgapp-backend`

---

### Задача 5.3 — GitHub Actions CI/CD
- [x] Создай `.github/workflows/deploy.yml`
- [ ] Добавь GitHub Secrets: `YC_SA_JSON_CREDENTIALS` (JSON авторизованного ключа сервис-аккаунта), `YC_REGISTRY_ID`, `YC_FOLDER_ID`
- [x] Пропиши pipeline:
  ```yaml
  name: Deploy to Yandex Cloud
  on:
    push:
      branches: [main]
  jobs:
    deploy:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4

        # Тесты
        - name: Run tests
          run: cd backend && npm ci && npm test

        # Получаем IAM токен для cr.yandex
        - name: Get IAM token
          id: iam
          uses: yc-actions/yc-iam-token-fed@v1
          with:
            yc-sa-json-credentials: ${{ secrets.YC_SA_JSON_CREDENTIALS }}

        # Логин в Container Registry
        - name: Docker login to cr.yandex
          uses: docker/login-action@v3
          with:
            registry: cr.yandex
            username: iam
            password: ${{ steps.iam.outputs.token }}

        # Build + push backend
        - name: Build and push backend
          env:
            IMAGE: cr.yandex/${{ secrets.YC_REGISTRY_ID }}/backend:${{ github.sha }}
          run: |
            docker build -t $IMAGE ./backend
            docker push $IMAGE

        # Deploy Serverless Container
        - name: Deploy backend
          uses: yc-actions/yc-sls-container-deploy@v4
          with:
            yc-sa-json-credentials: ${{ secrets.YC_SA_JSON_CREDENTIALS }}
            container-name: tgapp-backend
            folder-id: ${{ secrets.YC_FOLDER_ID }}
            revision-image-url: cr.yandex/${{ secrets.YC_REGISTRY_ID }}/backend:${{ github.sha }}
            revision-cores: 1
            revision-memory: 512Mb
            revision-concurrency: 8
            revision-execution-timeout: 30

        # Build + deploy frontend в Object Storage
        - name: Build and deploy frontend
          env:
            YC_TOKEN: ${{ steps.iam.outputs.token }}
          run: |
            cd frontend && npm ci && npm run build
            # Загрузка в Object Storage через yc CLI или aws s3 sync (YC совместим с S3 API)
            aws s3 sync dist/ s3://tgapp-frontend \
              --endpoint-url https://storage.yandexcloud.net \
              --delete
  ```

**Ожидаемый результат:** push в `main` → автоматический деплой backend + frontend

---

### Задача 5.4 — Локальная разработка с docker-compose
- [x] Создай `docker-compose.yml` для локальной среды:
  ```yaml
  version: '3.9'
  services:
    postgres:
      image: postgres:16-alpine
      environment:
        POSTGRES_DB: tgapp
        POSTGRES_PASSWORD: postgres
      ports: ["5432:5432"]

    valkey:
      image: valkey/valkey:8-alpine
      ports: ["6379:6379"]
  ```
- [x] Инструкция: `docker-compose up -d` → локальные Postgres + Valkey
- [x] Для тестирования webhook'ов от Telegram и PoYo — использовать `ngrok http 3000`
- [x] Добавь npm script `dev:tunnel`: запускает ngrok и автоматически устанавливает webhook

---

### Задача 5.5 — Логирование и мониторинг
- [x] Настрой Winston: вывод в JSON в stdout (YC Logging подхватывает автоматически)
- [x] Логируй: каждый API запрос (метод, путь, user_id, latency), каждый вызов PoYo, каждую операцию с кредитами
- [x] Telegram-алерт: при `logger.error(...)` — POST в Telegram Bot API (служебный чат)
- [x] Healthcheck endpoint `/health`:
  ```json
  { "db": "ok", "redis": "ok", "uptime": 1234, "memoryMB": 87, "version": "1.0.0" }
  ```
- [ ] В YC Console: настрой Log Group для контейнера, задай retention 30 дней (вручную)

---

### Задача 5.6 — Финальное тестирование
- [x] Написать тесты для `src/services/credits.ts` (Jest + pg mock)
- [x] Написать тесты для `src/middleware/auth.ts` (валидация initData)
- [x] Написать тест для `src/services/poyo.ts` (mock axios)
- [x] E2E сценарий: регистрация → выбор модели → генерация изображения → получение результата → баланс уменьшился

---

## 📋 Быстрый старт для Cowork

Если начинаешь работу над проектом, выполни первым делом:

```
1. Прочитай CONTEXT.md полностью
2. Проверь что установлены: Node.js 20+, Docker, Terraform, yc CLI
3. Скопируй .env.example в .env и заполни реальными значениями
4. Запусти docker-compose up -d (локальные Postgres + Valkey)
5. Начни с Задачи 1.1 и иди последовательно
6. Фазу 5 выполняй в конце, когда приложение работает локально
```

При создании любого файла с кодом:
- Всегда TypeScript, никогда plain JavaScript
- Комментарии на русском
- Экспортируй типы рядом с функциями
- Используй `async/await`, не `.then().catch()`
- Секреты — только через env, никогда хардкодом
