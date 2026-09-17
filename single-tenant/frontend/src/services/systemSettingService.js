/*
 * systemSettingService.js
 * Centralized Axios Service for System Settings, Hub Spatial Config & Readiness
 * Single-Tenant MOVA Architecture
 */

import { axiosInstance } from "../lib/axios.js";

export const systemSettingService = {
  /**
   * Fetch operational restriction rules (Protocol & Toll Road)
   */
  async getOperationalRules() {
    const res = await axiosInstance.get("/system-settings/operational-rules");
    return res.data?.data || res.data;
  },

  /**
   * Update operational restriction rules
   */
  async updateOperationalRules(payload) {
    const res = await axiosInstance.patch("/system-settings/operational-rules", payload);
    return res.data;
  },

  /**
   * Fetch holistic operational system readiness report
   */
  async getReadiness() {
    const res = await axiosInstance.get("/system-settings/readiness");
    return res.data?.data || res.data;
  },

  /**
   * Fetch Central Hub spatial configuration
   */
  async getHubConfig() {
    const res = await axiosInstance.get("/system-settings/hub");
    return res.data?.data || res.data;
  },

  /**
   * Update Central Hub spatial configuration
   */
  async updateHubConfig(payload) {
    const res = await axiosInstance.put("/system-settings/hub", payload);
    return res.data;
  },

  /**
   * Fetch supported map tile providers metadata
   */
  async getMapConfig() {
    const res = await axiosInstance.get("/system-settings/map-config");
    return res.data?.data || res.data;
  },
};
