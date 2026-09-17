/*
 * distributionService.ts
 * REST Client for Operational Sessions, Rider Duty Queue & Distribution Engine in TypeScript
 */

import { axiosInstance } from '../lib/axios';

export interface OperationalSession {
  id: string;
  session_code: string;
  session_date: string;
  time_slot: 'PAGI' | 'SIANG' | 'SORE' | 'MALAM' | string;
  start_time: string;
  end_time: string;
  status: 'OPEN' | 'ACTIVE' | 'CLOSED' | 'CANCELLED' | string;
  dss_config_version?: number;
}

export interface DutyQueueItem {
  queue_id?: string;
  id?: string;
  rider_id: string;
  rider_name: string;
  rider_username?: string;
  rider_email?: string;
  rider_is_active?: boolean;
  duty_date: string;
  confirmed_at: string;
  eligibility_status?: 'ELIGIBLE' | 'INELIGIBLE';
  status: 'WAITING' | 'PLOTTED' | 'NO_SHOW' | 'CANCELLED' | string;
}

export interface ZoneDistributionItem {
  id?: string;
  zone_id: string;
  zone_name: string;
  rank?: number;
  score?: number;
  topsis_score?: number;
  max_capacity: number;
  assigned_count: number;
  remaining_capacity: number;
  is_full?: boolean;
  status?: string;
}

export interface AssignmentItem {
  id: string;
  rider_id: string;
  rider_name: string;
  rider_email?: string;
  zone_id: string;
  zone_name: string;
  armada_id?: string;
  armada_code?: string;
  assignment_type: 'AUTO' | 'MANUAL';
  assignment_date: string;
  status: 'ASSIGNED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
  check_in_time?: string;
  check_out_time?: string;
  created_at: string;
}

export interface ArmadaAvailableItem {
  id: string;
  code: string;
  type: string;
  status: string;
}

export interface DistributionOverview {
  session?: OperationalSession;
  duty_date: string;
  time_slot?: string;
  summary: {
    total_waiting: number;
    total_plotted: number;
    total_capacity: number;
    total_remaining_capacity?: number;
    total_assigned: number;
    available_armadas_count: number;
  };
  duty_queue: DutyQueueItem[];
  zones: ZoneDistributionItem[];
  assignments: AssignmentItem[];
  available_armadas: ArmadaAvailableItem[];
}

export interface ProposedAllocation {
  rider_id: string;
  rider_name: string;
  rider_email?: string;
  zone_id: string;
  zone_name: string;
  topsis_rank: number;
  topsis_score?: number;
  reason: string;
}

export interface UnassignedRider {
  rider_id: string;
  rider_name: string;
  reason: string;
}

export interface DistributionPreviewResponse {
  session?: OperationalSession;
  is_empty: boolean;
  message?: string;
  total_riders_in_queue: number;
  allocations_count: number;
  unassigned_count: number;
  proposed_allocations: ProposedAllocation[];
  unassigned_riders: UnassignedRider[];
  zone_allocation_summary: Array<{
    zone_name: string;
    rank: number;
    count: number;
    max: number;
  }>;
}

export interface DistributionRunItem {
  id: string;
  run_number: string;
  session_code?: string;
  time_slot?: string;
  execution_type: string;
  total_riders: number;
  assigned_count: number;
  unassigned_count: number;
  executed_by_name?: string;
  executed_at: string;
}

export const distributionService = {
  getOverview: async (): Promise<DistributionOverview> => {
    const res = await axiosInstance.get('/distribution/overview');
    return res.data;
  },

  getPreview: async (): Promise<DistributionPreviewResponse> => {
    const res = await axiosInstance.get('/distribution/preview');
    return res.data;
  },

  confirmDistribution: async (data: {
    execution_type?: string;
    allocations: ProposedAllocation[];
    unassigned_riders?: UnassignedRider[];
    snapshot_hash?: string;
  }): Promise<{ msg?: string; message?: string; run: any; assignments: any[] }> => {
    const res = await axiosInstance.post('/distribution/confirm', data);
    return res.data;
  },

  autoDistribute: async (): Promise<{ msg?: string; message?: string; run?: any; assignments?: any[] }> => {
    const res = await axiosInstance.post('/distribution/auto');
    return res.data;
  },

  manualDistribute: async (data: {
    rider_id: string;
    zone_id: string;
    armada_id?: string;
  }): Promise<{ msg?: string; message?: string; assignment: AssignmentItem }> => {
    const res = await axiosInstance.post('/distribution/manual', data);
    return res.data;
  },

  emergencySwap: async (data: {
    previous_rider_id: string;
    new_rider_id: string;
    incident_type: string;
    notes?: string;
    armada_action?: "KEEP_ARMADA" | "SWAP_ARMADA" | string;
  }): Promise<any> => {
    const res = await axiosInstance.post('/distribution/emergency-swap', data);
    return res.data;
  },

  confirmDuty: async (rider_id?: string): Promise<any> => {
    const res = await axiosInstance.post('/distribution/duty-confirm', { rider_id });
    return res.data;
  },

  getDistributionRuns: async (limit = 20): Promise<DistributionRunItem[]> => {
    const res = await axiosInstance.get('/distribution/runs', { params: { limit } });
    return res.data?.runs || [];
  },

  updateRiderDutyStatus: async (riderId: string, status: string, notes?: string): Promise<any> => {
    const res = await axiosInstance.put(`/distribution/duty/${riderId}/status`, { status, notes });
    return res.data;
  },
};

