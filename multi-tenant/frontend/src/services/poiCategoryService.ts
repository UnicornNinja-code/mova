/*
 * poiCategoryService.ts
 * REST API client for POI Categories & C3 Time-Crowd Matrix
 */

import { axiosInstance } from "../lib/axios";

export interface PoiTimeScores {
  pagi: number;
  siang: number;
  sore: number;
  malam: number;
}

export interface PoiCategory {
  id: number | string;
  name: string;
  is_active: boolean;
  time_scores: PoiTimeScores;
  created_at?: string;
  updated_at?: string;
}

export const poiCategoryService = {
  /**
   * Get all POI categories with their time scores
   */
  getAllCategories: async (): Promise<PoiCategory[]> => {
    const res = await axiosInstance.get("/poi-categories");
    return res.data?.categories || res.data?.data || res.data || [];
  },

  /**
   * Toggle POI Category Active Status
   */
  toggleCategoryStatus: async (id: number | string): Promise<any> => {
    const res = await axiosInstance.put(`/poi-categories/${id}/toggle`);
    return res.data;
  },

  /**
   * Update time-based crowd scores for single category
   */
  updateTimeScores: async (id: number | string, timeScores: PoiTimeScores): Promise<any> => {
    const res = await axiosInstance.put(`/poi-categories/${id}/time-scores`, {
      PAGI: timeScores.pagi,
      SIANG: timeScores.siang,
      SORE: timeScores.sore,
      MALAM: timeScores.malam,
      time_scores: timeScores,
      score_pagi: timeScores.pagi,
      score_siang: timeScores.siang,
      score_sore: timeScores.sore,
      score_malam: timeScores.malam,
    });
    return res.data;
  },

  /**
   * Bulk update time-based crowd scores for multiple categories
   */
  bulkUpdateTimeScores: async (categories: Array<{ id: number | string; time_scores: PoiTimeScores }>): Promise<any> => {
    const res = await axiosInstance.post("/poi-categories/time-scores/bulk", { categories });
    return res.data;
  },
};
