import React, { useState, useEffect, useRef } from 'react';
import { useUiStore } from '../store/uiStore';
import { useUserStore } from '../store/userStore';
import { useTasksStore } from '../store/tasksStore';
import { getModelById } from '../constants/models';
import { uploadFile } from '../api/upload';

/** Компонент ползунка 0.00–1.00 */
const Slider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}> = ({ label, value, onChange, hint }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1">
      <span className="text-sm font-semibold text-tg-text">{label}</span>
      <span className="text-sm font-mono text-tg-link">{value.toFixed(2)}</span>
    </div>
    {hint && <div className="text-xs text-tg-hint mb-2">{hint}</div>}
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-[var(--tg-theme-button-color,#2481cc)]"
    />
  </div>
);

/** Переключатель кнопок */
const ButtonGroup: React.FC<{
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}> = ({ label, options, value, onChange }) => (
  <div className="mb-4">
    <div className="text-sm font-semibold text-tg-text mb-2">{label}</div>
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-3 py-2 rounded-lg text-sm ${
            value === opt.key
              ? 'bg-tg-button text-tg-button-text'
              : 'bg-tg-secondary-bg text-tg-text'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

/** Компонент загрузки файла (фото/видео) */
const FileUploadInput: React.FC<{
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  previewUrl: string | null;
  uploading: boolean;
  uploadProgress: number;
  onChange: (file: File | null) => void;
  fileType: 'image' | 'video';
}> = ({ label, hint, accept, file, previewUrl, uploading, uploadProgress, onChange, fileType }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-4">
      <div className="text-sm font-semibold text-tg-text mb-2">{label}</div>
      <div className="text-xs text-tg-hint mb-2">{hint}</div>

      {!file ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center text-tg-hint hover:border-tg-link transition-colors"
        >
          <div className="text-2xl mb-1">{fileType === 'image' ? '\uD83D\uDDBC\uFE0F' : '\uD83C\uDFA5'}</div>
          <div className="text-sm">Нажмите для выбора файла</div>
        </button>
      ) : (
        <div className="relative bg-tg-secondary-bg rounded-xl p-3">
          {/* Preview */}
          {previewUrl && fileType === 'image' && (
            <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg mb-2" />
          )}
          {previewUrl && fileType === 'video' && (
            <video src={previewUrl} className="w-full h-32 object-cover rounded-lg mb-2" muted />
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-tg-text truncate flex-1 mr-2">{file.name}</div>
            {!uploading && (
              <button
                onClick={() => onChange(null)}
                className="text-red-500 text-sm font-semibold shrink-0"
              >
                Удалить
              </button>
            )}
          </div>

          {/* Прогресс загрузки */}
          {uploading && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-tg-button h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-xs text-tg-hint mt-1 text-center">Загрузка... {uploadProgress}%</div>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          onChange(f);
          // Сбрасываем input чтобы можно было выбрать тот же файл повторно
          e.target.value = '';
        }}
      />
    </div>
  );
};

const MUSIC_MODEL_ID = 'generate-music';

const Generate: React.FC = () => {
  const { selectedModel, setPage } = useUiStore();
  const { balance } = useUserStore();
  const { submitTask, loading } = useTasksStore();

  const model = selectedModel ? getModelById(selectedModel) : null;
  const isGenerateMusic = model?.model_id === MUSIC_MODEL_ID;
  const needsImage = model?.inputs?.image ?? false;
  const needsVideo = model?.inputs?.video ?? false;

  const [prompt, setPrompt] = useState('');

  // ── Image параметры ──
  const [aspectRatio, setAspectRatio] = useState('1:1');

  // ── Video параметры ──
  const [duration, setDuration] = useState('5');
  const [resolution, setResolution] = useState('720p');

  // ── File upload состояния ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Music параметры (generate-music) ──
  const [musicMv, setMusicMv] = useState('V4');
  const [customMode, setCustomMode] = useState(true);
  const [instrumental, setInstrumental] = useState(false);
  const [musicStyle, setMusicStyle] = useState('');
  const [musicTitle, setMusicTitle] = useState('');
  const [vocalGender, setVocalGender] = useState('f');
  const [styleWeight, setStyleWeight] = useState(0.50);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(0.50);
  const [audioWeight, setAudioWeight] = useState(0.50);

  // ── Music параметры (другие music-модели) ──
  const [genericMusicStyle, setGenericMusicStyle] = useState('');
  const [vocalType, setVocalType] = useState('instrumental');

  // Обработка выбора изображения
  const handleImageSelect = async (file: File | null) => {
    setUploadError(null);
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      setImageUrl(null);
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);
    setImageProgress(0);
    try {
      const url = await uploadFile(file, 'image', setImageProgress);
      setImageUrl(url);
    } catch (err) {
      setUploadError((err as Error).message);
      setImageFile(null);
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };

  // Обработка выбора видео
  const handleVideoSelect = async (file: File | null) => {
    setUploadError(null);
    if (!file) {
      setVideoFile(null);
      setVideoPreview(null);
      setVideoUrl(null);
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setUploadingVideo(true);
    setVideoProgress(0);
    try {
      const url = await uploadFile(file, 'video', setVideoProgress);
      setVideoUrl(url);
    } catch (err) {
      setUploadError((err as Error).message);
      setVideoFile(null);
      setVideoPreview(null);
    } finally {
      setUploadingVideo(false);
    }
  };

  const isUploading = uploadingImage || uploadingVideo;
  const filesReady =
    (!needsImage || imageUrl) && (!needsVideo || videoUrl);

  const canGenerate =
    model &&
    prompt.trim().length > 0 &&
    balance >= model.credits &&
    !loading &&
    !isUploading &&
    filesReady;

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

      // Передаём URL загруженных файлов для моделей с image/video input
      if (imageUrl) params.image_url = imageUrl;
      if (videoUrl) params.video_url = videoUrl;
    } else if (isGenerateMusic) {
      // Полные параметры для generate-music (PoYo AI Music)
      params.mv = musicMv;
      params.custom_mode = customMode;
      params.instrumental = instrumental;

      if (customMode) {
        if (musicStyle.trim()) params.style = musicStyle.trim();
        if (musicTitle.trim()) params.title = musicTitle.trim();
        if (!instrumental) params.vocal_gender = vocalGender;
        params.style_weight = styleWeight;
        params.weirdness_constraint = weirdnessConstraint;
        params.audio_weight = audioWeight;
      }
    } else if (model.category === 'music') {
      // Другие music-модели — базовые параметры
      if (genericMusicStyle.trim()) params.style = genericMusicStyle.trim();
      params.instrumental = vocalType === 'instrumental';
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
    <div className="min-h-screen bg-tg-bg p-4 pb-24">
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
        placeholder={
          isGenerateMusic
            ? 'Опишите настроение, жанр, темп, инструменты...'
            : 'Опишите, что хотите сгенерировать...'
        }
        rows={3}
        className="w-full bg-tg-secondary-bg rounded-xl px-4 py-3 text-tg-text placeholder-tg-hint mb-4 outline-none resize-none"
      />

      {/* ══════ Image параметры ══════ */}
      {model.category === 'image' && (
        <ButtonGroup
          label="Соотношение сторон"
          options={[
            { key: '1:1', label: '1:1' },
            { key: '16:9', label: '16:9' },
            { key: '9:16', label: '9:16' },
            { key: '4:3', label: '4:3' },
          ]}
          value={aspectRatio}
          onChange={setAspectRatio}
        />
      )}

      {/* ══════ File uploads (image/video) ══════ */}
      {needsImage && (
        <FileUploadInput
          label="Reference-изображение"
          hint="Персонаж/сцена для генерации. JPG, PNG, WebP до 10 МБ"
          accept="image/jpeg,image/png,image/webp"
          file={imageFile}
          previewUrl={imagePreview}
          uploading={uploadingImage}
          uploadProgress={imageProgress}
          onChange={handleImageSelect}
          fileType="image"
        />
      )}
      {needsVideo && (
        <FileUploadInput
          label="Reference-видео"
          hint="Видео с движениями для переноса. MP4, MOV до 100 МБ, 3-30 сек"
          accept="video/mp4,video/quicktime,video/webm"
          file={videoFile}
          previewUrl={videoPreview}
          uploading={uploadingVideo}
          uploadProgress={videoProgress}
          onChange={handleVideoSelect}
          fileType="video"
        />
      )}

      {/* Ошибка загрузки */}
      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <div className="text-sm text-red-600">{uploadError}</div>
        </div>
      )}

      {/* ══════ Video параметры ══════ */}
      {model.category === 'video' && (
        <>
          <ButtonGroup
            label="Длительность"
            options={[
              { key: '5', label: '5с' },
              { key: '10', label: '10с' },
            ]}
            value={duration}
            onChange={setDuration}
          />
          <ButtonGroup
            label="Разрешение"
            options={[
              { key: '720p', label: '720p' },
              { key: '1080p', label: '1080p' },
            ]}
            value={resolution}
            onChange={setResolution}
          />
        </>
      )}

      {/* ══════ Generate Music — полные параметры ══════ */}
      {isGenerateMusic && (
        <>
          {/* Model Version */}
          <ButtonGroup
            label="Model Version"
            options={[
              { key: 'V3.5', label: 'V3.5' },
              { key: 'V4', label: 'V4' },
              { key: 'V4.5', label: 'V4.5' },
              { key: 'V5', label: 'V5' },
            ]}
            value={musicMv}
            onChange={setMusicMv}
          />

          {/* Custom Mode */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-tg-text">Custom Mode</span>
              <button
                onClick={() => setCustomMode(!customMode)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  customMode ? 'bg-tg-button' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    customMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="text-xs text-tg-hint mt-1">
              Включите для настройки стиля, голоса и параметров генерации
            </div>
          </div>

          {/* Instrumental */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-tg-text">Instrumental</span>
              <button
                onClick={() => setInstrumental(!instrumental)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  instrumental ? 'bg-tg-button' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    instrumental ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="text-xs text-tg-hint mt-1">
              Без вокала — только инструменты
            </div>
          </div>

          {/* Custom Mode параметры */}
          {customMode && (
            <>
              {/* Style */}
              <div className="mb-4">
                <div className="text-sm font-semibold text-tg-text mb-2">Style</div>
                <input
                  type="text"
                  value={musicStyle}
                  onChange={(e) => setMusicStyle(e.target.value)}
                  placeholder="Pop, Rock, Jazz, Lo-fi, Electronic..."
                  className="w-full bg-tg-secondary-bg rounded-xl px-4 py-3 text-tg-text placeholder-tg-hint outline-none"
                />
              </div>

              {/* Title */}
              <div className="mb-4">
                <div className="text-sm font-semibold text-tg-text mb-2">Title (опционально)</div>
                <input
                  type="text"
                  value={musicTitle}
                  onChange={(e) => setMusicTitle(e.target.value)}
                  placeholder="Название трека"
                  className="w-full bg-tg-secondary-bg rounded-xl px-4 py-3 text-tg-text placeholder-tg-hint outline-none"
                />
              </div>

              {/* Vocal Gender (если не instrumental) */}
              {!instrumental && (
                <ButtonGroup
                  label="Vocal Gender"
                  options={[
                    { key: 'f', label: 'Женский' },
                    { key: 'm', label: 'Мужской' },
                  ]}
                  value={vocalGender}
                  onChange={setVocalGender}
                />
              )}

              {/* Ползунки */}
              <Slider
                label="Style Weight"
                value={styleWeight}
                onChange={setStyleWeight}
                hint="Насколько сильно AI следует стилю. Выше — точнее жанр"
              />

              <Slider
                label="Weirdness Constraint"
                value={weirdnessConstraint}
                onChange={setWeirdnessConstraint}
                hint="Экспериментальность. Выше — необычнее результат"
              />

              <Slider
                label="Audio Weight"
                value={audioWeight}
                onChange={setAudioWeight}
                hint="Баланс: выше — ближе к оригиналу, ниже — больше креатива"
              />
            </>
          )}
        </>
      )}

      {/* ══════ Другие Music модели — базовые параметры ══════ */}
      {model.category === 'music' && !isGenerateMusic && (
        <>
          <div className="mb-4">
            <div className="text-sm font-semibold text-tg-text mb-2">Стиль (опционально)</div>
            <input
              type="text"
              value={genericMusicStyle}
              onChange={(e) => setGenericMusicStyle(e.target.value)}
              placeholder="Pop, Rock, Lo-fi..."
              className="w-full bg-tg-secondary-bg rounded-xl px-4 py-3 text-tg-text placeholder-tg-hint outline-none"
            />
          </div>
          <ButtonGroup
            label="Тип"
            options={[
              { key: 'instrumental', label: 'Инструментал' },
              { key: 'vocal', label: 'С вокалом' },
            ]}
            value={vocalType}
            onChange={setVocalType}
          />
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
