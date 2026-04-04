import { create } from 'zustand';
import { Category } from '../constants/models';

export type Page = 'home' | 'catalog' | 'generate' | 'progress' | 'history' | 'balance' | 'profile';

interface UiState {
  currentPage: Page;
  selectedModel: string | null;
  selectedCategory: Category | null;
  /** Навигация между страницами */
  setPage: (page: Page) => void;
  /** Выбор модели для генерации */
  setModel: (modelId: string) => void;
  /** Фильтр по категории */
  setCategory: (category: Category | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentPage: 'home',
  selectedModel: null,
  selectedCategory: null,

  setPage: (page) => set({ currentPage: page }),
  setModel: (modelId) => set({ selectedModel: modelId, currentPage: 'generate' }),
  setCategory: (category) => set({ selectedCategory: category, currentPage: 'catalog' }),
}));
