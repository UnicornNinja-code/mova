/*
 * other domain types
 */

export interface WeatherData {
  latitude: number;
  longitude: number;
  current_temperature?: number;
  current_weather_code?: number;
  precipitation_probability?: number;
  rain?: number;
  is_operational_safe: boolean;
  score: number;
  description?: string;
  updated_at: string;
}

export interface ProtocolRoad {
  id: number;
  osm_id?: string | null;
  name: string;
  road_type: string;
  geometry: any;
  is_protocol: boolean;
  is_toll: boolean;
  notes?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface CompetitorPOI {
  id: number;
  name: string;
  brand?: string;
  category?: string;
  latitude: number;
  longitude: number;
  distance_meters?: number;
  estimated_daily_traffic?: number;
  created_at?: Date | string;
}

export interface DistributionMatrixInput {
  hubs: Array<{ id: number; name: string; capacity: number; lat: number; lng: number }>;
  zones: Array<{ id: number; name: string; demand: number; lat: number; lng: number }>;
  riders: Array<{ id: number; name: string; max_capacity: number }>;
}

export interface CronJobStatus {
  id: string;
  name: string;
  cron_expression: string;
  is_active: boolean;
  last_run_at?: Date | string | null;
  next_run_at?: Date | string | null;
  last_status?: "SUCCESS" | "FAILED" | "RUNNING" | null;
  last_error_message?: string | null;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
  user_role?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | number | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  created_at?: Date | string;
}

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description?: string | null;
  type?: "STRING" | "NUMBER" | "BOOLEAN" | "JSON";
  updated_at?: Date | string;
}

export interface DashboardSummary {
  total_riders_active: number;
  total_sales_today: number;
  total_revenue_today: number;
  active_armadas: number;
  dss_evaluated_locations_count: number;
  weather_status_overview: string;
}
