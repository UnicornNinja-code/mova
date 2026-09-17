import { axiosInstance } from "../lib/axios.js";

export const operationalRuleService = {
  /**
   * Fetch operational rules configuration from backend system_settings
   */
  getOperationalRules: async () => {
    const res = await axiosInstance.get("/system-settings/operational-rules");
    return res.data;
  },

  /**
   * Update operational rules configuration (SUPERADMIN / MANAGEMENT ONLY)
   */
  updateOperationalRules: async (payload) => {
    const res = await axiosInstance.patch("/system-settings/operational-rules", payload);
    return res.data;
  },
};
