/*
 * poiService.ts
 * POI (Point of Interest) & Spatial Clustering REST Service for Svelte 5 Frontend
 * Strictly aligned with swagger.ts contracts
 */

import { axiosInstance } from "../lib/axios";

export interface POIItem {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  zone_id?: string | null;
  zone_name?: string | null;
  status?: "APPROVED" | "PENDING" | "REJECTED";
  weight?: number;
  created_at?: string;
  updated_at?: string;
}

export interface POIScoreReport {
  zone_id: string;
  zone_name: string;
  c1_density_score?: number;
  c2_diversity_score?: number;
  c3_crowd_score?: number;
  c4_weather_score?: number;
  c5_distance_score?: number;
  c6_competitor_score?: number;
  details?: any;
}

export interface POIApprovalLog {
  id: string;
  poi_id: string;
  poi_name: string;
  action: "APPROVED" | "REJECTED";
  admin_name: string;
  notes?: string;
  created_at: string;
}

export const poiService = {
  /**
   * Get all POIs with optional category and zone filters
   * GET /api/pois
   */
  getAllPOIs: async (params?: { category?: string; zone_id?: string; limit?: number }): Promise<POIItem[]> => {
    const res = await axiosInstance.get("/pois", { params });
    return res.data;
  },

  /**
   * Get POIs in a specific operational zone
   * GET /api/pois/zone/{zone_id}
   */
  getPOIsInZone: async (zoneId: string): Promise<POIItem[]> => {
    const res = await axiosInstance.get(`/pois/zone/${zoneId}`);
    return res.data;
  },

  /**
   * Get pending POIs waiting for admin approval
   * GET /api/pois/pending
   */
  getPendingPOIs: async (): Promise<POIItem[]> => {
    const res = await axiosInstance.get("/pois/pending");
    return res.data;
  },

  /**
   * Approve or reject a pending POI
   * POST /api/pois/approve
   */
  approvePOI: async (payload: { poi_id: string; action: "APPROVED" | "REJECTED"; notes?: string }): Promise<{ msg: string }> => {
    const res = await axiosInstance.post("/pois/approve", payload);
    return res.data;
  },

  /**
   * Get POI approval history logs
   * GET /api/pois/approval-logs
   */
  getApprovalLogs: async (): Promise<POIApprovalLog[]> => {
    const res = await axiosInstance.get("/pois/approval-logs");
    return res.data;
  },

  /**
   * Sync POIs from OpenStreetMap (OSM) Overpass API
   * POST /api/pois/sync-osm
   */
  syncOSM: async (payload?: { zone_id?: string; category?: string }): Promise<{ msg: string; synced_count?: number }> => {
    const res = await axiosInstance.post("/pois/sync-osm", payload);
    return res.data;
  },

  /**
   * Sync city-wide POIs
   * POST /api/pois/sync-city
   */
  syncCity: async (payload?: { city_name?: string }): Promise<{ msg: string; total_synced?: number }> => {
    const res = await axiosInstance.post("/pois/sync-city", payload);
    return res.data;
  },

  /**
   * Recluster POIs using PostGIS ST_ClusterDBSCAN
   * POST /api/pois/recluster
   */
  reclusterPOIs: async (payload?: { eps_meters?: number; min_points?: number }): Promise<{ msg: string; clusters_formed?: number }> => {
    const res = await axiosInstance.post("/pois/recluster", payload);
    return res.data;
  },

  /**
   * Reprocess local dataset POIs
   * POST /api/pois/reprocess-local
   */
  reprocessLocal: async (): Promise<{ msg: string; reprocessed_count?: number }> => {
    const res = await axiosInstance.post("/pois/reprocess-local");
    return res.data;
  },

  /**
   * Get POI spatial leakage report (POIs outside operational boundaries)
   * GET /api/pois/leakage-report
   */
  getLeakageReport: async (): Promise<{ total_leaked: number; leaked_pois: POIItem[] }> => {
    const res = await axiosInstance.get("/pois/leakage-report");
    return res.data;
  },

  /**
   * Trigger background cron detection for new POIs
   * POST /api/pois/cron/detect
   */
  triggerCronDetect: async (): Promise<{ msg: string }> => {
    const res = await axiosInstance.post("/pois/cron/detect");
    return res.data;
  },

  /**
   * Get C1 (Density) & C2 (Diversity) score for a zone
   * GET /api/pois/scores/c1-c2/{zone_id}
   */
  getC1C2Score: async (zoneId: string): Promise<POIScoreReport> => {
    const res = await axiosInstance.get(`/pois/scores/c1-c2/${zoneId}`);
    return res.data;
  },

  /**
   * Get C3 (Time-Crowd) score for a zone
   * GET /api/pois/scores/c3/{zone_id}
   */
  getC3Score: async (zoneId: string, timeSlot?: string): Promise<POIScoreReport> => {
    const res = await axiosInstance.get(`/pois/scores/c3/${zoneId}`, {
      params: timeSlot ? { time_slot: timeSlot } : undefined,
    });
    return res.data;
  },

  /**
   * Get C4 (Weather) score for a zone
   * GET /api/pois/scores/c4/{zone_id}
   */
  getC4Score: async (zoneId: string): Promise<POIScoreReport> => {
    const res = await axiosInstance.get(`/pois/scores/c4/${zoneId}`);
    return res.data;
  },

  /**
   * Get C5 (Distance from Hub) score for a zone
   * GET /api/pois/scores/c5/{zone_id}
   */
  getC5Score: async (zoneId: string): Promise<POIScoreReport> => {
    const res = await axiosInstance.get(`/pois/scores/c5/${zoneId}`);
    return res.data;
  },

  /**
   * Get C6 (Competitor Presence) score for a zone
   * GET /api/pois/scores/c6/{zone_id}
   */
  getC6Score: async (zoneId: string): Promise<POIScoreReport> => {
    const res = await axiosInstance.get(`/pois/scores/c6/${zoneId}`);
    return res.data;
  },
};

export default poiService;
