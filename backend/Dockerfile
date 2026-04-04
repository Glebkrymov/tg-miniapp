# ── Этап сборки ──────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts

RUN npm run build

# Убираем devDependencies для тонкого продакшн-образа
RUN npm ci --omit=dev --ignore-scripts

# ── Продакшн образ ──────────────────────────────────
FROM node:20-alpine

# Безопасность: non-root пользователь
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Копируем только необходимое
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/migrations ./migrations

# Переключаемся на non-root
USER appuser

# Порт читается из env, по умолчанию 3000
EXPOSE 3000

# Healthcheck — проверяем что сервер отвечает
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "dist/index.js"]
