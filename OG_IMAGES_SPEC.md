# Спецификация OG-изображений (1200×630)

Растровые файлы готовит дизайнер. Код сайта уже ссылается на пути ниже; до появления файлов сборка не ломается, но превью в соцсетях будет без картинки.

## Общие требования

| Параметр | Значение |
|----------|----------|
| Размер | **1200×630 px** |
| Формат | **JPG** (OG-карточки; блог использует `.webp` для контента) |
| Безопасная зона | ~60 px от каждого края |
| Фон | Тёмный, в духе сайта (глубокий тёмный + градиент primary/accent) |
| Логотип | AZONE-AI (как на сайте) |
| Типографика | Кириллица, крупный заголовок, читаемый подзаголовок |
| Запрет | ROI-цифры, рейтинги, выдуманные метрики |

## Единый макет

1. Логотип AZONE-AI (левый верх или центр-верх).
2. Крупный заголовок (1–2 строки).
3. Подзаголовок (одна строка, `shortDesc` или нейтральная формулировка).
4. Лёгкий акцентный градиент / сетка (как на главной), без перегруза.

## Файлы и тексты

Все файлы — в каталог `public/images/og/`.

| Файл | Страница | Заголовок на карточке | Подзаголовок |
|------|----------|----------------------|--------------|
| `home.jpg` | `/` | AZONE-AI | ИИ и LLM в закрытом контуре on-premise. Лицензии ФСТЭК, ФСБ, МО РФ |
| `product-contentguard.jpg` | `/products/contentguard/` | ContentGuard | On-premise ИИ-аналитика событий ИБ для корпоративных SOC и объектов КИИ. |
| `product-azonedoc.jpg` | `/products/azonedoc/` | AzoneDoc | Интеллектуальное управление документами |
| `product-constructioneye.jpg` | `/products/constructioneye/` | ConstructionEye | Видеоаналитика промышленных объектов |
| `product-predictmaintain.jpg` | `/products/predictmaintain/` | PredictMaintain | Предиктивная аналитика оборудования |
| `product-contractguard.jpg` | `/products/contractguard/` | ContractGuard | Доверенный ИИ-ассистент для договорной работы в закрытом контуре |
| `article-default.jpg` | Статьи блога без своего `coverImage` | AZONE-AI · Экспертные материалы | об ИИ on-premise |

Подзаголовки продуктов — из поля `shortDesc` в `src/data/products.js` (без изменений формулировок на карточке).

## Связь с кодом

- Главная: `src/pages/index.astro` → `image="/images/og/home.jpg"`.
- Продукты: `ogImage` в `src/data/products.js` → `image={product.ogImage}` в `src/pages/products/[id].astro`.
- Статьи: при `articleDate` и отсутствии пропа `image` → `/images/og/article-default.jpg` в `src/layouts/Base.astro`.
- Twitter Card: `summary_large_image`, `twitter:image` = тот же `absoluteImage`, что и `og:image`.

## Чеклист для дизайнера

- [ ] Экспорт всех 7 JPG в `public/images/og/`
- [ ] Проверка читаемости на мобильном превью (Telegram / VK)
- [ ] Проверка абсолютного URL: `https://azoneai.ru/images/og/{filename}.jpg`
