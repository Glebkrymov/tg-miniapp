import React, { useState, useEffect } from 'react';
import { useUiStore } from '../store/uiStore';
import { useUserStore } from '../store/userStore';
import { useTasksStore } from '../store/tasksStore';
import { getModelById } from '../constants/models';

const Generate: React.FC = () => {
  const { selectedModel, setPage } = useUiStore();
  const { balance } = useUserStore();
  const { submitTask, loading } = useTasksStore();

  const model = selectedModel ? getModelById(selectedModel) : null;

  const [prompt, setPrompt] = useState('');

  // Параметры по категории
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [duration, setDuration] = useState('5');
  const [resolution, setResolution] = useState('720p');
  const [musicStyle, setMusicStyle] = useState('');
  const [vocalType, setVocalType] = useState('instrumental');

  const canGenerate = model && prompt.trim().length > 0 && balance >= model.credits && !loading;

  // Telegram MainButton
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg || !model) return;

    const btn = tg.MainButton;
    btn.setText(`Сгенерировать (${model.credits} кр.)`);

    if (canGenerate) {
      btn.enable();
      btn.show();
    } else {
      btn.disable();
      btn.show();
    }

    const handleClick = () => { handleSubmit(); };
    btn.onClick(handleClick);

    return () => {
      btn.offClick(handleClick);
      btn.hide();
    };
  }, [model, canGenerate, prompt]);

  const handleSubmit = async () => {
    if (!model || !canGenerate) return;

    const params: Record<string, unknown> = {};
    if (model.category === 'image') {
      params.size = aspectRatio;
    } else if (model.category === 'video') {
      params.duration = parseInt(duration, 10);
      params.resolution = resolution;
    } else if (model.category === 'music') {
      if (musicStyle) params.style = musicStyle;
      params.vocal_type = vocalType;
    }

    const taskId = await submitTask(model.model_id, prompt.trim(), params, model.category);
    if (taskId) {
      setPage('progress');
    }
  };

  if (!model) {
    return (
      <div className="min-h-screen bg-tg-bg p-4 flex items-center justify-center">
        <div className="text-tg-hint">Модель не выбрана</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tg-bg p-4">
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setPage('catalog')} className="text-tg-link text-lg">←</button>
        <h1 className="text-xl font-bold text-tg-text">Генерация</h1>
      </div>

      {/* Выбранная модель */}
      <div className="bg-tg-secondary-bg rounded-xl p-4 mb-4">
        <div className="font-semibold text-tg-text">{model.name}</div>
        <div className="text-sm text-tg-hint mt-1">{model.description}</div>
        <div className="text-sm font-bold text-tg-link mt-2">{model.credits} кредитов</div>
      </div>

      {/* Промпт */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Опишите, что хотите сгенерировать..."
        rows={4}
        className="w-full bg-tg-secondary-bg rounded-xl px-4 py-3 text-tg-text placeholder-tg-hint mb-4 outline-none resize-none"
      />

      {/* Параметры по категории */}
      {model.category === 'image' && (
        <div className="mb-4">
          <div className="text-sm font-semibold text-tg-text mb-2">Соотношение сторон</div>
          <div className="flex gap-2">
            {['1:1', '16:9', '9:16', '4:3'].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-3 py-2 rounded-lg text-sm ${
                  aspectRatio === ratio
                    ? 'bg-tg-button text-tg-button-text'
                    : 'bg-tg-secondary-bg text-tg-text'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>
      )}

      {model.category === 'video' && (
        <>
          <div className="mb-4">
            <div className="text-sm font-semibold text-tg-text mb-2">Длительность</div>
            <div className="flex gap-2">
              {['5', '10'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    duration === d ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg text-tg-text'
                  }`}
                >
                  {d}с
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <div className="text-sm font-semibold text-tg-text mb-2">Разрешение</div>
            <div className="flex gap-2">
              {['720p', '1080p'].map((r) => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    resolution === r ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg text-tg-text'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {model.category === 'music' && (
        <>
          <div className="mb-4">
            <div className="text-sm font-semibold text-tg-text mb-2">Стиль (опционально)</div>
            <input
              type="text"
              value={musicStyle}
              onChange={(e) => setMusicStyle(e.target.value)}
              placeholder="Pop, Rock, Lo-fi..."
              className="w-full bg-tg-secondary-bg rounded-xl px-4 py-3 text-tg-text placeholder-tg-hint outline-none"
            />
          </div>
          <div className="mb-4">
            <div className="text-sm font-semibold text-tg-text mb-2">Тип</div>
            <div className="flex gap-2">
              {[{ key: 'instrumental', label: 'Инструментал' }, { key: 'vocal', label: 'С вокалом' }].map((v) => (
                <button
                  key={v.key}
                  onClick={() => setVocalType(v.key)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    vocalType === v.key ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg text-tg-text'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Предупреждение о балансе */}
      {balance < model.credits && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <div className="text-sm text-red-600">
            Недостаточно кредитов. Нужно {model.credits}, у вас {balance}.
          </div>
          <button
            onClick={() => setPage('balance')}
            className="text-sm text-tg-link mt-1 underline"
          >
            Пополнить баланс
          </button>
        </div>
      )}

      {/* Кнопка генерации (fallback для не-Telegram) */}
      <button
        onClick={handleSubmit}
        disabled={!canGenerate}
        className={`w-full py-4 rounded-xl font-semibold text-center transition-opacity ${
          canGenerate
            ? 'bg-tg-button text-tg-button-text active:opacity-80'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? 'Отправка...' : `Сгенерировать (${model.credits} кр.)`}
      </button>
    </div>
  );
};

export default Generate;
