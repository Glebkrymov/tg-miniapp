import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Мок Telegram окружения для локальной разработки
if (import.meta.env.DEV && !window.Telegram?.WebApp?.initData) {
  console.warn('[DEV] Telegram WebApp не обнаружен — используем мок-данные');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
