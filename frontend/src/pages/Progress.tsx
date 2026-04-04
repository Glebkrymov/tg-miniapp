import React, { useEffect, useRef } from 'react';
import { useUiStore } from '../store/uiStore';
import { useTasksStore } from '../store/tasksStore';
import { useUserStore } from '../store/userStore';

const Progress: React.FC = () => {
  const { setPage, setModel } = useUiStore();
  const { currentTask, fetchTask } = useTasksStore();
  const { fetchBalance } = useUserStore();
  const intervalRef = useRef<number | null>(null);

  // Polling каждые 3 секунды
  useEffect(() => {
    if (!currentTask) return;

    if (currentTask.status === 'finished' || currentTask.status === 'failed') {
      // Обновляем баланс при завершении
      fetchBalance();
      return;
    }

    intervalRef.current = window.setInterval(() => {
      fetchTask(currentTask.id);
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentTask?.id, currentTask?.status, fetchTask, fetchBalance]);

  if (!currentTask) {
    return (
      <div className="min-h-screen bg-tg-bg p-4 flex items-center justify-center">
        <div className="text-tg-hint">Нет активной задачи</div>
      </div>
    );
  }

  const isFinished = currentTask.status === 'finished';
  const isFailed = currentTask.status === 'failed';
  const isProcessing = !isFinished && !isFailed;

  return (
    <div className="min-h-screen bg-tg-bg p-4 flex flex-col">
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setPage('home')} className="text-tg-link text-lg">←</button>
        <h1 className="text-xl font-bold text-tg-text">
          {isProcessing ? 'Генерация...' : isFinished ? 'Готово!' : 'Ошибка'}
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* В процессе */}
        {isProcessing && (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-tg-button border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-tg-text font-semibold mb-2">Генерация в процессе</div>
            <div className="text-sm text-tg-hint">Обычно занимает 1–3 минуты</div>
          </div>
        )}

        {/* Готово */}
        {isFinished && currentTask.result_url && (
          <div className="w-full">
            {/* Превью результата */}
            {currentTask.category === 'image' && (
              <img
                src={currentTask.result_url}
                alt="Результат"
                className="w-full rounded-xl mb-4"
              />
            )}
            {currentTask.category === 'video' && (
              <video
                src={currentTask.result_url}
                controls
                className="w-full rounded-xl mb-4"
              />
            )}
            {currentTask.category === 'music' && (
              <div className="bg-tg-secondary-bg rounded-xl p-6 mb-4 text-center">
                <div className="text-4xl mb-3">🎵</div>
                <audio src={currentTask.result_url} controls className="w-full" />
              </div>
            )}

            {/* Кнопки действий */}
            <div className="space-y-2">
              <a
                href={currentTask.result_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-tg-button text-tg-button-text rounded-xl text-center font-semibold"
              >
                Скачать
              </a>
              <button
                onClick={() => setModel(currentTask.model_id)}
                className="w-full py-3 bg-tg-secondary-bg text-tg-text rounded-xl font-semibold"
              >
                Сгенерировать ещё
              </button>
            </div>
          </div>
        )}

        {/* Ошибка */}
        {isFailed && (
          <div className="text-center w-full">
            <div className="text-4xl mb-4">❌</div>
            <div className="text-tg-text font-semibold mb-2">Генерация не удалась</div>
            <div className="text-sm text-tg-hint mb-2">
              {currentTask.error_message || 'Неизвестная ошибка'}
            </div>
            <div className="text-sm text-green-600 mb-4">
              💰 {currentTask.credits_cost} кредитов возвращены
            </div>
            <button
              onClick={() => setModel(currentTask.model_id)}
              className="w-full py-3 bg-tg-button text-tg-button-text rounded-xl font-semibold"
            >
              Попробовать снова
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Progress;
