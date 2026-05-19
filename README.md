# AZONE-AI — сайт `azoneai.ru`

Маркетинговый сайт на `Astro 5` с продуктовыми лендингами, блогом, полнотекстовым поиском (`Pagefind`) и контактной формой через `Yandex Cloud Function`.

## Архитектура

- **Frontend**: статическая генерация (`Astro`, `output: static`, `trailingSlash: always`).
- **Хостинг**: `Yandex Object Storage` (бакет `s3://azoneai.ru`) через S3-совместимый API.
- **Форма заявок**: клиентский `POST` на `PUBLIC_CONTACT_FUNCTION_URL`.
- **Backend формы**: `cloud-function-email/index.js` (Node.js + `nodemailer`) с CORS и валидацией.
- **Поиск**: индекс `Pagefind` генерируется при `npm run build`, UI на странице `/search/`.
- **Аналитика**: Яндекс.Метрика (ID из `PUBLIC_YANDEX_METRIKA_ID` + дополнительный счетчик в `Base.astro`).

## Технологический стек

- `astro` + `@astrojs/tailwind` + `@astrojs/sitemap`
- `tailwindcss`
- `pagefind`
- `@aws-sdk/client-s3`, `@aws-sdk/credential-providers` (кастомный деплой)
- `nodemailer` (в Cloud Function)

## Актуальная структура проекта

```text
azoneai/
  src/
    layouts/
      Base.astro
    pages/
      index.astro
      about.astro
      contact.astro
      search.astro
      privacy.astro
      terms.astro
      404.astro
      blog/
        index.astro
        *.astro
      products/
        index.astro
        [id].astro
    components/
      *.astro
    data/
      products.js
      faq.js
    styles/
      global.css
  public/
    images/
    favicon*
    robots.txt
    AZONE_AI_presentation.pdf
    oprosnik_azoneai.pdf
  scripts/
    add-sitemap-lastmod.mjs
    deploy-s3.mjs
  cloud-function-email/
    index.js
    package.json
    .env.example
  astro.config.mjs
  tailwind.config.mjs
  package.json
```

## Требования

- `Node.js 20+`
- `npm`
- доступ к Yandex Cloud Object Storage (через S3 API-ключи или профиль AWS credentials)

## Быстрый старт

1) Установить зависимости:

```bash
npm install
```

2) Создать локальный `.env`:

```bash
cp .env.example .env
```

3) Запустить локально:

```bash
npm run dev
```

Сайт поднимется на `http://localhost:4321`.

## Переменные окружения сайта (`.env`)

- `PUBLIC_CONTACT_FUNCTION_URL` — URL Yandex Cloud Function для отправки формы.
- `PUBLIC_YANDEX_METRIKA_ID` — основной ID счетчика Метрики.
- `AWS_ACCESS_KEY_ID` — ключ для деплоя в Object Storage (опционально, если не используете профиль).
- `AWS_SECRET_ACCESS_KEY` — секрет для деплоя в Object Storage (опционально, если не используете профиль).
- `AWS_REGION` — по умолчанию `ru-central1`.
- `AWS_PROFILE` — по умолчанию `yc`.
- `S3_BUCKET` — по умолчанию `azoneai.ru`.
- `S3_ENDPOINT` — по умолчанию `https://storage.yandexcloud.net`.

## NPM-скрипты

- `npm run dev` — dev-сервер.
- `npm run build` — сборка `dist/` + `lastmod` в sitemap + индексация `Pagefind`.
- `npm run preview` — локальный просмотр production-сборки.
- `npm run deploy` — `build` + загрузка `dist/` в Object Storage.
- `npm run deploy:only` — только загрузка уже собранного `dist/`.

## Деплой в Yandex Cloud

Базовый путь:

```bash
npm run deploy
```

Что делает `scripts/deploy-s3.mjs`:

- загружает все файлы из `dist/` в S3-совместимый бакет;
- выставляет `Content-Type` по расширениям;
- удаляет из бакета файлы, которых больше нет локально;
- использует credentials из `.env` или профиля (`AWS_PROFILE`, по умолчанию `yc`).

## Контактная форма и Cloud Function

### Фронтенд

- страница `src/pages/contact.astro`;
- отправка JSON на `PUBLIC_CONTACT_FUNCTION_URL`;
- client-side валидация + обработка ответа;
- поддержка параметра `?product=...` для предвыбора продукта.

### Функция

Код: `cloud-function-email/index.js`

Функция:

- принимает `POST` JSON;
- валидирует поля (`name`, `email`, `product`, `message`);
- фильтрует ботов через honeypot `bot_trap`;
- отправляет письмо через SMTP (`nodemailer`);
- возвращает JSON (`success`/`error`) с CORS-заголовками.

Переменные функции (см. `cloud-function-email/.env.example`):

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`
- `MAIL_TO`, `MAIL_CC`
- `ALLOWED_ORIGINS` (или `ALLOWED_ORIGIN`)

## Маршруты продукта

- `/` — главная
- `/products/` — каталог продуктов
- `/products/:id/` — продуктовые страницы (данные из `src/data/products.js`)
- `/blog/` и `/blog/*` — блог
- `/search/` — поиск по сайту (`Pagefind`)
- `/contact/` — форма заявки
- `/about/`, `/privacy/`, `/terms/`

## Важно

- Сайт полностью размещается в Yandex Cloud.
- Перед релизом проверяйте, что в `.env.example` и других шаблонах нет реальных секретов.
