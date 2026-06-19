import { create } from 'zustand';
import type { Recommendation } from '@/types/recommendation';
import recommendationService from '../api/recommendationService';

interface RecommendationStore {
  recommendations: Recommendation[];
  loading: boolean;
  generating: boolean;
  error: string | null;
  lastGeneratedTime: string | null;
  fetchRecommendations: (filters?: { status?: string; category_id?: number }) => Promise<void>;
  generateRecommendations: () => Promise<void>;
  updateStatus: (id: number, status: 'implemented' | 'ignored') => Promise<void>;
  checkAndAutoGenerate: () => Promise<void>;
}

export const useRecommendationStore = create<RecommendationStore>((set, get) => ({
  recommendations: [],
  loading: false,
  generating: false,
  error: null,
  lastGeneratedTime: localStorage.getItem('last_recommendation_generation_time'),

  fetchRecommendations: async (filters) => {
    set({ loading: true, error: null });
    try {
      const data = await recommendationService.getRecommendations(filters);
      set({ recommendations: data, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch recommendations', loading: false });
    }
  },

  generateRecommendations: async () => {
    set({ generating: true, error: null });
    try {
      await recommendationService.generateRecommendations();
      const now = new Date().toISOString();
      localStorage.setItem('last_recommendation_generation_time', now);
      set({ lastGeneratedTime: now, generating: false });
      // After generation completes, refresh the list
      await get().fetchRecommendations();
    } catch (err: any) {
      set({ error: err.message || 'Failed to generate recommendations', generating: false });
      throw err;
    }
  },

  updateStatus: async (id, status) => {
    try {
      await recommendationService.updateStatus(id, status);
      // Update UI immediately (optimistic local update)
      set((state) => ({
        recommendations: state.recommendations.map((rec) =>
          rec.id === id ? { ...rec, status } : rec
        ),
      }));
      // Refresh recommendation list from the server
      await get().fetchRecommendations();
    } catch (err: any) {
      set({ error: err.message || 'Failed to update status' });
      throw err;
    }
  },

  checkAndAutoGenerate: async () => {
    const lastGen = get().lastGeneratedTime;
    const fortyEightHours = 48 * 60 * 60 * 1000;
    
    const shouldRegenerate = !lastGen || (Date.now() - new Date(lastGen).getTime() >= fortyEightHours);
    
    if (shouldRegenerate) {
      console.log('Last generation was more than 48 hours ago (or never). Regenerating recommendations...');
      try {
        await get().generateRecommendations();
      } catch (err) {
        console.error('Auto-generation failed:', err);
        // Fallback: still try to load what we have
        await get().fetchRecommendations();
      }
    } else {
      console.log('Skipping recommendation generation, last run was less than 48 hours ago.');
      await get().fetchRecommendations();
    }
  }
}));
