require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// CORS для фронтенда
app.use(
  cors({
    origin: ['https://anna-astrolog.com', 'https://www.anna-astrolog.com'],
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);
app.options('/submit', cors());

app.use(express.json());

app.get('/health', (req, res) => {
  res.send('OK');
});

// Простая память для антиспама по IP
const lastRequests = new Map();
const WINDOW_MS = 60 * 1000;      // окно 60 секунд
const MAX_PER_WINDOW = 3;         // не больше 3 заявок за окно с одного IP

app.post('/submit', async (req, res) => {
  // IP клиента
  const ip =
    (req.headers['x-forwarded-for'] &&
      req.headers['x-forwarded-for'].split(',')[0].trim()) ||
    req.socket.remoteAddress ||
    'unknown';

  const now = Date.now();
  const prev = lastRequests.get(ip) || { count: 0, start: now };

  // если окно истекло — обнуляем счётчик
  if (now - prev.start > WINDOW_MS) {
    prev.count = 0;
    prev.start = now;
  }

  prev.count += 1;
  lastRequests.set(ip, prev);

  // если слишком много запросов — режем
  if (prev.count > MAX_PER_WINDOW) {
    return res
      .status(429)
      .json({ ok: false, error: 'too_many_requests', message: 'Слишком много попыток. Попробуйте позже.' });
  }

  const { name, contact, email, comment, website } = req.body || {};

  // Honeypot: если скрытое поле заполнено — считаем, что это бот
  if (website) {
    return res.json({ ok: true });
  }

  if (!name || !contact) {
    return res
      .status(400)
      .json({ ok: false, error: 'missing_fields', message: 'Не заполнены обязательные поля.' });
  }

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;

  if (!token || !chatId) {
    console.error('BOT_TOKEN или CHAT_ID не заданы в .env');
    return res
      .status(500)
      .json({ ok: false, error: 'config_error', message: 'Сервер не настроен.' });
  }

  const lines = [
    'Новая заявка с сайта anna-astrolog.com',
    `Имя: ${name}`,
    `Контакт: ${contact}`,
  ];

  if (email) {
    lines.push(`Email: ${email}`);
  }

  if (comment) {
    lines.push(`Комментарий: ${comment}`);
  }

  const text = lines.join('\n');

  try {
    const tgResp = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      }
    );

    const data = await tgResp.json();

    if (!data.ok) {
      console.error('Telegram API error:', data);
      return res
        .status(500)
        .json({ ok: false, error: 'telegram_error', message: 'Ошибка при отправке в Telegram.' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('Server error:', e);
    return res
      .status(500)
      .json({ ok: false, error: 'server_error', message: 'Внутренняя ошибка сервера.' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Anna API listening on port ${port}`);
});
