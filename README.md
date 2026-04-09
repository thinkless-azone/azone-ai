# AZONE AI Site

Маркетинговый сайт AZONE AI на `Astro` с блогом, страницами продуктов, поиском (`Pagefind`) и формой обратной связи через Yandex Cloud Function.

## Технологии

- `Astro`
- `Tailwind CSS`
- `Pagefind`
- `Nodemailer` (в облачной функции отправки почты)

## Требования

- `Node.js 20+`
- `npm`
- `AWS CLI` (для деплоя в Yandex Object Storage)
- профиль `yc` в AWS CLI

## Быстрый старт

1. Установить зависимости:

```bash
npm install
```

2. Создать локальные переменные окружения:

```bash
cp .env.example .env
```

3. Запустить dev-сервер:

```bash
npm run dev
```

## Переменные окружения сайта

Файл: `.env`

- `PUBLIC_CONTACT_FUNCTION_URL` — URL облачной функции для формы контактов
- `PUBLIC_YANDEX_METRIKA_ID` — ID счетчика Яндекс Метрики
- `PUBLIC_GA4_MEASUREMENT_ID` — ID GA4

## Скрипты

- `npm run dev` — локальная разработка
- `npm run build` — production-сборка + постобработка sitemap + индекс поиска
- `npm run preview` — предпросмотр production-сборки
- `npm run deploy` — сборка и загрузка `dist/` в бакет `s3://azoneai.ru`
- `npm run deploy:only` — только загрузка уже собранного `dist/`

## Деплой

Проект деплоится как статический сайт в Yandex Object Storage:

```bash
npm run deploy
```

Команда использует:

- endpoint: `https://storage.yandexcloud.net`
- профиль: `yc`
- синхронизацию с удалением удаленных локально файлов (`--delete`)

## Форма обратной связи (Cloud Function)

Папка `cloud-function-email/` содержит Node.js-функцию для отправки заявок по email.

Базовый запуск в каталоге функции:

```bash
cd cloud-function-email
npm install
node index.js
```

Для функции используется собственный файл `.env` на основе `cloud-function-email/.env.example`.

## Полезные документы

- `azoneai-yandex-cloud-guide.md` — гайд по облачной инфраструктуре
- `cloud-function-email-guide.md` — инструкция по функции отправки email
- `azoneai-audit-v2.md` — аудит сайта
# AZONE-AI — сайт `azoneai.ru`

Маркетинговый сайт на Astro (SSG) с блогом, страницами продуктов и формой обратной связи через Netlify Function.

## Технологии

- `Astro 5`
- `Tailwind CSS`
- `@astrojs/sitemap`
- `Netlify Functions` (`nodemailer` + Gmail SMTP)

## Быстрый старт

```bash
npm install
npm run dev
```

Локально сайт поднимается на `http://localhost:4321`.

## Скрипты

- `npm run dev` — запуск dev-сервера
- `npm run build` — production build в `dist`
- `npm run preview` — локальный просмотр собранного `dist`

## Структура проекта

```text
src/
  layouts/
    Base.astro
  pages/
    index.astro
    about.astro
    contact.astro
    blog/
      index.astro
      *.astro
    products/
      [id].astro
  data/
    products.js
  styles/
    global.css
netlify/
  functions/
    contact.js
```

## Маршруты

- `/` — главная
- `/about` — о компании
- `/contact` — форма заявки
- `/blog` — список статей
- `/blog/*` — статьи
- `/products/:id` — карточка продукта (`contentguard`, `azonedoc`, `constructioneye`, `predictmaintain`, `contractguard`)

## Форма обратной связи

Фронтенд отправляет POST-запрос на:

- `/.netlify/functions/contact`

Функция: `netlify/functions/contact.js`.

### Переменные окружения (Netlify)

- `GMAIL_USER` — email отправителя Gmail
- `GMAIL_APP_PASS` — app password Gmail
- `NOTIFY_TO` — email получателя уведомлений

## Деплой (Netlify)

Проект уже настроен через `netlify.toml`:

- build command: `npm run build`
- publish directory: `dist`
- functions directory: `netlify/functions`
- `NODE_VERSION=20`

Стандартный процесс:
1. Подключить репозиторий в Netlify.
2. Добавить переменные окружения.
3. Выполнить deploy.

## Важно по статике

- В статьях используются изображения по путям вида `/images/*.webp`.
- Для корректного отображения файлов эти ассеты должны лежать в `public/images/` (или пути в статьях должны быть изменены).

## SEO

- Sitemap генерируется автоматически (`@astrojs/sitemap`).
- Базовый `site` указан в `astro.config.mjs`: `https://azoneai.ru`.
