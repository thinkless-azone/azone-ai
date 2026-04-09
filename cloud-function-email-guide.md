# Cloud Function для контактной формы AZONE-AI
## Замена Netlify Functions → Yandex Cloud Functions

---

## Структура файлов

```
cloud-function-email/
├── index.js          ← Код Cloud Function (Node.js 18)
├── package.json      ← Зависимости
└── .env.example      ← Переменные окружения
```

Ниже — все файлы + инструкция по настройке + код для Astro-компонента формы.

---

## Файл 1: `index.js` — Код Cloud Function

```javascript
/**
 * Yandex Cloud Function: отправка email из контактной формы AZONE-AI
 * 
 * Принимает POST-запрос с JSON-телом, отправляет email через Gmail SMTP
 * на order@azone-it.ru (копия на info@azone-it.ru), возвращает JSON-ответ.
 * 
 * Переменные окружения:
 *   SMTP_HOST      — SMTP-сервер (smtp.gmail.com)
 *   SMTP_PORT      — порт (465)
 *   SMTP_USER      — email отправителя (order@azone-it.ru или Gmail)
 *   SMTP_PASS      — пароль приложения (App Password от Google)
 *   MAIL_TO        — куда отправлять (order@azone-it.ru)
 *   MAIL_CC        — копия (info@azone-it.ru)
 *   ALLOWED_ORIGIN — домен сайта (https://azoneai.ru)
 */

const nodemailer = require('nodemailer');

// Список допустимых продуктов (для валидации)
const VALID_PRODUCTS = [
  'contentguard',
  'azonedoc',
  'constructioneye',
  'predictmaintain',
  'contractguard',
  'other'
];

// Названия продуктов для письма
const PRODUCT_NAMES = {
  contentguard: 'ContentGuard — мониторинг контента',
  azonedoc: 'AzoneDoc — управление документами',
  constructioneye: 'ConstructionEye — видеоаналитика',
  predictmaintain: 'PredictMaintain — предиктивная аналитика',
  contractguard: 'ContractGuard — анализ договоров',
  other: 'Общий запрос / другой продукт'
};

/**
 * Точка входа Cloud Function
 */
module.exports.handler = async function (event, context) {
  // --- CORS: обработка preflight ---
  const origin = event.headers?.Origin || event.headers?.origin || '';
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://azoneai.ru';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  // Preflight (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  // Только POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // --- Парсинг тела запроса ---
  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Некорректный JSON' }),
    };
  }

  // --- Валидация полей ---
  const { name, company, email, phone, product, message } = data;

  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Укажите имя (минимум 2 символа)');
  }
  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    errors.push('Укажите корректный email');
  }
  if (product && !VALID_PRODUCTS.includes(product)) {
    errors.push('Некорректный продукт');
  }
  if (message && typeof message === 'string' && message.length > 5000) {
    errors.push('Сообщение слишком длинное (макс. 5000 символов)');
  }
  // Простая антиспам-проверка: honeypot-поле
  if (data._gotcha) {
    // Бот заполнил скрытое поле — тихо "успех" без отправки
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  }

  if (errors.length > 0) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: errors.join('; ') }),
    };
  }

  // --- Формирование письма ---
  const productName = product ? (PRODUCT_NAMES[product] || product) : 'Не указан';
  const timestamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #1a1a2e; border-bottom: 2px solid #6366f1; padding-bottom: 8px;">
        Новая заявка с сайта AZONE-AI
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold; width: 140px;">Имя</td>
          <td style="padding: 8px 12px;">${escapeHtml(name.trim())}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold;">Компания</td>
          <td style="padding: 8px 12px;">${escapeHtml((company || '—').trim())}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold;">Email</td>
          <td style="padding: 8px 12px;"><a href="mailto:${escapeHtml(email.trim())}">${escapeHtml(email.trim())}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold;">Телефон</td>
          <td style="padding: 8px 12px;">${escapeHtml((phone || '—').trim())}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold;">Продукт</td>
          <td style="padding: 8px 12px;">${escapeHtml(productName)}</td>
        </tr>
      </table>
      ${message ? `
        <div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-left: 3px solid #6366f1;">
          <strong>Сообщение:</strong><br/>
          ${escapeHtml(message.trim()).replace(/\n/g, '<br/>')}
        </div>
      ` : ''}
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        Отправлено: ${timestamp} · Источник: azoneai.ru/contact
      </p>
    </div>
  `;

  const textBody = [
    'Новая заявка с сайта AZONE-AI',
    '================================',
    `Имя: ${name.trim()}`,
    `Компания: ${(company || '—').trim()}`,
    `Email: ${email.trim()}`,
    `Телефон: ${(phone || '—').trim()}`,
    `Продукт: ${productName}`,
    message ? `\nСообщение:\n${message.trim()}` : '',
    `\nОтправлено: ${timestamp}`,
  ].filter(Boolean).join('\n');

  // --- Отправка через SMTP ---
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"AZONE-AI Сайт" <${process.env.SMTP_USER}>`,
      to: process.env.MAIL_TO || 'order@azone-it.ru',
      cc: process.env.MAIL_CC || 'info@azone-it.ru',
      replyTo: email.trim(),
      subject: `[AZONE-AI] Заявка: ${name.trim()}${company ? ` (${company.trim()})` : ''}`,
      text: textBody,
      html: htmlBody,
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Заявка отправлена' }),
    };
  } catch (err) {
    console.error('SMTP Error:', err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ошибка отправки. Попробуйте позже или напишите на order@azone-it.ru' }),
    };
  }
};

// --- Утилиты ---

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

---

## Файл 2: `package.json`

```json
{
  "name": "azoneai-contact-form",
  "version": "1.0.0",
  "description": "Cloud Function для контактной формы AZONE-AI",
  "main": "index.js",
  "dependencies": {
    "nodemailer": "^6.9.0"
  }
}
```

---

## Файл 3: `.env.example`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=order@azone-it.ru
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
MAIL_TO=order@azone-it.ru
MAIL_CC=info@azone-it.ru
ALLOWED_ORIGIN=https://azoneai.ru
```

