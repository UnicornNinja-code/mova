/*
 * cronService.ts
 * REST Client Service for Background Cron Management & Logs in TypeScript
 * Strictly aligned with swagger.ts contracts
 */

import { axiosInstance } from "../lib/axios";

export interface CronConfigItem {
  key: string;
  name: string;
  schedule: string;
  is_active: boolean;
  last_run?: string;
  next_run?: string;
  description?: string;
}

export interface CronLogItem {
  id: string | number;
  cron_key: string;
  status: "SUCCESS" | "FAILED" | "RUNNING" | string;
  duration_ms?: number;
  message?: string;
  created_at: string;
}

export const cronService = {
  /**
   * Fetch all registered cron job configurations
   * GET /api/cron-management/configs
   */
  getConfigs: async (): Promise<CronConfigItem[]> => {
    const res = await axiosInstance.get("/cron-management/configs");
    return res.data?.data || res.data?.configs || (Array.isArray(res.data) ? res.data : []);
  },

  /**
   * Fetch execution logs for cron jobs
   * GET /api/cron-management/logs
   */
  getLogs: async (params: { cron_key?: string; limit?: number } = {}): Promise<CronLogItem[]> => {
    const res = await axiosInstance.get("/cron-management/logs", { params });
    return res.data?.data || res.data?.logs || (Array.isArray(res.data) ? res.data : []);
  },

  /**
   * Toggle active state of a cron job
   * PUT /api/cron-management/toggle/{cronKey}
   */
  toggleCron: async (cronKey: string): Promise<{ success: boolean; is_active: boolean; msg?: string }> => {
    const res = await axiosInstance.put(`/cron-management/toggle/${cronKey}`);
    return res.data;
  },

  /**
   * Manually trigger immediate execution of a cron job
   * POST /api/cron-management/trigger/{cronKey}
   */
  triggerCron: async (cronKey: string): Promise<{ status: string; job_id?: string; msg?: string }> => {
    const res = await axiosInstance.post(`/cron-management/trigger/${cronKey}`);
    return res.data;
  },
};

export default cronService;
