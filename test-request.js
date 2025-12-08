const fetch = require('node-fetch');

async function main() {
  try {
    const resp = await fetch('http://localhost:3001/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Тестовый клиент',
        contact: '@test_contact',
        email: 'test@example.com',
        comment: 'Проверка сервера',
        website: '' // honeypot пустой
      }),
    });

    const data = await resp.json();
    console.log('Ответ сервера:', data);
  } catch (e) {
    console.error('Ошибка запроса:', e);
  }
}

main();