---

## Настройка Cloud Function в Yandex Cloud

### Шаг 1. Подготовка ZIP-архива

В терминале Cursor, в папке `cloud-function-email/`:

```bash
# Установить зависимости
npm install

# Создать ZIP для загрузки
zip -r ../contact-function.zip . -x "node_modules/.cache/*" -x ".env*"
```

> **Важно:** в ZIP должны быть `index.js`, `package.json` и папка `node_modules/`.
> Yandex Cloud Functions НЕ устанавливает зависимости автоматически — нужно включить `node_modules` в архив.

### Шаг 2. Создание функции в консоли

1. Консоль Yandex Cloud → **Cloud Functions** (левое меню → Бессерверные вычисления → Cloud Functions)
2. Нажми **«Создать функцию»**
3. Имя: `azoneai-contact-form`
4. Нажми **«Создать»**

### Шаг 3. Создание версии функции

1. Открой созданную функцию
2. Нажми **«Создать версию»** (или «Редактор»)
3. Заполни:

| Поле | Значение |
|------|----------|
| Среда выполнения | `nodejs18` |
| Способ загрузки | ZIP-архив |
| Файл | `contact-function.zip` (загрузи) |
| Точка входа | `index.handler` |
| Таймаут | `10` секунд |
| Память | `128` МБ |

4. В разделе **Переменные окружения** добавь:

| Ключ | Значение |
|------|----------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `order@azone-it.ru` (или Gmail-аккаунт, с которого отправляешь) |
| `SMTP_PASS` | Пароль приложения Google (см. ниже) |
| `MAIL_TO` | `order@azone-it.ru` |
| `MAIL_CC` | `info@azone-it.ru` |
| `ALLOWED_ORIGIN` | `https://azoneai.ru` |

5. Нажми **«Создать версию»**

### Шаг 4. Сделать функцию публичной

1. На странице функции → вкладка **«Обзор»**
2. Включи тумблер **«Публичная функция»**

Это нужно, чтобы форма на сайте могла вызывать функцию без авторизации.

После этого появится URL вида:
```
https://functions.yandexcloud.net/d4exxxxxxxxxxxxxxx
```

**Это твой endpoint для формы.** Запиши его.

### Шаг 5. Получение пароля приложения Google

Если используешь Gmail SMTP (smtp.gmail.com):

1. Открой https://myaccount.google.com/apppasswords
2. Выбери приложение: «Почта», устройство: «Другое» → назови «AZONE-AI Cloud Function»
3. Google сгенерирует 16-символьный пароль вида `abcd efgh ijkl mnop`
4. Используй его (без пробелов: `abcdefghijklmnop`) как `SMTP_PASS`

