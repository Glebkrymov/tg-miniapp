import React, { useEffect, useState } from 'react';
import { useUiStore } from '../store/uiStore';
import { useUserStore } from '../store/userStore';
import apiClient from '../api/client';

const packages = [
  { id: 'starter',  name: 'Стартовый',  credits: 200,    priceUsd: 1.00,  priceStars: 50   },
  { id: 'basic',    name: 'Базовый',    credits: 600,    priceUsd: 2.50,  priceStars: 130  },
  { id: 'popular',  name: 'Популярный', credits: 1500,   priceUsd: 6.00,  priceStars: 310  },
  { id: 'pro',      name: 'Профи',      credits: 4000,   priceUsd: 15.00, priceStars: 780  },
  { id: 'max',      name: 'Максимум',   credits: 10000,  priceUsd: 35.00, priceStars: 1800 },
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
  const { balance, fetchBalance } = useUserStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetchBalance();
    loadTransactions();
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

  const handleBuy = async (packageId: string) => {
    try {
      const res = await apiClient.post('/api/payments/create-invoice', { package_id: packageId });
      if (res.data.success && res.data.data.invoice_url) {
        window.Telegram?.WebApp?.openInvoice(res.data.data.invoice_url, (status) => {
          if (status === 'paid') {
            fetchBalance();
            loadTransactions();
          }
        });
      }
    } catch {
      // ошибка создания инвойса
    }
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
              className="w-full bg-tg-secondary-bg rounded-xl p-4 flex items-center gap-3 active:opacity-80 transition-opacity"
            >
              <div className="flex-1 text-left">
                <div className="font-semibold text-tg-text">{pkg.name}</div>
                <div className="text-sm text-tg-hint">{pkg.credits.toLocaleString()} кредитов</div>
              </div>
              <div className="bg-tg-button text-tg-button-text px-4 py-2 rounded-lg text-sm font-semibold">
                ${pkg.priceUsd.toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      </div>

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
