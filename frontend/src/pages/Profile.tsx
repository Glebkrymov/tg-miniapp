import React, { useEffect, useState } from 'react';
import { useUiStore } from '../store/uiStore';
import { useUserStore } from '../store/userStore';
import apiClient from '../api/client';

interface ReferralStats {
  total_referrals: number;
  total_generations: number;
  total_spent: number;
}

const Profile: React.FC = () => {
  const { setPage } = useUiStore();
  const { user } = useUserStore();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);

  const referralLink = user?.referral_code
    ? `https://t.me/${import.meta.env.VITE_BOT_USERNAME || 'your_bot'}?start=ref_${user.referral_code}`
    : '';

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await apiClient.get('/api/referrals');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch {
      // тихо
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const shareLink = () => {
    const text = 'Попробуй AI-генерацию изображений, видео и музыки! Получи 10 бонусных кредитов:';
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const tgUser = window.Telegram?.WebApp?.initDataUnsafe as Record<string, unknown> | undefined;
  const firstName = (tgUser?.user as Record<string, unknown>)?.first_name as string || user?.first_name || 'Пользователь';
  const username = (tgUser?.user as Record<string, unknown>)?.username as string || user?.username || '';

  return (
    <div className="min-h-screen bg-tg-bg p-4">
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setPage('home')} className="text-tg-link text-lg">←</button>
        <h1 className="text-xl font-bold text-tg-text">Профиль</h1>
      </div>

      {/* Аватар и имя */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-tg-button rounded-full flex items-center justify-center text-2xl text-tg-button-text">
          {firstName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-lg font-semibold text-tg-text">{firstName}</div>
          {username && <div className="text-sm text-tg-hint">@{username}</div>}
        </div>
      </div>

      {/* Реферальная ссылка */}
      <div className="bg-tg-secondary-bg rounded-xl p-4 mb-6">
        <div className="text-sm font-semibold text-tg-text mb-2">Реферальная ссылка</div>
        <div className="text-xs text-tg-hint mb-3 break-all">{referralLink}</div>
        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="flex-1 py-2 bg-tg-button text-tg-button-text rounded-lg text-sm font-semibold"
          >
            {copied ? 'Скопировано!' : 'Скопировать'}
          </button>
          <button
            onClick={shareLink}
            className="flex-1 py-2 bg-tg-secondary-bg border border-tg-button text-tg-button rounded-lg text-sm font-semibold"
          >
            Поделиться
          </button>
        </div>
        <div className="text-xs text-tg-hint mt-2">
          Вы и друг получите по 10 кредитов
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-tg-secondary-bg rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-tg-text">{stats?.total_generations || 0}</div>
          <div className="text-xs text-tg-hint mt-1">Генераций</div>
        </div>
        <div className="bg-tg-secondary-bg rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-tg-text">{stats?.total_spent || 0}</div>
          <div className="text-xs text-tg-hint mt-1">Потрачено</div>
        </div>
        <div className="bg-tg-secondary-bg rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-tg-text">{stats?.total_referrals || 0}</div>
          <div className="text-xs text-tg-hint mt-1">Друзей</div>
        </div>
      </div>

      {/* Кнопка поддержки */}
      <button
        onClick={() => window.open('https://t.me/your_support_bot', '_blank')}
        className="w-full py-3 bg-tg-secondary-bg text-tg-text rounded-xl font-semibold text-center"
      >
        Поддержка
      </button>
    </div>
  );
};

export default Profile;
