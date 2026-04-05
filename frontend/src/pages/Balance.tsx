import React, { useEffect, useState } from 'react';
import { useUiStore } from '../store/uiStore';
import { useUserStore } from '../store/userStore';
import apiClient from '../api/client';

const packages = [
  { id: 'starter',  name: 'Стартовый',  credits: 200,    priceRub: 99    },
  { id: 'basic',    name: 'Базовый',    credits: 600,    priceRub: 249   },
  { id: 'popular',  name: 'Популярный', credits: 1500,   priceRub: 599   },
  { id: 'pro',      name: 'Профи',      credits: 4000,   priceRub: 1490  },
  { id: 'max',      name: 'Максимум',   credits: 10000,  priceRub: 3490  },
];

interface Transaction {
  id: number;
  type: string;
  credits_delta: number;
  description: string;
  created_at: string;
}

const Balance: React.FC = () => {
  const { setPage } = useUiStore();
  const { fetchBalance } = useUserStore();
  const balance = useUserStore((s) => s.balance);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [freeGens, setFreeGens] = useState<{ category: string; remaining: number }[]>([]);

  useEffect(() => {
    fetchBalance();
    loadTransactions();

    loadPromos();

    // Проверяем, вернулся ли пользователь после оплаты
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      // Обновляем баланс через пару секунд (webhook может прийти с задержкой)
      setTimeout(() => {
        fetchBalance();
        loadTransactions();
      }, 2000);
      // Убираем параметр из URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchBalance]);

  const loadTransactions = async () => {
    try {
      const res = await apiClient.get('/api/transactions', { params: { limit: 10 } });
      if (res.data.success) {
        setTransactions(res.data.data.transactions || []);
      }
    } catch {
      // тихо игнорируем
    }
  };

  const loadPromos = async () => {
    try {
      const res = await apiClient.get('/api/promo/my');
      if (res.data.success) {
        setFreeGens(res.data.data.free_generations || []);
      }
    } catch {
      // тихо игнорируем
    }
  };

  const handlePromo = async () => {
    if (!promoCode.trim() || promoLoading) return;
    setPromoLoading(true);
    setPromoMessage(null);

    try {
      const res = await apiClient.post('/api/promo/activate', { code: promoCode.trim() });
      if (res.data.success) {
        const data = res.data.data;
        if (data.type === 'credits') {
          setPromoMessage({ text: `Начислено ${data.credits_added} кредитов!`, success: true });
          fetchBalance();
        } else {
          const cat = data.allowed_category === 'video' ? 'видео' :
            data.allowed_category === 'music' ? 'музыки' :
            data.allowed_category === 'image' ? 'изображений' : 'любой категории';
          setPromoMessage({ text: `${data.free_generations} бесплатных генераций (${cat})`, success: true });
          loadPromos();
        }
        setPromoCode('');
        loadTransactions();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Ошибка активации';
      setPromoMessage({ text: msg, success: false });
    } finally {
      setPromoLoading(false);
    }
  };

  const handleBuy = async (packageId: string) => {
    if (loading) return;
    setLoading(packageId);

    try {
      const res = await apiClient.post('/api/payments/create', { package_id: packageId });
      if (res.data.success && res.data.data.confirmation_url) {
        // Открываем страницу оплаты YooKassa
        window.open(res.data.data.confirmation_url, '_blank');
      }
    } catch {
      // ошибка создания платежа
    } finally {
      setLoading(null);
    }
  };

  const formatPrice = (rub: number) => {
    return `${rub.toLocaleString('ru-RU')} ₽`;
  };

  return (
    <div className="min-h-screen bg-tg-bg p-4">
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setPage('home')} className="text-tg-link text-lg">←</button>
        <h1 className="text-xl font-bold text-tg-text">Баланс</h1>
      </div>

      {/* Большой баланс */}
      <div className="bg-tg-secondary-bg rounded-2xl p-6 text-center mb-6">
        <div className="text-4xl font-bold text-tg-text">{balance}</div>
        <div className="text-sm text-tg-hint mt-1">кредитов</div>
      </div>

      {/* Пакеты */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-tg-text mb-3">Пополнить</h2>
        <div className="space-y-2">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => handleBuy(pkg.id)}
              disabled={loading !== null}
              className="w-full bg-tg-secondary-bg rounded-xl p-4 flex items-center gap-3 active:opacity-80 transition-opacity disabled:opacity-50"
            >
              <div className="flex-1 text-left">
                <div className="font-semibold text-tg-text">{pkg.name}</div>
                <div className="text-sm text-tg-hint">{pkg.credits.toLocaleString()} кредитов</div>
              </div>
              <div className="bg-tg-button text-tg-button-text px-4 py-2 rounded-lg text-sm font-semibold">
                {loading === pkg.id ? '...' : formatPrice(pkg.priceRub)}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-tg-hint mt-3 text-center">
          Оплата банковской картой (Visa, MasterCard, МИР)
        </p>
      </div>

      {/* Промокод */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-tg-text mb-3">Промокод</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Введите промокод"
            className="flex-1 bg-tg-secondary-bg text-tg-text rounded-xl px-4 py-3 text-sm outline-none placeholder-tg-hint"
          />
          <button
            onClick={handlePromo}
            disabled={promoLoading || !promoCode.trim()}
            className="bg-tg-button text-tg-button-text px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {promoLoading ? '...' : 'OK'}
          </button>
        </div>
        {promoMessage && (
          <p className={`text-sm mt-2 ${promoMessage.success ? 'text-green-600' : 'text-red-500'}`}>
            {promoMessage.text}
          </p>
        )}
      </div>

      {/* Активные бонусы */}
      {freeGens.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-tg-text mb-3">Бесплатные генерации</h2>
          <div className="space-y-2">
            {freeGens.map((fg, i) => {
              const catName = fg.category === 'video' ? 'Видео' :
                fg.category === 'music' ? 'Музыка' :
                fg.category === 'image' ? 'Изображения' : 'Любая категория';
              return (
                <div key={i} className="bg-tg-secondary-bg rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm text-tg-text">{catName}</span>
                  <span className="text-sm font-semibold text-green-600">{fg.remaining} шт.</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Последние транзакции */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-tg-text mb-3">Последние операции</h2>
          <div className="space-y-1">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2">
                <div className="text-sm text-tg-text">{tx.description || tx.type}</div>
                <div className={`text-sm font-semibold ${tx.credits_delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.credits_delta > 0 ? '+' : ''}{tx.credits_delta}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Balance;
