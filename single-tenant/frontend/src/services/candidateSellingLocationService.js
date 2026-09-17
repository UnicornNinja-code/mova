import { axiosInstance } from "../lib/axios.js";

export const candidateSellingLocationService = {
  /**
   * Fetch all candidate selling locations for a zone or all
   */
  getAll: async (params = {}) => {
    const res = await axiosInstance.get("/candidate-locations", { params });
    return res.data;
  },

  getCandidatesByZone: async (zoneId) => {
    if (!zoneId) return { success: true, data: [] };
    const res = await axiosInstance.get(`/candidate-locations/zone/${zoneId}`);
    return res.data;
  },

  getCandidateLocationsByZone: async (zoneId) => {
    if (!zoneId) return { success: true, data: [] };
    const res = await axiosInstance.get(`/candidate-locations/zone/${zoneId}`);
    return res.data;
  },

  getAllCandidateLocations: async () => {
    const res = await axiosInstance.get("/candidate-locations/all");
    return res.data;
  },

  generate: async (zoneId, payload = {}) => {
    const endpoint = zoneId ? `/candidate-locations/generate/${zoneId}` : "/candidate-locations/generate";
    const res = await axiosInstance.post(endpoint, payload);
    return res.data;
  },

  generateCandidateLocations: async (zoneId, payload = {}) => {
    return candidateSellingLocationService.generate(zoneId, payload);
  },

  generateZoneCandidates: async (zoneId) => {
    return candidateSellingLocationService.generate(zoneId);
  },

  /**
   * Fetch candidate selling location by ID
   */
  getCandidateById: async (id) => {
    const res = await axiosInstance.get(`/candidate-locations/${id}`);
    return res.data;
  },

  /**
   * Create candidate selling location manually
   */
  createCandidate: async (data) => {
    const res = await axiosInstance.post("/candidate-locations", data);
    return res.data;
  },

  /**
   * Evaluate candidate locations
   */
  evaluateCandidate: async (id, payload = {}) => {
    const res = await axiosInstance.post(`/candidate-locations/${id}/evaluate`, payload);
    return res.data;
  },

  evaluateZoneCandidates: async (zoneId, payload = {}) => {
    const res = await axiosInstance.post(`/candidate-locations/evaluate/zone/${zoneId}`, payload);
    return res.data;
  },

  /**
   * Fetch evaluation snapshot, explanation, and audit
   */
  getEvaluationSnapshot: async (evaluationId) => {
    const res = await axiosInstance.get(`/candidate-locations/evaluation/${evaluationId}`);
    return res.data;
  },

  getEvaluationExplanation: async (id) => {
    const res = await axiosInstance.get(`/candidate-locations/explanation/${id}`);
    return res.data;
  },

  getEvaluationAudit: async (id) => {
    const res = await axiosInstance.get(`/candidate-locations/audit/${id}`);
    return res.data;
  },
};

