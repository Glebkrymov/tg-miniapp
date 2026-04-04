/**
 * Пакеты кредитов для покупки через Telegram Stars.
 */

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  /** Цена в Telegram Stars (1 Star ~ $0.02) */
  priceStars: number;
}

export const PACKAGES: CreditPackage[] = [
  { id: 'starter',  name: 'Стартовый',   credits: 200,   priceUsd: 1.00,  priceStars: 50   },
  { id: 'basic',    name: 'Базовый',     credits: 600,   priceUsd: 2.50,  priceStars: 130  },
  { id: 'popular',  name: 'Популярный',  credits: 1500,  priceUsd: 6.00,  priceStars: 310  },
  { id: 'pro',      name: 'Профи',       credits: 4000,  priceUsd: 15.00, priceStars: 780  },
  { id: 'max',      name: 'Максимум',    credits: 10000, priceUsd: 35.00, priceStars: 1800 },
];

export const PACKAGES_MAP = new Map(PACKAGES.map((p) => [p.id, p]));

export function getPackage(packageId: string): CreditPackage | undefined {
  return PACKAGES_MAP.get(packageId);
}
