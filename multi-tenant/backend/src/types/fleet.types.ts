/*
 * fleet.types.ts
 * 3-Dimensional Armada & Fleet Management Architecture in TypeScript
 */

// Dimension 1: Fleet Lifecycle Status
export type FleetStatus = "ACTIVE" | "MAINTENANCE" | "RETIRED";

// Dimension 2: Reservation State
export type ReservationState = "AVAILABLE" | "HELD";

// Dimension 3: Operational Assignment State
export type AssignmentState = "UNASSIGNED" | "ASSIGNED" | "IN_USE";

export type ArmadaType = "MOTOR_LISTRIK" | "GEROBAK" | "LAINNYA";

// Backward-compatible alias
export type ArmadaStatus = "ACTIVE" | "MAINTENANCE" | "RETIRED" | "AVAILABLE" | "IN_USE" | "RESERVED";

export interface Armada {
  id: number | string;
  code: string;
  type: ArmadaType | string;
  status: FleetStatus | ArmadaStatus;
  current_rider_id?: number | string | null;
  current_rider_name?: string | null;
  reserved_by_rider_id?: number | string | null;
  reserved_until?: Date | string | null;
  reservation_state?: ReservationState;
  assignment_state?: AssignmentState;
  created_at?: Date | string;
  updated_at?: Date | string;
  [key: string]: any;
}

export interface FleetReservation {
  id: string;
  armada_id: string;
  rider_id: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "CLAIMED";
  inspection_checklist?: Record<string, boolean>;
  inspection_notes?: string;
  expires_at: Date | string;
  created_at: Date | string;
  released_at?: Date | string | null;
}

export interface FleetAssignment {
  id: string;
  armada_id: string;
  rider_id: string;
  zone_id?: string | null;
  assigned_date: string;
  status: "ASSIGNED" | "IN_USE" | "RETURNED" | "DAMAGED" | "CANCELLED";
  initial_condition?: Record<string, any>;
  return_condition?: Record<string, any>;
  claimed_at: Date | string;
  returned_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface FleetIssueReport {
  id: string;
  armada_id: string;
  rider_id: string;
  severity: "MINOR" | "CRITICAL";
  issue_type: "BATTERY" | "BRAKE" | "TIRE" | "COOLER" | "STOVE" | "OTHER" | string;
  description: string;
  status: "REPORTED" | "IN_REVIEW" | "REPLACED" | "RESOLVED" | "SENT_TO_MAINTENANCE";
  resolution_notes?: string | null;
  reported_at: Date | string;
  resolved_at?: Date | string | null;
}
