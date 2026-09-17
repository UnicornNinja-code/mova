/*
 * setupService.ts
 * REST API client for First-Run System Setup / Initial Configuration Wizard in TypeScript
 */

import { axiosInstance } from "../lib/axios";

export interface SetupStatusResponse {
  status: "REQUIRED" | "IN_PROGRESS" | "COMPLETED";
  setup_progress: {
    identity_configured: boolean;
    operations_configured: boolean;
    dss_calibrated: boolean;
  };
  current_step: string;
  completed_at?: string;
  hub_config: {
    system_name: string;
    hub_city_name: string;
    central_hub_name: string;
    central_hub_address: string;
    central_hub_lat: number;
    central_hub_lng: number;
    timezone: string;
  };
}

export interface InitialFleetUnit {
  code: string;
  name?: string;
  type: string;
  status: string;
}

export interface SetupStepPayload {
  step_id: string; // 'IDENTITY' | 'OPERATIONS' | 'FLEET' | 'MAP' | 'DSS' | 'SYNC' | 'REVIEW'
  data: {
    system_name?: string;
    business_name?: string;
    hub_city_name?: string;
    central_hub_name?: string;
    central_hub_address?: string;
    central_hub_lat?: number;
    central_hub_lng?: number;
    operational_radius_km?: number;
    operating_hours_start?: string;
    operating_hours_end?: string;
    timezone?: string;
    initial_fleets?: InitialFleetUnit[];
    default_basemap?: string;
    default_zoom?: number;
    show_hub_radius?: boolean;
    show_protocol_roads?: boolean;
    show_poi?: boolean;
    show_weather?: boolean;
    [key: string]: any;
  };
}

export interface ApplySetupPayload {
  system_name?: string;
  business_name?: string;
  hub_city_name?: string;
  central_hub_name?: string;
  central_hub_address?: string;
  central_hub_lat?: number;
  central_hub_lng?: number;
  operational_radius_km?: number;
  operating_hours_start?: string;
  operating_hours_end?: string;
  timezone?: string;
  initial_fleets?: InitialFleetUnit[];
  default_basemap?: string;
  default_zoom?: number;
  show_hub_radius?: boolean;
  show_protocol_roads?: boolean;
  show_poi?: boolean;
  show_weather?: boolean;
  dss_best_id?: string;
  dss_worst_id?: string;
  dss_weights?: Record<string, number>;
  dss_baseline_accepted?: boolean;
}

export const setupService = {
  /**
   * Fetch current system setup and initialization state
   */
  getSetupStatus: async (): Promise<SetupStatusResponse> => {
    const res = await axiosInstance.get("/system/setup-status");
    return res.data;
  },

  /**
   * Save wizard step intermediate progress
   */
  saveSetupStep: async (payload: SetupStepPayload): Promise<{ success: boolean; msg: string }> => {
    const res = await axiosInstance.post("/system/setup-step", payload);
    return res.data;
  },

  /**
   * Apply final configuration and set SYSTEM_INITIALIZED = true
   */
  applySetup: async (payload: ApplySetupPayload): Promise<{ success: boolean; msg: string; status: string }> => {
    const res = await axiosInstance.post("/system/apply-setup", payload);
    return res.data;
  },

  /**
   * Start distributed spatial ETL flow via BullMQ FlowProducer
   */
  startSpatialSync: async (): Promise<any> => {
    const res = await axiosInstance.post("/system/sync/start");
    return res.data;
  },

  /**
   * Partial retry for single failed dataset
   */
  retryPartialSpatialSync: async (dataset_type: "TOLL_ROADS" | "PROTOCOL_ROADS" | "POI"): Promise<any> => {
    const res = await axiosInstance.post("/system/sync/retry-partial", { dataset_type });
    return res.data;
  },

  /**
   * Abort active spatial sync pipeline
   */
  abortSpatialSync: async (): Promise<any> => {
    const res = await axiosInstance.post("/system/sync/abort");
    return res.data;
  },

  /**
   * Get real-time spatial sync status and active versions
   */
  getSpatialSyncStatus: async (): Promise<any> => {
    const res = await axiosInstance.get("/system/sync/status");
    return res.data;
  },
};
