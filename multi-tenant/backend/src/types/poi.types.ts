/*
 * poi.types.ts
 */

export interface POICategory {
  id: number;
  name: string;
  code: string;
  icon?: string | null;
  color?: string | null;
  default_weight?: number;
  description?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export type POIApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface POI {
  id: number;
  category_id?: number | null;
  category_name?: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  rating?: number | null;
  user_ratings_total?: number | null;
  time_crowd_score?: number | null;
  competitor_count?: number | null;
  weather_suitability_score?: number | null;
  cluster_id?: number | null;
  zone_id?: number | null;
  status?: POIApprovalStatus;
  raw_poi_id?: number | null;
  tags?: Record<string, any> | null;
  osm_id?: string | null;
  is_verified?: boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface POIRaw {
  id: number;
  osm_id?: string | null;
  name: string;
  category_raw?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  tags?: Record<string, any> | null;
  source: string;
  sync_batch_id?: string | null;
  is_processed: boolean;
  created_at?: Date | string;
}

export interface POICluster {
  id: number;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_meters?: number;
  poi_count: number;
  zone_id?: number | null;
  score?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface POIApprovalLog {
  id: number;
  poi_id: number;
  action: "APPROVE" | "REJECT" | "EDIT";
  actor_id: number;
  actor_name?: string;
  actor_role?: string;
  notes?: string | null;
  previous_state?: Record<string, any> | null;
  new_state?: Record<string, any> | null;
  created_at?: Date | string;
}
