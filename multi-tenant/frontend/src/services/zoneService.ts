/*
 * zoneService.ts
 * Zone Geofence Management REST Service
 */

import { axiosInstance } from "../lib/axios";
import type { ZoneFeature } from "./mapService";

export interface ZoneItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
  max_capacity: number;
  status: "ACTIVE" | "INACTIVE" | "RESTRICTED";
  polygon?: any;
  coordinates?: [number, number][];
  current_riders?: number;
  assigned_riders?: number;
  checked_in_riders?: number;
  occupancy_rate?: number;
  area_km2?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ZoneConfig {
  default_hub?: { lat: number; lng: number };
  hub_latitude?: number;
  hub_longitude?: number;
  max_zone_radius_km?: number;
  min_zone_area_km2?: number;
  max_zone_area_km2?: number;
  toll_road_prohibited?: boolean;
  protocol_road_prohibited?: boolean;
}

export interface ZoneValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    area_km2: number;
    max_distance_from_hub_km: number;
    radius_limit_km: number;
  };
}

export const zoneService = {
  getAllZones: async (params?: { status?: string; search?: string }): Promise<ZoneItem[]> => {
    const res = await axiosInstance.get("/zones", { params });
    return res.data?.zones || res.data || [];
  },

  getZoneConfig: async (): Promise<ZoneConfig> => {
    const res = await axiosInstance.get("/zones/config");
    return res.data?.config || res.data;
  },

  getZoneById: async (id: string): Promise<ZoneItem> => {
    const res = await axiosInstance.get(`/zones/${id}`);
    return res.data?.zone || res.data;
  },

  validateZonePolygon: async (payload: {
    polygon: any;
    name?: string;
    exclude_id?: string;
  }): Promise<ZoneValidationResult> => {
    const res = await axiosInstance.post("/zones/validate", payload);
    return res.data;
  },

  createZone: async (payload: {
    name: string;
    description?: string;
    max_capacity: number;
    status: "ACTIVE" | "INACTIVE";
    polygon: any;
  }): Promise<{ msg: string; zone: ZoneItem; warnings?: any[] }> => {
    const res = await axiosInstance.post("/zones", payload);
    return res.data;
  },

  updateZone: async (
    id: string,
    payload: {
      name: string;
      description?: string;
      max_capacity: number;
      status: "ACTIVE" | "INACTIVE";
      polygon: any;
    }
  ): Promise<{ msg: string; zone: ZoneItem; warnings?: any[] }> => {
    const res = await axiosInstance.put(`/zones/${id}`, payload);
    return res.data;
  },

  updateZoneStatus: async (
    id: string,
    status: "ACTIVE" | "INACTIVE"
  ): Promise<{ msg: string; zone: ZoneItem }> => {
    const res = await axiosInstance.patch(`/zones/${id}/status`, { status });
    return res.data;
  },

  updateZoneCapacity: async (
    id: string,
    max_capacity: number
  ): Promise<{ msg: string; zone: ZoneItem }> => {
    const res = await axiosInstance.patch(`/zones/${id}/capacity`, { max_capacity });
    return res.data;
  },

  deleteZone: async (id: string): Promise<{ msg: string }> => {
    const res = await axiosInstance.delete(`/zones/${id}`);
    return res.data;
  },
};
