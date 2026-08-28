# Rick and Morty — Backend

Серверная часть приложения «Рик и Морти»: NestJS-сервис поверх публичного
[The Rick and Morty API](https://rickandmortyapi.com/documentation). Фронтенд ходит только сюда;
внешний API и Gemini вызываются исключительно с сервера.

Фронтенд: [rick-morty-frontend](../rick-morty-frontend) · Прод: `https://api.rick-morty.welt-on.com` · Swagger: `/api/docs`

## Что делает

| Метод | Путь | Описание |
|---|---|---|
| GET | `/characters?page&name&status&species&type&gender` | список персонажей, 20 на страницу |
| GET | `/characters/:id` | персонаж + его эпизоды (батч-запрос) |
| GET | `/episodes?page&name&episode` | список эпизодов |
| GET | `/episodes/:id` | эпизод + персонажи |
| GET | `/locations?page&name&type&dimension` | список локаций |
| GET | `/locations/:id` | локация + жители |
| GET | `/search?q=` | поиск по всем трём типам сразу (по 8 первых + total) |
| GET | `/ai/characters/:id/description` | описание персонажа от Gemini, кэшируется в Postgres |
| GET | `/health` | проверка живости (k8s-пробы) |

Единый формат списков: `{ items, page, pages, total, hasNext, hasPrev }`. Пустой результат — `items: []`,
а не ошибка (внешний API отвечает 404 на пустой поиск — это маппится в пустую страницу).

## Стек и почему он

- **NestJS 12 (ESM, TypeScript)** — модульная структура, DI, декларативная валидация DTO, Swagger из коробки.
  Тот же стек, что в остальных проектах автора, поэтому деплой-обвязка и паттерны переиспользованы.
- **Prisma 7 + PostgreSQL** — БД нужна только для кэша AI-описаний; Prisma даёт типобезопасный доступ и
  миграции, которые прогоняются initContainer'ом при деплое.
- **`@google/genai` (Gemini 3.6 Flash)** — бесплатный tier, ключ уже был, проверенная интеграция.
  Задание предлагает ChatGPT «например», провайдер не принципиален.
- **Vitest + oxlint** — дефолт Nest 12 CLI, быстрые.
- **Docker + k3s + GitHub Actions** — собственный сервер уже есть; тот же пайплайн, что у других проектов.

## Запуск локально

Требования: Node 22+, доступ к Postgres. В dev-режиме сервис сам поднимает SSH-туннель к БД на сервере
(`src/ssh-tunnel.ts`), поэтому нужен SSH-ключ и переменные `SSH_*`. Если у вас локальный Postgres —
уберите `SSH_*` из `.env`, укажите свой `DATABASE_URL` и закомментируйте вызов `openSSHTunnel()` в `src/main.ts`.

```bash
npm install
cp .env.example .env          # заполнить DATABASE_URL, SSH_*, при желании GEMINI_API_KEY
npm run prisma:generate
npm run start:dev             # http://localhost:4009, Swagger на /api/docs
```

Миграции: `npx prisma migrate deploy` (через открытый туннель или напрямую к БД).

Проверка: `npm test` (unit), `npm run lint`, `npm run build`.

```bash
curl 'localhost:4009/characters?name=rick&status=alive'
curl  localhost:4009/search?q=morty
```

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Postgres для кэша AI-описаний |
| `PORT` | порт HTTP (4009) |
| `FRONTEND_URL` | origin для CORS |
| `SSH_HOST/PORT/USER/LOCAL_PORT/DST_HOST/DST_PORT/KEY_NAME` | SSH-туннель к БД (только dev) |
| `RICK_API_URL` | базовый URL внешнего API (по умолчанию публичный) |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_THINKING_LEVEL`, `GEMINI_THINKING_BUDGET` | Gemini; без ключа новые описания не генерируются (503), уже сохранённые отдаются из кэша |

## Как устроено

```
src/
  rick-api/     клиент к rickandmortyapi.com: TTL-кэш в памяти (10 мин, не более 500 записей, LRU),
                дедупликация одновременных запросов, таймаут 8 с, один повтор только для
                сетевых ошибок и 5xx (таймауты не повторяются), батчи по 50 id,
                маппинг «сырых» ответов в контракт фронтенда (mappers.ts)
  characters/   контроллер + сервис + DTO с валидацией query-параметров
  episodes/     — // —
  locations/    — // —
  search/       три параллельных запроса, по 8 результатов каждого типа
  ai/           Gemini: промпт из фактов о персонаже → текст → upsert в ai_descriptions;
                одновременные запросы на одного персонажа схлопываются в одну генерацию
  prisma/       PrismaService (pg-адаптер)
  common/       типы контракта, logging-interceptor, exception-filter, helpers для DTO
  ssh-tunnel.ts dev-туннель к БД
```

Контракт ответов (`src/common/types.ts`) один в один повторяется в `src/lib/types.ts` фронтенда — это
единственная «шина» между репозиториями.

## Процесс разработки

1. Сначала зафиксировал контракт API (типы + список эндпоинтов), чтобы фронт и бэк можно было писать параллельно.
2. Написал клиент к внешнему API с кэшем и обработкой краевых случаев (404 = пусто, один id в батче
   возвращается объектом, а не массивом, «unknown»-локации без ссылки).
3. Модули по ресурсам, DTO-валидация, Swagger.
4. AI-модуль с кэшем в БД: Prisma-модель, миграция через `migrate diff` + `migrate deploy`.
5. Smoke-тесты всех эндпоинтов через curl, unit-тесты на мапперы.

## Подходы, которые стоит отметить

- **Backend-for-frontend**: ответы уже в форме, удобной UI (`episodeIds`, `origin.id`, `hasNext`),
  фронт не знает о структуре внешнего API.
- **Кэш + дедупликация in-flight**: пагинация «назад/вперёд» и повторные детальные страницы не бьют во внешний API;
  одновременные одинаковые запросы схлопываются в один.
- **AI-описания генерируются один раз** и живут в Postgres — экономия квоты и мгновенный ответ повторно.
- **Ошибки — это данные для UI**: 400 с перечнем нарушений, 404 с текстом, 502/504 при проблемах upstream,
  503 когда AI не настроен. Фронт различает их и показывает разные состояния.

## Компромиссы

- **20 элементов на страницу** — размер задаёт внешний API; свой page-size стоил бы N запросов на страницу.
- **Кэш в памяти процесса** — при рестарте пода он пуст, размер ограничен 500 URL (LRU); для одного инстанса этого достаточно.
- **`prisma migrate dev` не используется** — он требует shadow-БД и интерактивен; миграции генерируются
  `prisma migrate diff` и применяются `migrate deploy` (как в проде).
- **AI может «галлюцинировать»** сюжетные детали для эпизодических персонажей — в промпте есть инструкция
  честно говорить о нехватке данных, в UI есть дисклеймер.
- **БД используется минимально** (одна таблица). Её можно было бы не заводить, но инфраструктура уже была.

## Известные проблемы

- Первый вызов `/ai/...` для персонажа занимает 10–25 с (gemini-3.6-flash тратит 2–3 тыс. токенов на «мысли» даже при MINIMAL); ограничения квоты Google не обрабатываются
  отдельно — приходит 502 с предложением повторить.
- Параметры «размышлений» зависят от модели: для `gemini-2.5-flash*` — `thinkingBudget: 0`, для `gemini-3*` —
  `thinkingLevel: MINIMAL` (LOW тратит ~900 токенов на «мысли» и не укладывается в лимит); переопределяются `GEMINI_THINKING_LEVEL` / `GEMINI_THINKING_BUDGET`. Ответ, обрезанный по
  `MAX_TOKENS`, не сохраняется — приходит 502 с предложением повторить.
- `prisma@latest` сейчас резолвится в `8.0.0-rc` с другим CLI — в проекте зафиксирован `prisma@7`.
- Локальный запуск завязан на SSH-туннель к серверной БД (см. раздел «Запуск»).

## Деплой

`push` в `main` → GitHub Actions собирает образ, пушит в `registry.welt-on.com`, применяет `k8s/prod/`
(namespace, deployment с initContainer `prisma migrate deploy`, service, ingress с TLS) и ждёт rollout.
Секреты кластера: `rick-morty-backend-secrets` (`DATABASE_URL`, `GEMINI_API_KEY`) и `registry-secret`.
