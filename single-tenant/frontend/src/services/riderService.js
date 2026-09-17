import { axiosInstance } from "../lib/axios.js";

/**
 * Rider Operational Domain Service (Canonical Backend Phase 1-7 & Flow-05)
 */
export const riderService = {
  // 1. Shift & Duty Session
  getActiveSession: async () => {
    try {
      const res = await axiosInstance.get("/rider-operational/active-session");
      return res.data;
    } catch {
      const res = await axiosInstance.get("/rider/active-session");
      return res.data;
    }
  },

  getDutyStatus: async () => {
    try {
      const res = await axiosInstance.get("/rider-operational/duty-status");
      return res.data;
    } catch {
      return riderService.getActiveSession();
    }
  },

  confirmAvailability: async (payload = {}) => {
    try {
      const res = await axiosInstance.post("/rider-operational/confirm-availability", payload);
      return res.data;
    } catch {
      const res = await axiosInstance.post("/rider/confirm-availability", payload);
      return res.data;
    }
  },

  getMyZone: async () => {
    try {
      const res = await axiosInstance.get("/rider-operational/my-zone");
      return res.data;
    } catch {
      const res = await axiosInstance.get("/rider/my-zone");
      return res.data;
    }
  },

  // 2. Armada Hold & Claim Lifecycle
  getAvailableArmada: async () => {
    try {
      const res = await axiosInstance.get("/rider-operational/available-armada");
      return res.data;
    } catch {
      const res = await axiosInstance.get("/rider/hub-armadas");
      return res.data;
    }
  },

  getHubArmadas: async () => {
    return riderService.getAvailableArmada();
  },

  reserveArmada: async (armada_id) => {
    try {
      const res = await axiosInstance.post("/rider-operational/reserve-armada", { armada_id });
      return res.data;
    } catch {
      const res = await axiosInstance.post("/rider/hold-armada", { armada_id });
      return res.data;
    }
  },

  holdArmada: async (armada_id) => {
    return riderService.reserveArmada(armada_id);
  },

  cancelReservation: async (armada_id) => {
    try {
      const res = await axiosInstance.post("/rider-operational/cancel-reservation", { armada_id });
      return res.data;
    } catch {
      const res = await axiosInstance.post("/rider/cancel-hold-armada", { armada_id });
      return res.data;
    }
  },

  cancelHoldArmada: async (armada_id) => {
    return riderService.cancelReservation(armada_id);
  },

  claimArmada: async (armada_id) => {
    try {
      const res = await axiosInstance.post("/rider-operational/claim-armada", { armada_id });
      return res.data;
    } catch {
      const res = await axiosInstance.post("/rider/claim-armada", { armada_id });
      return res.data;
    }
  },

  // 3. Geofence Check-in
  checkIn: async ({ latitude, longitude }) => {
    const payload = {
      latitude: Number(latitude),
      longitude: Number(longitude),
    };
    try {
      const res = await axiosInstance.post("/rider-operational/check-in", payload);
      return res.data;
    } catch {
      const res = await axiosInstance.post("/rider/check-in", payload);
      return res.data;
    }
  },

  checkInZone: async (coords) => {
    return riderService.checkIn(coords);
  },

  // 4. Spot Lock & POS Selling
  getCandidateSpots: async (params = {}) => {
    try {
      const res = await axiosInstance.get("/rider-operational/candidate-spots", { params });
      return res.data;
    } catch {
      const res = await axiosInstance.get("/candidate-locations", { params });
      return res.data;
    }
  },

  lockSpot: async ({ candidate_location_id, latitude, longitude }) => {
    const payload = {
      candidate_location_id,
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
    };
    try {
      const res = await axiosInstance.post("/rider-operational/lock-spot", payload);
      return res.data;
    } catch {
      const res = await axiosInstance.post("/rider/lock-spot", payload);
      return res.data;
    }
  },

  recordSale: async ({ product_id, quantity, latitude, longitude }) => {
    const payload = {
      product_id,
      quantity: Number(quantity),
    };
    if (latitude !== undefined && longitude !== undefined) {
      payload.latitude = Number(latitude);
      payload.longitude = Number(longitude);
    }
    try {
      const res = await axiosInstance.post("/rider-operational/record-sale", payload);
      return res.data;
    } catch {
      const res = await axiosInstance.post("/rider/record-sale", payload);
      return res.data;
    }
  },

  getMySales: async (params = {}) => {
    try {
      const res = await axiosInstance.get("/rider-operational/my-sales", { params });
      return res.data;
    } catch {
      const res = await axiosInstance.get("/rider/my-sales", { params });
      return res.data;
    }
  },

  getCheckoutSummary: async () => {
    try {
      const res = await axiosInstance.get("/rider-operational/checkout-summary");
      return res.data;
    } catch {
      return riderService.getMySales();
    }
  },

  checkout: async (payload = { return_status: "ACTIVE" }) => {
    try {
      const res = await axiosInstance.post("/rider-operational/checkout", payload);
      return res.data;
    } catch {
      const res = await axiosInstance.post("/rider/checkout", payload);
      return res.data;
    }
  },

  checkoutSession: async (payload) => {
    return riderService.checkout(payload);
  },

  releaseArmada: async (payload = {}) => {
    try {
      const res = await axiosInstance.post("/rider-operational/release-armada", payload);
      return res.data;
    } catch {
      const res = await axiosInstance.post("/rider/release-armada", payload);
      return res.data;
    }
  },

  getMyHistory: async () => {
    const res = await axiosInstance.get("/distribution/my-history");
    return res.data;
  },
};

export default riderService;
