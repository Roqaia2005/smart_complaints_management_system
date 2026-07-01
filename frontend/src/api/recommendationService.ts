import axios from 'axios';
import type { Recommendation } from '@/types/recommendation';
import { useAuthStore } from '../store/authStore';

const RECOMMENDATION_API_URL ='http://127.0.0.1:5000';

const api = axios.create({
  baseURL: RECOMMENDATION_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── DSS types (Decision Support System) ──────────────────────────────────

export type RiskLevel = 'Low' | 'Medium' | 'High';
export type AlertSeverity = 'high' | 'medium' | 'low';

export interface DashboardMetrics {
  total_complaints: number;
  unresolved_complaints: number;
  resolved_complaints: number;
  overall_risk_score: number;
  overall_risk_level: RiskLevel;
  categories_analyzed: number;
  categories_above_threshold: number;
  high_priority_unresolved: number;
  avg_appeal_rate_pct: number;
  top_hotspot_location: string;
  generated_at: string;
}

export interface RiskRankingItem {
  rank: number;
  category_id: number;
  category_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  unresolved_count: number;
  complaint_count: number;
  appeal_rate_pct: number;
  high_priority_pct: number;
  dominant_location: string;
  hotspot_location?: string;
  hotspot_share_pct?: number;
}

export interface ExecutiveSummary {
  summary: string;
  key_findings: string[];
  overall_risk_score: number;
  overall_risk_level: RiskLevel;
  generated_at: string;
}

export interface SmartAlert {
  severity: AlertSeverity;
  category_id: number;
  category_name: string;
  alert_type: string;
  message: string;
  metric_value: number;
}

export interface CategoryInsight {
  category_id: number;
  category_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  unresolved_count: number;
  complaint_count: number;
  appeal_rate_pct: number;
  high_priority_pct: number;
  findings: string[];
  confident_root_cause?: string;
  dominant_keywords: string[];
}

export interface DssBundle {
  dashboard: DashboardMetrics;
  riskRanking: RiskRankingItem[];
  executiveSummary: ExecutiveSummary;
  alerts: SmartAlert[];
}

// ── Service ──────────────────────────────────────────────────────────────

export const recommendationService = {
  async getRecommendations(filters?: { status?: string; category_id?: number }): Promise<Recommendation[]> {
    const params: Record<string, string | number> = {};
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
  },

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const response = await api.get<DashboardMetrics>('/api/dss/dashboard');
    return response.data;
  },

  async getRiskRanking(): Promise<RiskRankingItem[]> {
    const response = await api.get<RiskRankingItem[]>('/api/dss/risk-ranking');
    return response.data;
  },

  async getExecutiveSummary(): Promise<ExecutiveSummary> {
    const response = await api.get<ExecutiveSummary>('/api/dss/executive-summary');
    return response.data;
  },

  async getSmartAlerts(): Promise<SmartAlert[]> {
    const response = await api.get<SmartAlert[]>('/api/dss/alerts');
    return response.data;
  },

  async getCategoryInsight(categoryId: number): Promise<CategoryInsight> {
    const response = await api.get<CategoryInsight>(`/api/dss/category/${categoryId}`);
    return response.data;
  },

  async getDssBundle(): Promise<DssBundle> {
    const [dashboard, riskRanking, executiveSummary, alerts] = await Promise.all([
      this.getDashboardMetrics(),
      this.getRiskRanking(),
      this.getExecutiveSummary(),
      this.getSmartAlerts(),
    ]);
    return { dashboard, riskRanking, executiveSummary, alerts };
  },
};

export default recommendationService;
