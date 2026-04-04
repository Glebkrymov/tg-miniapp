/**
 * Скрипт для локальной разработки с ngrok.
 * Запускает ngrok туннель и автоматически устанавливает webhook бота.
 *
 * Использование: npm run dev:tunnel
 * Требуется установленный ngrok: npm install -g ngrok или https://ngrok.com/download
 */
import { exec, spawn, ChildProcess } from 'child_process';
import axios from 'axios';

const PORT = parseInt(process.env.PORT || '3000', 10);
const BOT_TOKEN = process.env.BOT_TOKEN || '';

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не задан в .env');
  process.exit(1);
}

let ngrokProcess: ChildProcess | null = null;

/**
 * Получить публичный URL ngrok через его локальный API.
 */
async function getNgrokUrl(retries = 10): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get('http://127.0.0.1:4040/api/tunnels');
      const tunnel = res.data.tunnels.find(
        (t: any) => t.proto === 'https'
      );
      if (tunnel) return tunnel.public_url;
    } catch {
      // ngrok ещё не поднялся
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Не удалось получить URL ngrok. Убедитесь что ngrok установлен.');
}

/**
 * Установить webhook бота на URL ngrok.
 */
async function setWebhook(baseUrl: string): Promise<void> {
  const webhookUrl = `${baseUrl}/webhook/telegram`;
  const res = await axios.post(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
    { url: webhookUrl }
  );

  if (res.data.ok) {
    console.log(`✅ Webhook установлен: ${webhookUrl}`);
  } else {
    console.error('❌ Ошибка установки webhook:', res.data.description);
  }
}

/**
 * Удалить webhook при завершении.
 */
async function removeWebhook(): Promise<void> {
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`
    );
    console.log('🧹 Webhook удалён');
  } catch {
    // не критично
  }
}

async function main(): Promise<void> {
  console.log(`🚀 Запуск ngrok туннеля на порту ${PORT}...`);

  // Запускаем ngrok
  ngrokProcess = spawn('ngrok', ['http', String(PORT)], {
    stdio: 'ignore',
    detached: false,
  });

  ngrokProcess.on('error', (err) => {
    console.error('❌ Не удалось запустить ngrok:', err.message);
    console.log('   Установите ngrok: https://ngrok.com/download');
    process.exit(1);
  });

  // Ждём пока ngrok поднимется и получаем URL
  const publicUrl = await getNgrokUrl();
  console.log(`🌐 Публичный URL: ${publicUrl}`);

  // Устанавливаем webhook
  await setWebhook(publicUrl);

  console.log('');
  console.log('📋 Полезные URL:');
  console.log(`   API:      ${publicUrl}/health`);
  console.log(`   Webhook:  ${publicUrl}/webhook/telegram`);
  console.log(`   PoYo CB:  ${publicUrl}/webhook/poyo`);
  console.log('');
  console.log('   Нажмите Ctrl+C для остановки');

  // Обработка завершения
  const cleanup = async () => {
    console.log('\n🛑 Завершение...');
    await removeWebhook();
    if (ngrokProcess) ngrokProcess.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  if (ngrokProcess) ngrokProcess.kill();
  process.exit(1);
});
