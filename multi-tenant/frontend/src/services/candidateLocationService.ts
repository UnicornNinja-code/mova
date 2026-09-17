/*
 * candidateLocationService.ts
 * Candidate Selling Locations & Micro-Spot DSS REST Service for Svelte 5 Frontend
 * Strictly aligned with swagger.ts contracts
 */

import { axiosInstance } from "../lib/axios";

export interface CandidateSellingLocationItem {
  id: string;
  zone_id: string;
  zone_name?: string;
  name: string;
  latitude: number;
  longitude: number;
  score?: number;
  rank?: number;
  estimated_crowd?: number;
  proximity_to_restricted_road_meters?: number;
  status?: "ACTIVE" | "INACTIVE" | "CANDIDATE";
  created_at?: string;
  updated_at?: string;
}

export interface CandidateEvaluationResult {
  evaluation_id: string;
  zone_id: string;
  zone_name?: string;
  evaluated_at: string;
  locations: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    topsis_score: number;
    rank: number;
    criteria_breakdown?: Record<string, number>;
  }>;
}

export interface CandidateExplanation {
  evaluation_id: string;
  location_id: string;
  location_name: string;
  explanation_summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}

export interface CandidateAuditSnapshot {
  evaluation_id: string;
  algorithm: string;
  weights_used: Record<string, number>;
  raw_matrix: any[];
  normalized_matrix: any[];
  ideal_best: Record<string, number>;
  ideal_worst: Record<string, number>;
  timestamp: string;
}

export const candidateLocationService = {
  /**
   * Get all candidate selling locations
   * GET /api/candidate-selling-locations
   */
  getAllLocations: async (params?: { zone_id?: string; limit?: number }): Promise<CandidateSellingLocationItem[]> => {
    const res = await axiosInstance.get("/candidate-selling-locations", { params });
    return res.data;
  },

  /**
   * Get candidate selling locations in a specific zone
   * GET /api/candidate-selling-locations/zone/{zoneId}
   */
  getLocationsByZone: async (zoneId: string): Promise<CandidateSellingLocationItem[]> => {
    const res = await axiosInstance.get(`/candidate-selling-locations/zone/${zoneId}`);
    return res.data;
  },

  /**
   * Get candidate selling location detail by ID
   * GET /api/candidate-selling-locations/{id}
   */
  getLocationById: async (id: string): Promise<CandidateSellingLocationItem> => {
    const res = await axiosInstance.get(`/candidate-selling-locations/${id}`);
    return res.data;
  },

  /**
   * Create a new candidate selling location
   * POST /api/candidate-selling-locations
   */
  createLocation: async (payload: {
    zone_id: string;
    name: string;
    latitude: number;
    longitude: number;
    estimated_crowd?: number;
  }): Promise<CandidateSellingLocationItem> => {
    const res = await axiosInstance.post("/candidate-selling-locations", payload);
    return res.data;
  },

  /**
   * Auto-generate candidate selling locations for a zone based on POI clusters
   * POST /api/candidate-selling-locations/generate/zone/{zoneId}
   */
  generateLocationsForZone: async (zoneId: string, payload?: { count?: number }): Promise<{ msg: string; generated_count: number }> => {
    const res = await axiosInstance.post(`/candidate-selling-locations/generate/zone/${zoneId}`, payload);
    return res.data;
  },

  /**
   * Evaluate a single candidate location
   * POST /api/candidate-selling-locations/{id}/evaluate
   */
  evaluateLocation: async (id: string): Promise<CandidateEvaluationResult> => {
    const res = await axiosInstance.post(`/candidate-selling-locations/${id}/evaluate`);
    return res.data;
  },

  /**
   * Evaluate all candidate locations in a zone via TOPSIS
   * POST /api/candidate-selling-locations/evaluate/zone/{zoneId}
   */
  evaluateZoneLocations: async (zoneId: string): Promise<CandidateEvaluationResult> => {
    const res = await axiosInstance.post(`/candidate-selling-locations/evaluate/zone/${zoneId}`);
    return res.data;
  },

  /**
   * Get historical evaluation result by evaluation ID
   * GET /api/candidate-selling-locations/evaluation/{evaluationId}
   */
  getEvaluationResult: async (evaluationId: string): Promise<CandidateEvaluationResult> => {
    const res = await axiosInstance.get(`/candidate-selling-locations/evaluation/${evaluationId}`);
    return res.data;
  },

  /**
   * Get detailed decision explanation for an evaluation
   * GET /api/candidate-selling-locations/evaluation/{evaluationId}/explanation
   */
  getEvaluationExplanation: async (evaluationId: string, locationId?: string): Promise<CandidateExplanation> => {
    const res = await axiosInstance.get(`/candidate-selling-locations/evaluation/${evaluationId}/explanation`, {
      params: locationId ? { location_id: locationId } : undefined,
    });
    return res.data;
  },

  /**
   * Get mathematical audit snapshot for candidate location evaluation
   * GET /api/candidate-selling-locations/evaluation/{evaluationId}/audit
   */
  getEvaluationAudit: async (evaluationId: string): Promise<CandidateAuditSnapshot> => {
    const res = await axiosInstance.get(`/candidate-selling-locations/evaluation/${evaluationId}/audit`);
    return res.data;
  },
};

export default candidateLocationService;
