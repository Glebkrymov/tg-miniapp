import { create } from 'zustand';
import apiClient from '../api/client';

interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  credits: number;
  referral_code: string;
}

interface UserState {
  user: User | null;
  balance: number;
  loading: boolean;
  /** Получить профиль и баланс пользователя */
  fetchBalance: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  balance: 0,
  loading: false,

  fetchBalance: async () => {
    set({ loading: true });
    try {
      const res = await apiClient.get('/api/user/balance');
      if (res.data.success) {
        set({ balance: res.data.data.credits, loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  setUser: (user) => set({ user, balance: user.credits }),
}));
