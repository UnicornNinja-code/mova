/*
 * rider.types.ts & lbs.types.ts
 */

export type RiderDutyStatus = "WAITING" | "PLOTTED" | "CHECKED_IN" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

export type ShiftStatus = "OFFLINE" | "CHECKED_IN" | "ON_DUTY" | "RESTING" | "CHECKED_OUT";

export interface RiderDutyQueue {
  id: number | string;
  rider_id: number | string;
  duty_date: string | Date;
  session_id?: string | null;
  confirmed_at?: Date | string;
  status: RiderDutyStatus;
  eligibility_status?: string;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface RiderShiftSession {
  id: number;
  rider_id: number;
  armada_id?: number | null;
  zone_id?: number | null;
  target_location_id?: number | null;
  shift_status: ShiftStatus;
  check_in_time?: Date | string;
  check_out_time?: Date | string | null;
  initial_battery?: number | null;
  final_battery?: number | null;
  total_sales_cup?: number;
  total_revenue?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface RiderLocationPing {
  rider_id: number;
  rider_name?: string;
  armada_id?: number | null;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  battery?: number;
  timestamp: string | number;
}

export interface GeofenceCheckResult {
  is_inside_zone: boolean;
  zone_id?: number | null;
  zone_name?: string | null;
  distance_to_boundary_meters?: number;
  violation_type?: "OUT_OF_BOUNDS" | "WRONG_ZONE" | null;
}
