/**
 * Target path: src/store/recommendationStore.ts (REPLACES existing file)
 *
 * CHANGE IN THIS VERSION
 * ------------------------
 * `lastGeneratedTime` was persisted under a single global localStorage
 * key ('last_recommendation_generation_time'), shared by every user of
 * the browser. This caused a real bug once faculty data isolation was
 * added:
 *
 *   1. Manager A logs in, generates recommendations -> timestamp written.
 *   2. Manager B logs in on the same browser (e.g. during testing).
 *   3. checkAndAutoGenerate() sees a timestamp < 48h old -- belonging to
 *      Manager A, not B -- and skips generateRecommendations() entirely,
 *      calling fetchRecommendations() instead.
 *   4. fetchRecommendations() correctly filters by Manager B's
 *      faculty_id, finds nothing (nothing was ever generated for B's
 *      faculty), and returns an empty list.
 *
 * Net effect: "no recommendations generated" for Manager B, even though
 * generation was never actually attempted for them -- it was silently
 * skipped because of another user's leftover cooldown state.
 *
 * Fix: the storage key is now scoped by the current user's id
 * (`last_recommendation_generation_time:<userId>`), read fresh from
 * localStorage at call time rather than trusted from possibly-stale
 * store state. Different managers on the same browser no longer share a
 * cooldown.
 */
import { create } from 'zustand';
import type { Recommendation } from '@/types/recommendation';
import recommendationService from '../api/recommendationService';
import { useAuthStore } from './authStore';

const STORAGE_KEY_PREFIX = 'last_recommendation_generation_time';

/** Build a per-user localStorage key so different managers on the same
 * browser never share a generation cooldown timestamp. */
function getStorageKey(): string {
  const userId = useAuthStore.getState().user?.id;
  return userId != null ? `${STORAGE_KEY_PREFIX}:${userId}` : `${STORAGE_KEY_PREFIX}:anonymous`;
}

function readLastGeneratedTime(): string | null {
  try {
    return localStorage.getItem(getStorageKey());
  } catch {
    return null;
  }
}

function writeLastGeneratedTime(iso: string): void {
  try {
    localStorage.setItem(getStorageKey(), iso);
  } catch {
    // localStorage may be unavailable (private browsing, quota) -- not fatal,
    // just means auto-generate will run more often than strictly necessary.
  }
}

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
  // NOTE: intentionally NOT read from localStorage at module-init time
  // anymore -- the current user isn't necessarily known yet when this
  // module loads. checkAndAutoGenerate() reads the per-user value fresh
  // from localStorage on every call instead.
  lastGeneratedTime: null,

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
      writeLastGeneratedTime(now);
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
    // Read fresh, per-user, rather than trusting `get().lastGeneratedTime`
    // -- that field could be stale/from-a-different-user if this store
    // hasn't been touched since a different manager was logged in.
    const lastGen = readLastGeneratedTime();
    set({ lastGeneratedTime: lastGen });

    const fortyEightHours = 48 * 60 * 60 * 1000;
    const shouldRegenerate = !lastGen || (Date.now() - new Date(lastGen).getTime() >= fortyEightHours);

    if (shouldRegenerate) {
      console.log('Last generation was more than 48 hours ago (or never) for this user. Regenerating recommendations...');
      try {
        await get().generateRecommendations();
      } catch (err) {
        console.error('Auto-generation failed:', err);
        // Fallback: still try to load what we have
        await get().fetchRecommendations();
      }
    } else {
      console.log('Skipping recommendation generation, last run for this user was less than 48 hours ago.');
      await get().fetchRecommendations();
    }
  }
}));