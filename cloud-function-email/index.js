/**
 * Yandex Cloud Function: отправка email из контактной формы AZONE-AI
 *
 * Принимает POST-запрос с JSON-телом, отправляет email через SMTP
 * на order@azone-it.ru (копия на info@azone-it.ru), возвращает JSON-ответ.
 *
 * Переменные окружения:
 *   SMTP_HOST       — при необходимости (smtp.gmail.com и т.д.)
 *   SMTP_PORT, SMTP_SECURE
 *   SMTP_USER, SMTP_PASS
 *   MAIL_TO, MAIL_CC
 *   ALLOWED_ORIGINS — через запятую (CORS)
 *   ALLOWED_ORIGIN  — один домен (устарело)
 */

const nodemailer = require('nodemailer');

const VALID_PRODUCTS = [
  'contentguard',
  'azonedoc',
  'constructioneye',
  'predictmaintain',
  'contractguard',
  'other',
];

const PRODUCT_NAMES = {
  contentguard: 'ContentGuard — мониторинг контента',
  azonedoc: 'AzoneDoc — управление документами',
  constructioneye: 'ConstructionEye — видеоаналитика',
  predictmaintain: 'PredictMaintain — предиктивная аналитика',
  contractguard: 'ContractGuard — анализ договоров',
  other: 'Общий запрос / другой продукт',
};

module.exports.handler = async function (event, context) {
  const rawList =
    process.env.ALLOWED_ORIGINS ||
    process.env.ALLOWED_ORIGIN ||
    'https://azoneai.ru,https://www.azoneai.ru';
  const allowedOrigins = rawList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const requestOrigin = event?.headers?.Origin || event?.headers?.origin || '';
  const allowOrigin = allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0];

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  const rawBody = getRawBody(event);
  let httpMethod = getHttpMethod(event);

  // Тест в консоли Yandex часто шлёт только JSON заявки без httpMethod → иначе мгновенный 405 за ~2 ms
  if (!httpMethod && looksLikeContactJson(rawBody)) {
    httpMethod = 'POST';
    console.log(
      'contact-form: нет httpMethod в event — обрабатываем тело как POST (тест консоли или нестандартный вызов)',
    );
  }

  console.log('contact-form', {
    httpMethod: httpMethod || '(пусто)',
    bodyLength: rawBody ? rawBody.length : 0,
    origin: requestOrigin || '(нет)',
  });

  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  if (httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Method Not Allowed',
        hint:
          'Ожидается POST. Если тестируете в консоли — передайте полный HTTP-event или JSON тела заявки (name, email, …).',
      }),
    };
  }

  let data;
  try {
    data = JSON.parse(rawBody || '{}');
  } catch (e) {
    console.error('contact-form: некорректный JSON', e && e.message);
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Некорректный JSON' }),
    };
  }

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
  // Honeypot: скрытый чекбокс bot_trap — у людей не отмечен и не уходит в JSON; боты часто «включают» все поля
  if (data.bot_trap === '1' || data.bot_trap === true || data.bot_trap === 'on') {
    console.log('contact-form: honeypot (чекбокс) — заявка отклонена (бот)');
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  }

  if (errors.length > 0) {
    console.log('contact-form: ошибки валидации:', errors.join('; '));
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: errors.join('; ') }),
    };
  }

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
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!user || !pass) {
      console.error('contact-form: SMTP — не заданы SMTP_USER или SMTP_PASS');
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Ошибка отправки. Попробуйте позже или напишите на order@azone-it.ru',
        }),
      };
    }

    let transporter;
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT || 465);
      const secure = String(process.env.SMTP_SECURE || 'true') !== 'false';
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: { user, pass },
      });
    } else {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    }

    console.log('contact-form: отправка SMTP…');
    await transporter.sendMail({
      from: `"AZONE-AI" <${user}>`,
      to: process.env.MAIL_TO || 'order@azone-it.ru',
      cc: process.env.MAIL_CC || 'info@azone-it.ru',
      replyTo: email.trim(),
      subject: `Заявка с сайта: ${name.trim()}${company ? ` (${company.trim()})` : ''}`,
      text: textBody,
      html: htmlBody,
    });

    console.log('contact-form: письмо отправлено');
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Заявка отправлена' }),
    };
  } catch (err) {
    console.error('SMTP Error:', err && err.message ? err.message : err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Ошибка отправки. Попробуйте позже или напишите на order@azone-it.ru',
      }),
    };
  }
};

function getHttpMethod(event) {
  if (!event || typeof event !== 'object') return '';
  const raw =
    event.httpMethod ||
    event.requestContext?.http?.method ||
    event.requestContext?.httpMethod ||
    event.method;
  return typeof raw === 'string' ? raw.toUpperCase() : '';
}

function getRawBody(event) {
  if (!event || event.body == null || event.body === '') return '';
  let body = event.body;
  if (event.isBase64Encoded && typeof body === 'string') {
    body = Buffer.from(body, 'base64').toString('utf8');
  }
  return typeof body === 'string' ? body : JSON.stringify(body);
}

function looksLikeContactJson(raw) {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const o = JSON.parse(raw);
    return (
      o &&
      typeof o === 'object' &&
      typeof o.name === 'string' &&
      o.name.trim().length >= 2 &&
      typeof o.email === 'string' &&
      isValidEmail(o.email)
    );
  } catch {
    return false;
  }
}

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
