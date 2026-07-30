# Детсад CRM

Веб-система управления сетью частных детских садов. Текущий объём разработки — **Этап 1 (MVP):
ядро учёта** (филиалы, роли и доступы, семьи и дети, группы, зачисление/перевод/отчисление,
посещаемость и табель, справочники, импорт, базовые отчёты). Биллинг, лиды/продажи и кабинет
родителя — последующие этапы (см. `.claude/plans` в истории разработки для полного ТЗ-контекста).

## Стек

- **API**: NestJS + TypeScript, PostgreSQL через Prisma ORM, Redis/BullMQ для фоновых задач.
- **Web**: React + Vite + TypeScript, PWA для офлайн-совместимого экрана посещаемости.
- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`).

## Локальная разработка

### Требования

- Node.js 20+
- pnpm (`corepack enable` или `npm i -g pnpm`)
- Docker Desktop (Postgres/Redis/MinIO через `docker-compose.yml`)

### Запуск

```bash
pnpm install

# Поднять инфраструктуру (Postgres, Redis, MinIO)
docker compose up -d

# Настроить переменные окружения
cp apps/api/.env.example apps/api/.env

# Применить схему БД и сиды справочников
pnpm prisma:migrate
pnpm prisma:seed

# Запустить API и web в отдельных терминалах
pnpm dev:api
pnpm dev:web
```

API поднимется на `http://localhost:3000/api`, веб — на `http://localhost:5173` (Vite dev-сервер
проксирует `/api` на бэкенд).

### Проверка

```bash
pnpm lint
pnpm test
pnpm build
```

## Структура

```
apps/
  api/     — NestJS backend, Prisma-схема в apps/api/prisma/schema.prisma
  web/     — React (Vite) staff-приложение + PWA
packages/
  shared/  — общие TS-типы и DTO между api и web
```
