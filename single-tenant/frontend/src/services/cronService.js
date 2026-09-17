import { axiosInstance } from "../lib/axios.js";

export const cronService = {
  getCronConfigs: async () => {
    const res = await axiosInstance.get("/cron-management/configs");
    return res.data;
  },
  getCronLogs: async () => {
    const res = await axiosInstance.get("/cron-management/logs");
    return res.data;
  },
  toggleCronActive: async (cronKey) => {
    const res = await axiosInstance.put(`/cron-management/toggle/${cronKey}`);
    return res.data;
  },
  triggerCronManually: async (cronKey) => {
    const res = await axiosInstance.post(`/cron-management/trigger/${cronKey}`);
    return res.data;
  },
};
