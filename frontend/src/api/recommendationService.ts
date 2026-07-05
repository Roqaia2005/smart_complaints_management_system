import axios from 'axios';
import type { Recommendation } from '@/types/recommendation';
import { useAuthStore } from '../store/authStore';
export const RECOMMENDATION_API_URL = 'http://127.0.0.1:5000';

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
  // Transparency metadata -- total_complaints above is WINDOWED
  // (last analysis_window_days only), not an all-time total.
  analysis_window_days?: number;
  total_complaints_lifetime?: number;
  data_truncated?: boolean;
  fetch_limit?: number;
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
  sla_hours?: number;
  sla_status?: 'within_sla' | 'at_risk' | 'breached';
  sla_source?: 'category' | 'default';
  trend?: 'Increasing' | 'Stable' | 'Decreasing';
  trend_change_pct?: number;
  quality_score?: number;
  quality_level?: 'Excellent' | 'Good' | 'Fair' | 'Poor';
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
  reason?: string;
  recommended_action?: string;
}

export interface ResolutionQualityFactor {
  raw_value: number;
  factor: number;
  weight: number;
  contribution: number;
}

export interface ResolutionQuality {
  quality_score: number;
  quality_level: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  sla_hours?: number;
  sla_status?: 'within_sla' | 'at_risk' | 'breached';
  sla_source?: 'category' | 'default';
  quality_factors: {
    appeal_rate: ResolutionQualityFactor;
    resolution_time: ResolutionQualityFactor;
    aging_backlog: ResolutionQualityFactor;
  };
}

export interface TemporalIntelligence {
  weekday_weekend?: {
    weekday_count: number;
    weekend_count: number;
    weekday_pct: number;
    weekend_pct: number;
    dominance?: string;
  };
  peak_day?: { day: string; count: number; share_pct: number; is_significant: boolean };
  peak_month?: { month: string; count: number; share_pct: number; is_significant: boolean };
  monthly_trend?: { month: string; count: number }[];
  weekly_trend?: { day: string; count: number }[];
  repeated_spikes?: { month: string; count: number; average: number; multiplier: number }[];
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
  resolution_quality?: ResolutionQuality;
  temporal_intelligence?: TemporalIntelligence;
}

export interface DssBundle {
  dashboard: DashboardMetrics;
  riskRanking: RiskRankingItem[];
  executiveSummary: ExecutiveSummary;
  alerts: SmartAlert[];
}

// ── Executive Briefing types ───────────────────────────────────────────────

export interface BriefingSection {
  section: string;
  text: string;
}

export interface BriefingResponse {
  sections: BriefingSection[];
  full_text: string;
  faculty_id?: number;
}

export interface BriefingAudioRequest {
  voice?: string;
  speed?: number;
}

export interface BriefingAudioResponse {
  audio_url?: string;
  sections: BriefingSection[];
  duration_estimate?: number;
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

  async getDashboardMetrics(forceRefresh = false): Promise<DashboardMetrics> {
    const response = await api.get<DashboardMetrics>('/api/dss/dashboard', {
      params: forceRefresh ? { refresh: true } : undefined,
    });
    return response.data;
  },

  async getRiskRanking(forceRefresh = false): Promise<RiskRankingItem[]> {
    const response = await api.get<RiskRankingItem[]>('/api/dss/risk-ranking', {
      params: forceRefresh ? { refresh: true } : undefined,
    });
    return response.data;
  },

  async getExecutiveSummary(forceRefresh = false): Promise<ExecutiveSummary> {
    const response = await api.get<ExecutiveSummary>('/api/dss/executive-summary', {
      params: forceRefresh ? { refresh: true } : undefined,
    });
    return response.data;
  },

  async getSmartAlerts(forceRefresh = false): Promise<SmartAlert[]> {
    const response = await api.get<SmartAlert[]>('/api/dss/alerts', {
      params: forceRefresh ? { refresh: true } : undefined,
    });
    return response.data;
  },

  async getCategoryInsight(categoryId: number, forceRefresh = false): Promise<CategoryInsight> {
    const response = await api.get<CategoryInsight>(`/api/dss/category/${categoryId}`, {
      params: forceRefresh ? { refresh: true } : undefined,
    });
    return response.data;
  },

  async getDssBundle(forceRefresh = false): Promise<DssBundle> {
    const [dashboard, riskRanking, executiveSummary, alerts] = await Promise.all([
      this.getDashboardMetrics(forceRefresh),
      this.getRiskRanking(forceRefresh),
      this.getExecutiveSummary(forceRefresh),
      this.getSmartAlerts(forceRefresh),
    ]);
    return { dashboard, riskRanking, executiveSummary, alerts };
  },

  // ── Executive Briefing ──────────────────────────────────────────────────

  async generateBriefing(): Promise<BriefingResponse> {
    const response = await api.post<BriefingResponse>('/api/briefing/generate');
    return response.data;
  },

  async generateBriefingAudio(request: BriefingAudioRequest): Promise<BriefingAudioResponse> {
    const response = await api.post<BriefingAudioResponse>('/api/briefing/audio', request);
    return response.data;
  },

  async getBriefingStatus(): Promise<{ status: string; service: string; features: Record<string, boolean> }> {
    const response = await api.get('/api/briefing/status');
    return response.data;
  },
};

export default recommendationService;