import React, { useState, useMemo } from 'react';
import { useUiStore } from '../store/uiStore';
import { MODELS, Category, getModelsByCategory } from '../constants/models';

const tabs: { key: Category; label: string }[] = [
  { key: 'image', label: '🖼️ Image' },
  { key: 'video', label: '🎬 Video' },
  { key: 'music', label: '🎵 Music' },
];

const Catalog: React.FC = () => {
  const { selectedCategory, setModel, setPage } = useUiStore();
  const [activeTab, setActiveTab] = useState<Category>(selectedCategory || 'image');
  const [search, setSearch] = useState('');

  const filteredModels = useMemo(() => {
    const byCategory = getModelsByCategory(activeTab);
    if (!search.trim()) return byCategory;
    const q = search.toLowerCase();
    return byCategory.filter(
      (m) => m.name.toLowerCase().includes(q) || m.model_id.toLowerCase().includes(q)
    );
  }, [activeTab, search]);

  return (
    <div className="min-h-screen bg-tg-bg p-4">
      {/* Заголовок + назад */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setPage('home')} className="text-tg-link text-lg">←</button>
        <h1 className="text-xl font-bold text-tg-text">Каталог моделей</h1>
      </div>

      {/* Табы категорий */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-secondary-bg text-tg-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Поиск */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск модели..."
        className="w-full bg-tg-secondary-bg rounded-xl px-4 py-3 text-tg-text placeholder-tg-hint mb-4 outline-none"
      />

      {/* Карточки моделей */}
      <div className="space-y-2">
        {filteredModels.map((model) => (
          <button
            key={model.model_id}
            onClick={() => setModel(model.model_id)}
            className="w-full bg-tg-secondary-bg rounded-xl p-4 flex items-center gap-3 active:opacity-80 transition-opacity"
          >
            <div className="flex-1 text-left">
              <div className="font-semibold text-tg-text">{model.name}</div>
              {model.description && (
                <div className="text-xs text-tg-hint mt-0.5">{model.description}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-tg-link">{model.credits} кр.</div>
            </div>
          </button>
        ))}
      </div>

      {filteredModels.length === 0 && (
        <div className="text-center text-tg-hint py-8">Ничего не найдено</div>
      )}
    </div>
  );
};

export default Catalog;
