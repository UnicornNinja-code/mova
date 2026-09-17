import { api } from "./api";

export const distributionService = {
  // --- Distribution & Plotting Group 12 ---
  async getFifoQueue() {
    const response = await api.get("/api/distribution/queue");
    return response.data?.data || response.data;
  },

  async runTopsisDistribution({ timeSlot, date } = {}) {
    const response = await api.post("/api/distribution/auto-assign", {
      time_slot: timeSlot,
      date,
    });
    return response.data?.data || response.data;
  },

  async manualOverrideAssignment({ riderId, zoneId, armadaId, shiftTime, date }) {
    const response = await api.post("/api/distribution/manual-override", {
      rider_id: riderId,
      zone_id: zoneId,
      armada_id: armadaId,
      shift_time: shiftTime,
      date,
    });
    return response.data?.data || response.data;
  },

  async getAssignments(date) {
    const response = await api.get("/api/distribution/assignments", {
      params: { date },
    });
    return response.data?.data || response.data;
  },
};
