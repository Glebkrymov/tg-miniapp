import React, { useEffect, useCallback } from 'react';
import { useUiStore } from '../store/uiStore';
import { useTasksStore, type Task } from '../store/tasksStore';

const statusLabels: Record<string, { text: string; color: string }> = {
  pending:    { text: 'Ожидание',   color: 'text-yellow-600' },
  processing: { text: 'Обработка',  color: 'text-blue-600' },
  finished:   { text: 'Готово',     color: 'text-green-600' },
  failed:     { text: 'Ошибка',     color: 'text-red-600' },
};

const categoryIcons: Record<string, string> = {
  image: '🖼️',
  video: '🎬',
  music: '🎵',
};

const History: React.FC = () => {
  const { setPage } = useUiStore();
  const { tasks, total, loading, fetchTasks, setCurrentTask } = useTasksStore();

  useEffect(() => {
    fetchTasks(20, 0);
  }, [fetchTasks]);

  // Подгрузка при скролле
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 100 && !loading && tasks.length < total) {
      fetchTasks(20, tasks.length);
    }
  }, [loading, tasks.length, total, fetchTasks]);

  const openTask = (task: Task) => {
    setCurrentTask(task);
    setPage('progress');
  };

  return (
    <div className="min-h-screen bg-tg-bg p-4" onScroll={handleScroll}>
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setPage('home')} className="text-tg-link text-lg">←</button>
        <h1 className="text-xl font-bold text-tg-text">История</h1>
        <span className="text-sm text-tg-hint ml-auto">{total} задач</span>
      </div>

      {/* Список задач */}
      {tasks.length === 0 && !loading && (
        <div className="text-center text-tg-hint py-12">Задач пока нет</div>
      )}

      <div className="space-y-2">
        {tasks.map((task) => {
          const status = statusLabels[task.status] || statusLabels.pending;
          return (
            <button
              key={task.id}
              onClick={() => openTask(task)}
              className="w-full bg-tg-secondary-bg rounded-xl p-4 flex items-center gap-3 active:opacity-80 transition-opacity"
            >
              {/* Иконка/превью */}
              <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-2xl shrink-0">
                {task.status === 'finished' && task.result_url && task.category === 'image' ? (
                  <img src={task.result_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  categoryIcons[task.category] || '📄'
                )}
              </div>

              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-semibold text-tg-text truncate">
                  {task.prompt || task.model_id}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium ${status.color}`}>{status.text}</span>
                  <span className="text-xs text-tg-hint">{task.credits_cost} кр.</span>
                </div>
              </div>

              <div className="text-xs text-tg-hint shrink-0">
                {new Date(task.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              </div>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="w-6 h-6 border-2 border-tg-button border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}
    </div>
  );
};

export default History;
