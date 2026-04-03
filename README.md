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
