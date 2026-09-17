/*
 * competitorService.ts
 * REST API client for Competitors & C6 Threat Index Management
 */

import { axiosInstance } from "../lib/axios";

export interface CompetitorItem {
  id: number | string;
  zone_id: number | string;
  zone_name?: string;
  name: string;
  category: "DIRECT_STARLING" | "LOW_PRICE_TAKEAWAY" | "INDIRECT_PREMIUM" | string;
  weight: number;
  latitude?: number | null;
  longitude?: number | null;
  source?: "SURVEY" | "POI_AUTOMATED" | string;
  created_at?: string;
}

export interface ZoneC6ScoreResponse {
  zone_id: number | string;
  zone_name: string;
  skor_c6: number;
  total_competitors_count: number;
  field_competitors_count: number;
  coffee_poi_count: number;
  details: CompetitorItem[];
}

export const competitorService = {
  /**
   * Get all competitors (optionally filtered by zoneId)
   */
  getAllCompetitors: async (zoneId?: number | string): Promise<CompetitorItem[]> => {
    const params = zoneId ? { zone_id: zoneId } : {};
    const res = await axiosInstance.get("/competitors", { params });
    return res.data?.competitors || res.data?.data || res.data || [];
  },

  /**
   * Get competitors by Zone ID
   */
  getCompetitorsByZone: async (zoneId: number | string): Promise<CompetitorItem[]> => {
    const res = await axiosInstance.get(`/competitors/zone/${zoneId}`);
    return res.data?.competitors || [];
  },

  /**
   * Get C6 Score Details for a Zone
   */
  getZoneC6Score: async (zoneId: number | string): Promise<ZoneC6ScoreResponse> => {
    const res = await axiosInstance.get(`/competitors/score/${zoneId}`);
    return res.data;
  },

  /**
   * Create new competitor survey record
   */
  createCompetitor: async (data: {
    zone_id: number | string;
    name: string;
    category?: string;
    weight?: number;
    latitude?: number | null;
    longitude?: number | null;
  }): Promise<any> => {
    const res = await axiosInstance.post("/competitors", data);
    return res.data;
  },

  /**
   * Delete competitor entry by ID
   */
  deleteCompetitor: async (id: number | string): Promise<any> => {
    const res = await axiosInstance.delete(`/competitors/${id}`);
    return res.data;
  },
};
