// Отправка email от azone.msk@gmail.com через Gmail SMTP
//
// Env vars (Netlify → Site settings → Environment variables):
//   GMAIL_USER     = azone.msk@gmail.com
//   GMAIL_APP_PASS = <App Password из Google Account>
//   NOTIFY_TO      = order@azone-it.ru

const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const headers = {
    "Access-Control-Allow-Origin": "https://azoneai.ru",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const { name, company, email, phone, task, security } = JSON.parse(event.body);

    if (!name || !company || !email) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: "Поля «Имя», «Организация» и «Email» обязательны" }),
      };
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
    });

    const secLabels = {
      fstec: "ФСТЭК", fsb: "ФСБ", "152fz": "152-ФЗ", gostaina: "Гостайна", none: "Без требований",
    };

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#1B365D;">Новая заявка на пилот</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;width:150px;">Имя</td>
              <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Организация</td>
              <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${company}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Email</td>
              <td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Телефон</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">${phone || "—"}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">ИБ</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">${secLabels[security] || "—"}</td></tr>
          <tr><td style="padding:8px;color:#666;vertical-align:top;">Задача</td>
              <td style="padding:8px;">${task || "—"}</td></tr>
        </table>
        <p style="margin-top:16px;color:#999;font-size:12px;">azoneai.ru · ${new Date().toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})}</p>
      </div>`;

    await transporter.sendMail({
      from: `"AZONE AI" <${process.env.GMAIL_USER}>`,
      to: process.env.NOTIFY_TO || "order@azone-it.ru",
      subject: `Заявка на пилот: ${company} (${name})`,
      html: htmlBody,
      replyTo: email,
    });

    await transporter.sendMail({
      from: `"AZONE AI" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Ваша заявка получена — AZONE AI",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#1B365D;">Спасибо, ${name}!</h2>
        <p>Мы получили вашу заявку и свяжемся в течение 1 рабочего дня.</p>
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