> **Требование:** на аккаунте Google должна быть включена двухфакторная аутентификация.

---

## Клиентская часть: Astro-компонент формы

### Файл: `src/components/ContactForm.astro`

```astro
---
// ContactForm.astro — контактная форма AZONE-AI
// Замена Netlify Functions → Yandex Cloud Functions

interface Props {
  product?: string;
}

const { product } = Astro.props;

// URL Cloud Function — вынеси в .env или захардкодь
const FUNCTION_URL = import.meta.env.PUBLIC_CONTACT_FUNCTION_URL 
  || 'https://functions.yandexcloud.net/d4exxxxxxxxxxxxxxx'; // ← ЗАМЕНИ на свой
---

<form id="contact-form" class="space-y-6" novalidate>
  <!-- Honeypot (антиспам, скрытое поле) -->
  <div style="position: absolute; left: -9999px;" aria-hidden="true">
    <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" />
  </div>

  <!-- Имя -->
  <div>
    <label for="name" class="block text-sm font-medium text-gray-300 mb-1">
      Имя <span class="text-red-400">*</span>
    </label>
    <input
      type="text"
      id="name"
      name="name"
      required
      minlength="2"
      placeholder="Иван Иванов"
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
             text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 
             focus:ring-1 focus:ring-indigo-500 transition-colors"
    />
  </div>

  <!-- Компания -->
  <div>
    <label for="company" class="block text-sm font-medium text-gray-300 mb-1">
      Компания
    </label>
    <input
      type="text"
      id="company"
      name="company"
      placeholder="ООО «Название»"
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
             text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 
             focus:ring-1 focus:ring-indigo-500 transition-colors"
    />
  </div>

  <!-- Email -->
  <div>
    <label for="email" class="block text-sm font-medium text-gray-300 mb-1">
      Email <span class="text-red-400">*</span>
    </label>
    <input
      type="email"
      id="email"
      name="email"
      required
      placeholder="ivan@company.ru"
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
             text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 
             focus:ring-1 focus:ring-indigo-500 transition-colors"
    />
  </div>

  <!-- Телефон -->
  <div>
    <label for="phone" class="block text-sm font-medium text-gray-300 mb-1">
      Телефон
    </label>
    <input
      type="tel"
      id="phone"
      name="phone"
      placeholder="+7 (___) ___-__-__"
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
             text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 
             focus:ring-1 focus:ring-indigo-500 transition-colors"
    />
  </div>

  <!-- Продукт -->
  <div>
    <label for="product" class="block text-sm font-medium text-gray-300 mb-1">
      Интересующий продукт
    </label>
    <select
      id="product"
      name="product"
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
             text-white focus:outline-none focus:border-indigo-500 
             focus:ring-1 focus:ring-indigo-500 transition-colors"
    >
      <option value="other" class="bg-gray-900">Общий запрос</option>
      <option value="contentguard" class="bg-gray-900">ContentGuard — мониторинг контента</option>
      <option value="azonedoc" class="bg-gray-900">AzoneDoc — управление документами</option>
      <option value="constructioneye" class="bg-gray-900">ConstructionEye — видеоаналитика</option>
      <option value="predictmaintain" class="bg-gray-900">PredictMaintain — предиктивная аналитика</option>
      <option value="contractguard" class="bg-gray-900">ContractGuard — анализ договоров</option>
    </select>
  </div>

  <!-- Сообщение -->
  <div>
    <label for="message" class="block text-sm font-medium text-gray-300 mb-1">
      Сообщение
    </label>
    <textarea
      id="message"
      name="message"
      rows="4"
      maxlength="5000"
      placeholder="Опишите вашу задачу или вопрос..."
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
             text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 
             focus:ring-1 focus:ring-indigo-500 transition-colors resize-y"
    ></textarea>
  </div>

  <!-- Статус -->
  <div id="form-status" class="hidden rounded-lg p-4 text-sm"></div>

  <!-- Кнопка -->
  <button
    type="submit"
    id="submit-btn"
    class="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium 
           rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Отправить заявку
  </button>
</form>

<script define:vars={{ FUNCTION_URL, product }}>
  // Предвыбрать продукт из URL ?product=azonedoc или из пропса
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const preselect = params.get('product') || product;
    if (preselect) {
      const select = document.getElementById('product');
      if (select) {
        const option = select.querySelector(`option[value="${preselect}"]`);
        if (option) select.value = preselect;
      }
    }
  });
</script>

<script define:vars={{ FUNCTION_URL }}>
  const form = document.getElementById('contact-form');
  const submitBtn = document.getElementById('submit-btn');
  const statusDiv = document.getElementById('form-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Собрать данные
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Базовая клиентская валидация
    if (!data.name || data.name.trim().length < 2) {
      showStatus('error', 'Пожалуйста, укажите имя');
      return;
    }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showStatus('error', 'Пожалуйста, укажите корректный email');
      return;
    }

    // UI: загрузка
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';
    statusDiv.classList.add('hidden');

    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showStatus('success', 'Заявка отправлена! Мы свяжемся с вами в ближайшее время.');
        form.reset();
      } else {
        showStatus('error', result.error || 'Произошла ошибка. Попробуйте ещё раз.');
      }
    } catch (err) {
      showStatus('error', 'Не удалось отправить. Проверьте интернет или напишите на order@azone-it.ru');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить заявку';
    }
  });

  function showStatus(type, message) {
    statusDiv.classList.remove('hidden', 'bg-green-900/50', 'text-green-300', 'bg-red-900/50', 'text-red-300');
    if (type === 'success') {
      statusDiv.classList.add('bg-green-900/50', 'text-green-300');
    } else {
      statusDiv.classList.add('bg-red-900/50', 'text-red-300');
    }
    statusDiv.textContent = message;
  }
</script>
```

