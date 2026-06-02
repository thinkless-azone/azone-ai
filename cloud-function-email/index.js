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

const dns = require('dns');
const nodemailer = require('nodemailer');

/** Таймаут одной отправки (мс). Лимит функции в Yandex Cloud должен быть ≥ 30 с. */
const SMTP_SEND_TIMEOUT_MS = Number(process.env.SMTP_SEND_TIMEOUT_MS || 8000);

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

const WHITEPAPER_PDF_URL = 'https://azoneai.ru/whitepapers/azone-ai-llm-kii.pdf';

module.exports.handler = async function (event, context) {
  const rawList =
    process.env.ALLOWED_ORIGINS ||
    process.env.ALLOWED_ORIGIN ||
    'https://azoneai.ru,https://www.azoneai.ru,http://localhost:4321,http://127.0.0.1:4321';
  const allowedOrigins = rawList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const requestOrigin = getRequestOrigin(event);
  const corsHeaders = buildCorsHeaders(requestOrigin, allowedOrigins);

  const rawBody = getRawBody(event);
  let httpMethod = getHttpMethod(event);

  if (!httpMethod && looksLikeContactJson(rawBody)) {
    httpMethod = 'POST';
  }

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
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  let data;
  try {
    data = JSON.parse(rawBody || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Некорректный JSON' }),
    };
  }

  if (data.bot_trap === '1' || data.bot_trap === true || data.bot_trap === 'on') {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  }

  if (data.type === 'lead_magnet' || data.magnet_id || data.magnet_title) {
    return await handleLeadMagnet(data, corsHeaders);
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

  if (errors.length > 0) {
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
    const transporter = await createTransporter();
    const mailTo = (process.env.MAIL_TO || 'order@azone-it.ru').trim();
    const mailCc = (process.env.MAIL_CC || '').trim();

    await sendSmtpMail(transporter, {
      from: getFromAddress(),
      to: mailTo,
      ...(mailCc ? { cc: mailCc } : {}),
      replyTo: email.trim(),
      subject: `Заявка с сайта: ${name.trim()}${company ? ` (${company.trim()})` : ''}`,
      text: textBody,
      html: htmlBody,
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('SMTP:', err && err.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Ошибка отправки. Попробуйте позже или напишите на order@azone-it.ru',
      }),
    };
  }
};

function normalizeHeaders(event) {
  const raw = event?.headers;
  if (!raw || typeof raw !== 'object') return {};
  if (Array.isArray(raw)) {
    const out = {};
    for (const item of raw) {
      const name = item && (item.name || item.key);
      const val = item && item.value;
      if (name) out[String(name).toLowerCase()] = val;
    }
    return out;
  }
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    out[key.toLowerCase()] = Array.isArray(val) ? val[val.length - 1] : val;
  }
  return out;
}

function getRequestOrigin(event) {
  const h = normalizeHeaders(event);
  if (h.origin) return String(h.origin).trim();
  const referer = h.referer || h.referrer;
  if (referer) {
    try {
      return new URL(String(referer)).origin;
    } catch {
      /* ignore */
    }
  }
  return '';
}

function buildCorsHeaders(requestOrigin, allowedOrigins) {
  const isAzoneSite =
    /^https:\/\/(www\.)?azoneai\.ru$/i.test(requestOrigin) ||
    allowedOrigins.includes(requestOrigin);
  const isLocalDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);
  const allowOrigin = (isAzoneSite || isLocalDev) && requestOrigin ? requestOrigin : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

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

