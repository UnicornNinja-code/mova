/*
 * dataSyncService.ts
 * REST Client Service for Spatial Dataset Synchronization, Jobs & Atomic Rollback
 * Strictly aligned with swagger.ts contracts
 */

import { axiosInstance } from "../lib/axios";

export type SpatialDatasetType = "POI" | "TOLL_ROADS" | "PROTOCOL_ROADS";

export interface DataSyncJob {
  job_id: string;
  dataset_type: SpatialDatasetType | string;
  state: "waiting" | "active" | "completed" | "failed" | string;
  progress?: number;
  result?: any;
  created_at?: string;
  updated_at?: string;
}

export interface DatasetVersionItem {
  id: string;
  dataset_type: string;
  version_number: number;
  status: "ACTIVE" | "RETIRED" | "STAGING" | "FAILED" | string;
  record_count: number;
  created_at: string;
}

export interface DataSyncVersionsResponse {
  status: string;
  dataset_type: string;
  active_version?: number;
  total_versions?: number;
  versions: DatasetVersionItem[];
}

export const dataSyncService = {
  /**
   * Trigger spatial data synchronization job (Overpass API / OpenStreetMap)
   * POST /api/data-sync/trigger
   */
  triggerSync: async (payload: {
    dataset_type: SpatialDatasetType | string;
    city_name?: string;
    cities?: string[];
    bbox?: { min_lat: number; min_lon: number; max_lat: number; max_lon: number };
  }): Promise<{ status: string; job_id: string; dataset_type: string; state?: string; msg?: string }> => {
    const res = await axiosInstance.post("/data-sync/trigger", payload);
    return res.data;
  },

  /**
   * Poll status and progress of a synchronization job
   * GET /api/data-sync/jobs/{jobId}
   */
  getJobStatus: async (jobId: string): Promise<{ status: string; job: DataSyncJob }> => {
    const res = await axiosInstance.get(`/data-sync/jobs/${jobId}`);
    return res.data;
  },

  /**
   * Fetch historical dataset versions
   * GET /api/data-sync/versions/{datasetType}
   */
  getVersions: async (datasetType: SpatialDatasetType | string): Promise<DataSyncVersionsResponse> => {
    const res = await axiosInstance.get(`/data-sync/versions/${datasetType}`);
    return res.data;
  },

  /**
   * Rollback spatial dataset to a previous historical version atomically
   * POST /api/data-sync/rollback
   */
  rollbackVersion: async (versionId: string): Promise<{ status: string; message: string; promoted_version?: number }> => {
    const res = await axiosInstance.post("/data-sync/rollback", { version_id: versionId });
    return res.data;
  },

  /**
   * Trigger Toll Roads synchronization
   * POST /api/roads/sync-toll
   */
  syncTollRoads: async (): Promise<{ msg: string }> => {
    const res = await axiosInstance.post("/roads/sync-toll");
    return res.data;
  },
};

export default dataSyncService;
