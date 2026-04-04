import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Axios клиент с автоматической авторизацией через Telegram initData.
 */
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор — добавляет Authorization: Bearer {initData} к каждому запросу
apiClient.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) {
    config.headers.Authorization = `Bearer ${initData}`;
  }
  return config;
});

// Интерцептор ответов — обработка ошибок
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Ошибка авторизации — невалидная initData');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
