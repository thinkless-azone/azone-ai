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
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"AZONE-AI" <${process.env.SMTP_USER}>`,
      to: process.env.MAIL_TO || 'order@azone-it.ru',
      cc: process.env.MAIL_CC || 'info@azone-it.ru',
      replyTo: email.trim(),
      subject: `Заявка с сайта: ${name.trim()}${company ? ` (${company.trim()})` : ''}`,
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