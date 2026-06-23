import axios from 'axios';
import type { Recommendation } from '@/types/recommendation';

const RECOMMENDATION_API_URL = import.meta.env.VITE_RECOMMENDATION_API_URL || 'http://127.0.0.1:5000';

const api = axios.create({
  baseURL: RECOMMENDATION_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const recommendationService = {
  async getRecommendations(filters?: { status?: string; category_id?: number }): Promise<Recommendation[]> {
    const params: Record<string, any> = {};
    if (filters?.status && filters.status !== 'all') {
      params.status = filters.status;
    }
    if (filters?.category_id) {
      params.category_id = filters.category_id;
    }
    const response = await api.get<Recommendation[]>('/api/manager/recommendations', { params });
    return response.data;
  },

  async generateRecommendations(): Promise<Recommendation[]> {
    const response = await api.post<Recommendation[]>('/api/chat/recommendations');
    return response.data;
  },

  async updateStatus(id: number, status: 'implemented' | 'ignored'): Promise<Recommendation> {
    const response = await api.patch<Recommendation>(`/api/manager/recommendations/${id}`, { status });
    return response.data;
  }
};

export default recommendationService;
