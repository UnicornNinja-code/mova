/*
 * dss.types.ts
 * Type definitions for BWM (Best-Worst Method) and TOPSIS Multi-Criteria Decision Support System
 */

export interface DSSCriteria {
  id: string | number;
  code: string;
  name: string;
  type: "BENEFIT" | "COST";
  weight: number;
  description?: string;
  is_active?: boolean;
}

export interface BwmInputData {
  best_criteria_id: string | number;
  worst_criteria_id: string | number;
  best_to_others: Record<string, number>;
  worst_to_others: Record<string, number>;
  criteria_list: Array<{ id: string | number; code: string; name: string }>;
}

export interface BwmWeightResult {
  weights: Record<string, number>;
  optimal_weights: Array<{
    criteria_id: string | number;
    code: string;
    name: string;
    weight: number;
  }>;
  xi_star: number;
  consistency_ratio: number;
  is_consistent: boolean;
  ci_value: number;
  logs?: string[];
}

export interface CandidateCriteriaRawValues {
  [criteriaCode: string]: number;
}

export interface CandidateLocationInput {
  id: number | string;
  name: string;
  cluster_id?: number | null;
  latitude: number;
  longitude: number;
  zone_id?: number | null;
  criteria_values: CandidateCriteriaRawValues;
  metadata?: Record<string, any>;
}

export interface TopsisRankedCandidate {
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
  zone_id?: number | null;
  cluster_id?: number | null;
  distance_positive: number;
  distance_negative: number;
  preference_score: number; // V_i in [0, 1]
  rank: number;
  criteria_values: CandidateCriteriaRawValues;
  normalized_values?: Record<string, number>;
  weighted_values?: Record<string, number>;
  explainability?: CandidateExplainability;
}

export interface CandidateExplainability {
  strengths: string[];
  weaknesses: string[];
  recommendation_reason: string;
  suitability_level: "Sangat Direkomendasikan" | "Direkomendasikan" | "Cukup" | "Kurang Direkomendasikan";
}

export interface HybridBwmTopsisResult {
  bwm_result: BwmWeightResult;
  ranked_candidates: TopsisRankedCandidate[];
  ideal_positive_solution: Record<string, number>;
  ideal_negative_solution: Record<string, number>;
  total_candidates: number;
  evaluated_at: string;
}
