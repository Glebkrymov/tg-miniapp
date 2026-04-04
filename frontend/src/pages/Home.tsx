import React, { useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { useUiStore } from '../store/uiStore';
import { CATEGORY_COUNTS } from '../constants/models';

const categories = [
  { key: 'image' as const, icon: '🖼️', label: 'Изображения', count: CATEGORY_COUNTS.image },
  { key: 'video' as const, icon: '🎬', label: 'Видео',        count: CATEGORY_COUNTS.video },
  { key: 'music' as const, icon: '🎵', label: 'Музыка',       count: CATEGORY_COUNTS.music },
];

const Home: React.FC = () => {
  const { balance, fetchBalance } = useUserStore();
  const { setCategory, setPage } = useUiStore();

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return (
    <div className="min-h-screen bg-tg-bg p-4">
      {/* Шапка с балансом */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-tg-text">AI Generator</h1>
        <button
          onClick={() => setPage('balance')}
          className="flex items-center gap-1 bg-tg-secondary-bg rounded-full px-3 py-1.5"
        >
          <span className="text-sm">💰</span>
          <span className="text-sm font-semibold text-tg-text">{balance}</span>
        </button>
      </div>

      {/* Категории */}
      <div className="space-y-3 mb-6">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className="w-full bg-tg-secondary-bg rounded-2xl p-5 flex items-center gap-4 active:opacity-80 transition-opacity"
          >
            <span className="text-3xl">{cat.icon}</span>
            <div className="flex-1 text-left">
              <div className="font-semibold text-tg-text text-lg">{cat.label}</div>
              <div className="text-sm text-tg-hint">{cat.count} моделей</div>
            </div>
            <span className="text-tg-hint text-xl">›</span>
          </button>
        ))}
      </div>

      {/* Кнопки навигации */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setPage('history')}
          className="bg-tg-secondary-bg rounded-xl p-4 text-center active:opacity-80"
        >
          <div className="text-2xl mb-1">📋</div>
          <div className="text-sm text-tg-text">История</div>
        </button>
        <button
          onClick={() => setPage('profile')}
          className="bg-tg-secondary-bg rounded-xl p-4 text-center active:opacity-80"
        >
          <div className="text-2xl mb-1">👤</div>
          <div className="text-sm text-tg-text">Профиль</div>
        </button>
      </div>
    </div>
  );
};

export default Home;
