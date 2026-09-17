/*
 * dssService.ts
 * Decision Support System (BWM-TOPSIS) REST Service in TypeScript
 */

import { axiosInstance } from "../lib/axios";

export interface BwmWeights {
  [criterion: string]: number;
}

export interface BwmCriteriaDetail {
  id: string | number;
  code: string;
  name: string;
  weight: number;
  weight_percentage: number;
}

export interface ActiveDssConfig {
  id?: string;
  name?: string;
  best_criteria_id?: string;
  worst_criteria_id?: string;
  best_criterion?: string;
  worst_criterion?: string;
  calculated_weights?: BwmWeights;
  weights?: BwmWeights;
  consistency_ratio: number;
  is_consistent: boolean;
  best_to_others?: Record<string, number>;
  worst_to_others?: Record<string, number>;
  created_at?: string;
  version?: number;
}

export interface BwmCalculationResult {
  best_criteria_id: string | number;
  worst_criteria_id: string | number;
  a_BW: number;
  weights: Record<string, number>;
  xi_star: number;
  ci: number;
  consistency_ratio: number;
  is_consistent: boolean;
  formatted_details: BwmCriteriaDetail[];
  mode?: string;
}

export interface TopsisRanking {
  rank: number;
  zone_id: string;
  zone_name: string;
  preference_score: number;
  preference_score_full?: number;
  d_pos: number;
  d_neg: number;
  traceability?: {
    raw_criteria: Record<string, any>;
    normalized_r: Record<string, number>;
    weighted_v: Record<string, number>;
  };
}

export interface TopsisRecommendationResponse {
  message?: string;
  time_slot: string;
  weight_source: string;
  total_evaluated_zones?: number;
  ideal_positive?: Record<string, number>;
  ideal_negative?: Record<string, number>;
  rankings: TopsisRanking[];
}

export interface HybridEvaluationResponse {
  evaluation_version: string;
  evaluated_at: string;
  time_slot: string;
  total_evaluated_zones: number;
  excluded_zones: any[];
  bwm_config: any;
  criteria_specs: Array<{ code: string; name: string; type: string; weight: number }>;
  topsis_summary: {
    ideal_positive: Record<string, number>;
    ideal_negative: Record<string, number>;
    column_metadata?: Record<string, any>;
    rankings: TopsisRanking[];
  };
  snapshot_id?: number | string | null;
}

export interface DssSnapshotItem {
  id: number | string;
  created_at: string;
  consistency_ratio: number;
  status: string;
  evaluation_version: string;
  time_slot: string;
  total_evaluated_zones: number;
  bwm_config_name: string;
  top_ranking_zone: string;
  details: any;
}

export const dssService = {
  /**
   * Get Active BWM Configuration
   */
  getActiveConfig: async (): Promise<ActiveDssConfig | null> => {
    const res = await axiosInstance.get("/dss/bwm/active");
    return res.data?.config || res.data?.data || res.data || null;
  },

  /**
   * Calculate & save BWM Weights via LP Solver
   */
  calculateBwmWeights: async (payload: {
    name?: string;
    best_criteria_id: string;
    worst_criteria_id: string;
    best_to_others: Record<string, number>;
    worst_to_others: Record<string, number>;
  }): Promise<{
    msg: string;
    config?: any;
    bwm_result: BwmCalculationResult;
  }> => {
    const res = await axiosInstance.post("/dss/bwm/calculate", payload);
    return res.data;
  },

  /**
   * Preview TOPSIS Impact given proposed BWM Weights (Simulasi Dampak Bobot)
   */
  previewBwmImpact: async (payload: {
    weights: Record<string, number>;
    time_slot?: string;
  }): Promise<{
    status: string;
    time_slot: string;
    rankings: TopsisRanking[];
    total_zones: number;
  }> => {
    const res = await axiosInstance.post("/dss/bwm/preview-impact", payload);
    return res.data;
  },

  /**
   * Activate specific BWM configuration version
   */
  activateBwmConfig: async (id: string | number): Promise<{ msg: string; config: any }> => {
    const res = await axiosInstance.post(`/dss/bwm/${id}/activate`);
    return res.data;
  },

  /**
   * Fetch all BWM Configurations history & versions
   */
  getAllConfigs: async (): Promise<ActiveDssConfig[]> => {
    const res = await axiosInstance.get("/dss/bwm/configs");
    return res.data?.configs || [];
  },

  /**
   * Run Hybrid BWM-TOPSIS Zone Evaluation
   */
  evaluateHybridTopsis: async (payload: {
    zone_ids?: string[] | null;
    time_slot?: string | null;
    lat?: number | null;
    lon?: number | null;
    bwm_config_id?: string | null;
  } = {}): Promise<HybridEvaluationResponse> => {
    const res = await axiosInstance.post("/dss/evaluate", payload);
    return res.data?.data || res.data;
  },

  /**
   * Fetch recent evaluation snapshots
   */
  getSnapshots: async (limit: number = 20): Promise<DssSnapshotItem[]> => {
    const res = await axiosInstance.get("/dss/snapshots", { params: { limit } });
    return res.data?.data || [];
  },

  /**
   * Fetch snapshot by ID
   */
  getSnapshotById: async (id: number | string): Promise<any> => {
    const res = await axiosInstance.get(`/dss/snapshots/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Get quick recommendations (for dashboard/riders)
   */
  getRecommendations: async (timeSlot?: string, lat?: number, lon?: number): Promise<TopsisRecommendationResponse> => {
    const params: any = {};
    if (timeSlot) params.time = timeSlot;
    if (lat) params.lat = lat;
    if (lon) params.lon = lon;
    const res = await axiosInstance.get("/dss/recommendations", { params });
    return res.data?.data || res.data;
  },

  /**
   * Get Raw Criteria Evaluation for single zone
   */
  getZoneRawEvaluation: async (zoneId: string | number, timeSlot?: string): Promise<any> => {
    const params = timeSlot ? { time: timeSlot } : {};
    const res = await axiosInstance.get(`/dss/zones/${zoneId}/raw-evaluation`, { params });
    return res.data?.data || res.data;
  },
};
