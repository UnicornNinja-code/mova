/*
 * zone.types.ts
 */

import type { GeoJSONPolygon, GeoJSONMultiPolygon } from "./common.types.js";

export interface Zone {
  id: number;
  name: string;
  code?: string;
  description?: string | null;
  polygon: GeoJSONPolygon | GeoJSONMultiPolygon | string;
  center_lat?: number;
  center_lng?: number;
  color?: string;
  target_daily_sales?: number;
  priority_level?: number;
  is_active: boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface CreateZoneDto {
  name: string;
  code?: string;
  description?: string;
  polygon: any;
  center_lat?: number;
  center_lng?: number;
  color?: string;
  target_daily_sales?: number;
  priority_level?: number;
  is_active?: boolean;
}

export interface UpdateZoneDto {
  name?: string;
  code?: string;
  description?: string;
  polygon?: any;
  center_lat?: number;
  center_lng?: number;
  color?: string;
  target_daily_sales?: number;
  priority_level?: number;
  is_active?: boolean;
}
