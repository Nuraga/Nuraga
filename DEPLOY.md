# Деплой демо-версии на VPS

Стек: один VPS, три контейнера (`postgres`, `api`, `web`). `web` — это Caddy:
отдаёт статическую сборку React-приложения и проксирует `/api/*` на `api`,
сам получает и продлевает HTTPS-сертификат Let's Encrypt. Конфиги уже в
репозитории: `docker-compose.prod.yml`, `apps/api/Dockerfile`,
`apps/web/Dockerfile`, `apps/web/Caddyfile`.

Redis и MinIO из dev `docker-compose.yml` здесь намеренно не участвуют —
в коде `apps/api/src` они пока нигде не используются (см. комментарии в
`apps/api/.env.production.example`). Файлы (документы) хранятся на локальном
диске сервера в docker-volume `api_storage`.

Это план для **демо/теста на выдуманных данных**, не для реальных ПДн детей —
пункты вроде автоматизированных бэкапов и переезда на S3 сознательно
оставлены как ручные TODO ниже, не как блокеры запуска.

## 1. Сервер

Рекомендация: **Timeweb Cloud**, тариф "Первый" или аналог (~2 ГБ RAM,
~300–400 ₽/мес хватает для демо), ОС Ubuntu 22.04. Альтернатива — Hetzner
CX22, если удобнее платить зарубежной картой.

На сервере (по SSH):

```bash
curl -fsSL https://get.docker.com | sh
# docker compose plugin ставится вместе с get.docker.com-скриптом на
# современных Ubuntu; проверить: docker compose version
```

## 2. Домен

Купить домен (рекомендация из чата — `detsad-crm.ru`, но проверьте
доступность у регистратора: свободен по DNS-эвристике, не гарантия). Если
регистратор и VPS — один и тот же провайдер (напр. Timeweb), DNS обычно
настраивается в том же личном кабинете.

Создать **A-запись**: `@` (и опционально `www`) → публичный IP сервера.
Подождать распространения DNS (обычно минуты, иногда до пары часов) —
проверить командой `nslookup ваш-домен` с любой машины: должен вернуть IP
сервера. **Это нужно сделать до первого запуска** — Caddy получает
сертификат через HTTP-01 challenge, которому нужен уже резолвящийся домен.

## 3. Код на сервере

```bash
git clone <URL-репозитория> detsad-crm
cd detsad-crm
```

## 4. Секреты

Compose-level (домен, пароль Postgres) — `.env.prod` в корне репо:

```bash
cp .env.prod.example .env.prod
# заполнить DOMAIN=ваш-домен и POSTGRES_PASSWORD (сгенерировать: см. комментарий в файле)
```

Секреты приложения — `apps/api/.env`:

```bash
cp apps/api/.env.production.example apps/api/.env
# заполнить все JWT_*_SECRET, FIELD_ENCRYPTION_KEY, FILE_URL_SECRET
# (команды генерации — прямо в комментариях файла), CORS_ORIGIN=https://ваш-домен
```

`DATABASE_URL` в `apps/api/.env` можно оставить как в примере —
`docker-compose.prod.yml` всё равно переопределяет его на адрес контейнера
`postgres`.

**Важно:** `FIELD_ENCRYPTION_KEY` шифрует медданные детей — потеря ключа
делает их нечитаемыми навсегда. Даже для демо сохраните копию отдельно от
сервера (менеджер паролей и т.п.), не только в `apps/api/.env`.

## 5. Запуск

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Первая сборка займёт несколько минут. `api`-контейнер при каждом старте сам
применяет миграции Prisma (`prisma migrate deploy`) перед запуском сервера.

Проверить:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f web   # смотреть, что Caddy выдал сертификат
```

Открыть `https://ваш-домен` в браузере.

## 6. Сид демо-данных

Схема применяется автоматически, но справочники и суперадмин — через сид:

```bash
docker compose -f docker-compose.prod.yml exec api pnpm exec ts-node prisma/seed.ts
```

Выведет логин `superadmin@detsad.local` и временный пароль
(`ChangeMe123!` по умолчанию в коде сида) — **сменить сразу после первого
входа**, система на публичном IP.

## 7. Дальше вручную (не автоматизировано)

- **Бэкапы Postgres**: `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U detsad detsad_crm > backup.sql`, повесить на cron. То же для volume `api_storage` (загруженные файлы).
- **2FA**: включить для OWNER/ACCOUNTANT/SUPERADMIN аккаунтов после первого логина — поддерживается системой, но не принуждается.
- **Обновление деплоя**: `git pull && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`.
