import { api } from "./api";

export const riderService = {
  // --- Rider Operations Group 10 ---
  async claimArmada({ armadaId }) {
    const response = await api.post("/api/rider-operations/claim-armada", { armadaId });
    return response.data?.data || response.data;
  },

  async checkInSpasial({ latitude, longitude, zoneId }) {
    const response = await api.post("/api/rider-operations/check-in", {
      latitude,
      longitude,
      zone_id: zoneId,
    });
    return response.data?.data || response.data;
  },

  async recordSale({ items, zoneId, latitude, longitude }) {
    const response = await api.post("/api/rider-operations/sales", {
      items,
      zone_id: zoneId,
      latitude,
      longitude,
    });
    return response.data?.data || response.data;
  },

  async checkoutShift({ sessionId, notes }) {
    const response = await api.post("/api/rider-operations/checkout", {
      session_id: sessionId,
      notes,
    });
    return response.data?.data || response.data;
  },

  async getActiveDuty() {
    const response = await api.get("/api/rider-operations/active-duty");
    return response.data?.data || response.data;
  },

  async getDutyHistory(params = {}) {
    const response = await api.get("/api/rider-operations/duty-history", { params });
    return response.data?.data || response.data;
  },

  async getSessionDetail(sessionId) {
    const response = await api.get(`/api/rider-operations/session/${sessionId}`);
    return response.data?.data || response.data;
  },

  // --- LBS Telemetry Group 11 ---
  async sendGpsPing({ latitude, longitude, speed, heading }) {
    const response = await api.post("/api/lbs/ping", {
      latitude,
      longitude,
      speed,
      heading,
    });
    return response.data?.data || response.data;
  },

  async getLiveLocations() {
    const response = await api.get("/api/lbs/live-locations");
    return response.data?.data || response.data;
  },

  async getNearbyPois({ latitude, longitude, radiusMeters = 500 }) {
    const response = await api.get("/api/lbs/nearby", {
      params: { latitude, longitude, radius: radiusMeters },
    });
    return response.data?.data || response.data;
  },
};