### Использование в Astro-страницах

```astro
---
// src/pages/contact.astro
import Layout from '../layouts/Layout.astro';
import ContactForm from '../components/ContactForm.astro';
---

<Layout title="Обсудить проект | AZONE-AI">
  <section class="max-w-2xl mx-auto px-4 py-20">
    <h1 class="text-3xl font-bold text-white mb-8">Обсудить проект</h1>
    <ContactForm />
  </section>
</Layout>
```

Продукт передаётся из URL автоматически:
```
/contact?product=azonedoc   → AzoneDoc предвыбран в dropdown
/contact?product=other      → Общий запрос
```

### Переменная окружения в Astro

Добавь в `.env` (корень Astro-проекта):

```env
PUBLIC_CONTACT_FUNCTION_URL=https://functions.yandexcloud.net/d4exxxxxxxxxxxxxxx
```

> Префикс `PUBLIC_` означает, что переменная доступна в клиентском коде.
> Это безопасно — URL Cloud Function публичный (как и был URL Netlify Functions).

---

## Тестирование

### Локальный тест (без деплоя функции)

Можно проверить саму функцию локально:

```bash
cd cloud-function-email
node -e "
const handler = require('./index').handler;
handler({
  httpMethod: 'POST',
  headers: { Origin: 'https://azoneai.ru' },
  body: JSON.stringify({
    name: 'Тест Тестов',
    company: 'ООО Тест',
    email: 'test@example.com',
    phone: '+7 999 123 45 67',
    product: 'azonedoc',
    message: 'Тестовое сообщение'
  })
}).then(r => console.log(JSON.stringify(r, null, 2)));
"
```

> Для этого нужно задать переменные окружения: `export SMTP_USER=... SMTP_PASS=... MAIL_TO=...`

### Тест через curl (после деплоя)

```bash
curl -X POST https://functions.yandexcloud.net/d4exxxxxxxxxxxxxxx \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://azoneai.ru' \
  -d '{
    "name": "Тест",
    "email": "test@example.com",
    "message": "Проверка формы"
  }'
```

Ожидаемый ответ:
```json
{"success": true, "message": "Заявка отправлена"}
```

---

## Стоимость

Yandex Cloud Functions — биллинг по вызовам:
- **1 000 000 вызовов/мес.** — бесплатно (free tier)
- Для контактной формы (~10–50 заявок/мес.) — 0 ₽

---

## Миграция: что удалить из текущего проекта

1. Удалить папку `netlify/functions/` (или `functions/`) — это старая Netlify Function
2. Удалить `netlify.toml` (если он был нужен только для Functions)
3. Заменить компонент контактной формы на новый `ContactForm.astro`
4. Добавить `PUBLIC_CONTACT_FUNCTION_URL` в `.env`
5. Протестировать: `npm run dev` → отправить тестовую заявку