async function handleLeadMagnet(data, corsHeaders) {
  const { name, company, email, position, magnet_title, magnet_id, source } = data;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Укажите имя (минимум 2 символа)');
  }
  if (!company || typeof company !== 'string' || company.trim().length < 1) {
    errors.push('Укажите компанию');
  }
  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    errors.push('Укажите корректный email');
  }
  if (errors.length > 0) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: errors.join('; ') }),
    };
  }

  const title = (magnet_title || 'Документ AZONE-AI').trim();
  const magnetId = (magnet_id || 'azone-ai-llm-kii').trim();
  const sourceLabel = (source || 'direct').trim();
  const timestamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  const managerHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #1a1a2e; border-bottom: 2px solid #06b6d4; padding-bottom: 8px;">
        Заявка на документ: ${escapeHtml(title)}
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr><td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold; width: 140px;">Имя</td><td style="padding: 8px 12px;">${escapeHtml(name.trim())}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold;">Компания</td><td style="padding: 8px 12px;">${escapeHtml(company.trim())}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold;">Email</td><td style="padding: 8px 12px;"><a href="mailto:${escapeHtml(email.trim())}">${escapeHtml(email.trim())}</a></td></tr>
        <tr><td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold;">Должность</td><td style="padding: 8px 12px;">${escapeHtml((position || '—').trim())}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold;">Магнит</td><td style="padding: 8px 12px;">${escapeHtml(magnetId)}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f3f4f6; font-weight: bold;">Источник</td><td style="padding: 8px 12px;">${escapeHtml(sourceLabel)}</td></tr>
      </table>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Отправлено: ${timestamp} · azoneai.ru/whitepaper/</p>
    </div>
  `;

  const managerText = [
    `Заявка на документ: ${title}`,
    `Имя: ${name.trim()}`,
    `Компания: ${company.trim()}`,
    `Email: ${email.trim()}`,
    `Должность: ${(position || '—').trim()}`,
    `Магнит: ${magnetId}`,
    `Источник: ${sourceLabel}`,
    `Отправлено: ${timestamp}`,
  ].join('\n');

  const userHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #1a1a2e;">Документ AZONE-AI: ${escapeHtml(title)}</h2>
      <p>Здравствуйте, ${escapeHtml(name.trim())}!</p>
      <p>Спасибо за интерес к материалу AZONE-AI. Ссылка на PDF:</p>
      <p><a href="${WHITEPAPER_PDF_URL}" style="color: #2563eb;">${WHITEPAPER_PDF_URL}</a></p>
      <p>Если ссылка не открывается, скопируйте её в браузер или перейдите на <a href="https://azoneai.ru/whitepaper/thanks/">страницу скачивания</a>.</p>
      <p style="color: #6b7280; font-size: 13px;">С уважением,<br/>команда AZONE-AI<br/>order@azone-it.ru · +7 (495) 902-66-36</p>
    </div>
  `;

  const userText = [
    `Документ AZONE-AI: ${title}`,
    '',
    `Здравствуйте, ${name.trim()}!`,
    '',
    'Ссылка на PDF:',
    WHITEPAPER_PDF_URL,
    '',
    'Страница скачивания: https://azoneai.ru/whitepaper/thanks/',
    '',
    'С уважением, команда AZONE-AI',
  ].join('\n');

  const userEmail = email.trim();

  try {
    const transporter = await createTransporter();
    const mailTo = (process.env.MAIL_TO || 'order@azone-it.ru').trim();
    const mailCc = (process.env.MAIL_CC || '').trim();
    const from = getFromAddress();

    await sendSmtpMail(transporter, {
      from,
      to: userEmail,
      replyTo: mailTo,
      subject: `Ваш документ AZONE-AI: ${title}`,
      text: userText,
      html: userHtml,
    });

    await delayMs(400);

    await sendSmtpMail(transporter, {
      from,
      to: mailTo,
      ...(mailCc ? { cc: mailCc } : {}),
      replyTo: userEmail,
      subject: `Заявка на документ: ${title}`,
      text: managerText,
      html: managerHtml,
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('SMTP:', err && err.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error:
          'Не удалось отправить письмо на ваш email. Скачайте PDF на странице «Спасибо» или напишите на order@azone-it.ru',
      }),
    };
  }
}

function delayMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSmtpAuth() {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  if (!user || !pass) {
    throw new Error('SMTP: не заданы SMTP_USER или SMTP_PASS');
  }
  return { user, pass };
}

function getFromAddress() {
  const { user } = getSmtpAuth();
  return `"AZONE-AI" <${user}>`;
}

async function sendSmtpMail(transporter, mailOptions) {
  const sendPromise = transporter.sendMail(mailOptions);
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error(`SMTP: превышен лимит ${SMTP_SEND_TIMEOUT_MS} мс`)),
      SMTP_SEND_TIMEOUT_MS,
    );
  });
  return Promise.race([sendPromise, timeoutPromise]);
}

async function createTransporter() {
  const { user, pass } = getSmtpAuth();
  const host = (process.env.SMTP_HOST || 'smtp.yandex.ru').trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secureEnv = process.env.SMTP_SECURE;
  const secure =
    secureEnv != null && String(secureEnv).trim() !== ''
      ? String(secureEnv).toLowerCase() !== 'false'
      : port === 465;

  const transportOptions = {
    host,
    port,
    secure,
    auth: { user, pass },
    pool: false,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 6000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 5000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 7000),
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, family: 4 }, callback);
    },
  };

  if (port === 587 && !secure) {
    transportOptions.requireTLS = true;
  }

  if (/yandex/i.test(host)) {
    transportOptions.tls = {
      servername: host,
      minVersion: 'TLSv1.2',
    };
  }

  return nodemailer.createTransport(transportOptions);
}
