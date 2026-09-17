import { axiosInstance } from "../lib/axios.js";

export const fleetService = {
  getFleets: async () => {
    const res = await axiosInstance.get("/armadas");
    return res.data;
  },
  createFleet: async (data) => {
    const res = await axiosInstance.post("/armadas", data);
    return res.data;
  },
  updateFleet: async (id, data) => {
    const res = await axiosInstance.put(`/armadas/${id}`, data);
    return res.data;
  },
  deleteFleet: async (id) => {
    const res = await axiosInstance.delete(`/armadas/${id}`);
    return res.data;
  },
};

