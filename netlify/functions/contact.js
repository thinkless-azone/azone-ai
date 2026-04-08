// Отправка email через Netlify Function и Gmail SMTP
//
// Env vars (Netlify → Site settings → Environment variables):
//   GMAIL_USER     = почтовый ящик-отправитель
//   GMAIL_APP_PASS = app password для почтового ящика
//   NOTIFY_TO      = info@azone-it.ru,order@azone-it.ru

const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "https://azoneai.ru",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const {
      name,
      company,
      email,
      phone,
      product,
      message,
      botcheck,
    } = JSON.parse(event.body || "{}");

    if (botcheck) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (!name || !company || !email || !phone || !product || !message) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: "Заполните все обязательные поля формы" }),
      };
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
    });

    const productLabels = {
      contentguard: "ContentGuard (Мониторинг сети)",
      azonedoc: "AzoneDoc (Умный архив)",
      constructioneye: "ConstructionEye (Видеоаналитика)",
      predictmaintain: "PredictMaintain (Предиктивная аналитика)",
      contractguard: "ContractGuard (Анализ договоров)",
      other: "Другое / Пилотный проект",
    };

    const productLabel = productLabels[product] || product;
    const notifyTo = process.env.NOTIFY_TO || "info@azone-it.ru";

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#1B365D;">Новая заявка с сайта AZONE AI</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;width:150px;">Имя</td>
              <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Организация</td>
              <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${company}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Email</td>
              <td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Телефон</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">${phone}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Интерес</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">${productLabel}</td></tr>
          <tr><td style="padding:8px;color:#666;vertical-align:top;">Дополнительная информация</td>
              <td style="padding:8px;white-space:pre-wrap;">${message}</td></tr>
        </table>
        <p style="margin-top:16px;color:#999;font-size:12px;">azoneai.ru · ${new Date().toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})}</p>
      </div>`;

    await transporter.sendMail({
      from: `"AZONE AI" <${process.env.GMAIL_USER}>`,
      to: notifyTo,
      subject: `Новая заявка: ${company} (${name})`,
      html: htmlBody,
      replyTo: email,
    });

    await transporter.sendMail({
      from: `"AZONE AI" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Ваша заявка получена — AZONE AI",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#1B365D;">Спасибо, ${name}!</h2>
        <p>Мы получили вашу заявку по теме <strong>${productLabel}</strong> и свяжемся в течение 1 рабочего дня.</p>
        <p style="margin-top:24px;">Команда AZONE AI<br/>
        <a href="https://azoneai.ru">azoneai.ru</a> · +7 (495) 902-66-36</p></div>`,
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Contact error:", err);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Ошибка отправки. Напишите на order@azone-it.ru" }),
    };
  }
};
