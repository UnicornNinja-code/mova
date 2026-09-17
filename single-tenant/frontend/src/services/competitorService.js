import { api } from "./api";

export const competitorService = {
  // --- Competitors Group 6 ---
  async getSummary() {
    const response = await api.get("/api/competitors/summary");
    return response.data?.data || response.data;
  },

  async getZoneC6Score(zoneId) {
    const response = await api.get(`/api/competitors/score/${zoneId}`);
    return response.data?.data || response.data;
  },

  async getCompetitorsByZone(zoneId) {
    const response = await api.get(`/api/competitors/zone/${zoneId}`);
    return response.data?.data || response.data;
  },

  async createCompetitor(competitorData) {
    const response = await api.post("/api/competitors", competitorData);
    return response.data?.data || response.data;
  },

  async bulkCreateCompetitors(competitorsArray) {
    const response = await api.post("/api/competitors/bulk", { competitors: competitorsArray });
    return response.data?.data || response.data;
  },

  async deleteCompetitor(id) {
    const response = await api.delete(`/api/competitors/${id}`);
    return response.data?.data || response.data;
  },

  async detectCandidates(zoneId) {
    const response = await api.post(`/api/competitors/candidates/${zoneId}`);
    return response.data?.data || response.data;
  },

  async reconcileExplicitLink(competitorId, { logicalPoiId, externalId, poiId }) {
    const response = await api.post(`/api/competitors/${competitorId}/reconcile`, {
      logical_poi_id: logicalPoiId,
      external_id: externalId,
      poi_id: poiId,
    });
    return response.data?.data || response.data;
  },

  async unlinkReconciliation(competitorId) {
    const response = await api.post(`/api/competitors/${competitorId}/unlink`);
    return response.data?.data || response.data;
  },
};
