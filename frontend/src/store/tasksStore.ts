import { create } from 'zustand';
import apiClient from '../api/client';

export interface Task {
  id: number;
  model_id: string;
  category: 'image' | 'video' | 'music';
  prompt: string;
  status: 'pending' | 'processing' | 'finished' | 'failed';
  result_url: string | null;
  credits_cost: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface TasksState {
  tasks: Task[];
  currentTask: Task | null;
  total: number;
  loading: boolean;

  /** Загрузить историю задач */
  fetchTasks: (limit?: number, offset?: number) => Promise<void>;

  /** Загрузить конкретную задачу */
  fetchTask: (taskId: number) => Promise<void>;

  /** Отправить задачу на генерацию */
  submitTask: (model: string, prompt: string, params?: Record<string, unknown>, category?: Task['category']) => Promise<number | null>;

  setCurrentTask: (task: Task | null) => void;
}

export const useTasksStore = create<TasksState>((set, _get) => ({
  tasks: [],
  currentTask: null,
  total: 0,
  loading: false,

  fetchTasks: async (limit = 20, offset = 0) => {
    set({ loading: true });
    try {
      const res = await apiClient.get('/api/tasks', { params: { limit, offset } });
      if (res.data.success) {
        const { tasks, total } = res.data.data;
        set((state) => ({
          tasks: offset === 0 ? tasks : [...state.tasks, ...tasks],
          total,
          loading: false,
        }));
      }
    } catch {
      set({ loading: false });
    }
  },

  fetchTask: async (taskId) => {
    try {
      const res = await apiClient.get(`/api/tasks/${taskId}`);
      if (res.data.success) {
        set({ currentTask: res.data.data });
      }
    } catch {
      // ошибка — не обновляем
    }
  },

  submitTask: async (model, prompt, params = {}, category = 'image' as Task['category']) => {
    set({ loading: true });
    try {
      const res = await apiClient.post('/api/generate', { model, prompt, params });
      if (res.data.success) {
        const { task_id, status, credits_reserved } = res.data.data;

        // Устанавливаем currentTask, чтобы Progress страница сразу могла его отображать
        const newTask: Task = {
          id: task_id,
          model_id: model,
          category,
          prompt,
          status: status || 'pending',
          result_url: null,
          credits_cost: credits_reserved || 0,
          error_message: null,
          created_at: new Date().toISOString(),
          completed_at: null,
        };

        set({ loading: false, currentTask: newTask });
        return task_id;
      }
      set({ loading: false });
      return null;
    } catch {
      set({ loading: false });
      return null;
    }
  },

  setCurrentTask: (task) => set({ currentTask: task }),
}));
