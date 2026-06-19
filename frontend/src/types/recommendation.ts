export interface Recommendation {
  id: number;
  category_id: number;
  category_name: string;
  pattern_detected?: string;
  recommendation?: string;
  root_cause?: string;
  urgency?: 'low' | 'medium' | 'high';
  estimated_impact?: string;
  location?: string;
  complaint_count?: number;
  avg_resolution_h?: number;
  appeal_rate_pct?: number;
  top_keywords?: string;
  status?: 'pending' | 'implemented' | 'ignored';
  generated_at?: string;
  createdAt?: string;
}

export type RecommendationStatus = 'pending' | 'implemented' | 'ignored';
