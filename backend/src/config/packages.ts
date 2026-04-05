/**
 * Пакеты кредитов для покупки через YooKassa (банковские карты, RUB).
 */

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  /** Цена в рублях */
  priceRub: number;
}

export const PACKAGES: CreditPackage[] = [
  { id: 'starter',  name: 'Стартовый',   credits: 200,   priceRub: 99    },
  { id: 'basic',    name: 'Базовый',     credits: 600,   priceRub: 249   },
  { id: 'popular',  name: 'Популярный',  credits: 1500,  priceRub: 599   },
  { id: 'pro',      name: 'Профи',       credits: 4000,  priceRub: 1490  },
  { id: 'max',      name: 'Максимум',    credits: 10000, priceRub: 3490  },
];

export const PACKAGES_MAP = new Map(PACKAGES.map((p) => [p.id, p]));

export function getPackage(packageId: string): CreditPackage | undefined {
  return PACKAGES_MAP.get(packageId);
}
