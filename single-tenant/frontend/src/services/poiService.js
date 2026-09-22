import { api } from "./api";

/**
 * POI Service — Master POI & Spatial API Layer
 * Aligns strictly with Backend POI API Contract
 */
export const poiService = {
  /**
   * Fetch all operational approved POIs
   */
  async getPois(params = {}) {
    const response = await api.get("/api/pois", { params });
    return response.data?.data?.pois || response.data?.data || response.data || [];
  },

  /**
   * Fetch single POI by ID
   */
  async getPoiById(id) {
    const response = await api.get(`/api/pois/${id}`);
    return response.data?.data?.poi || response.data?.data || response.data;
  },

  /**
   * Fetch all authoritative POI categories
   */
  async getCategories() {
    const response = await api.get("/api/pois/categories");
    return response.data?.data || response.data || [];
  },

  /**
   * Fetch aggregate POI statistics & spatial density
   */
  async getPoiStats() {
    const response = await api.get("/api/pois/stats");
    return response.data?.data || response.data;
  },

  /**
   * Create a manual POI
   */
  async createPoi(payload) {
    const response = await api.post("/api/pois", payload);
    return response.data?.data?.poi || response.data?.data || response.data;
  },

  /**
   * Update an existing POI
   */
  async updatePoi(id, payload) {
    const response = await api.put(`/api/pois/${id}`, payload);
    return response.data?.data?.poi || response.data?.data || response.data;
  },

  /**
   * Delete a POI
   */
  async deletePoi(id) {
    const response = await api.delete(`/api/pois/${id}`);
    return response.data?.data || response.data;
  },

  /**
   * Ingest a batch of POIs (Bulk upload)
   */
  async bulkCreatePois(pois) {
    const response = await api.post("/api/pois/bulk", { pois });
    return response.data?.data || response.data;
  },

  /**
   * Trigger Overpass OSM Full City Sync
   */
  async syncOverpassPois(hubCity = "Sidoarjo") {
    const response = await api.post("/api/pois/sync-city", { hubCity });
    return response.data?.data || response.data;
  },

  /**
   * Trigger Re-clustering of database POIs
   */
  async reclusterPois() {
    const response = await api.post("/api/pois/recluster");
    return response.data?.data || response.data;
  },

  /**
   * Fetch pending approval POIs
   */
  async getPendingPois() {
    const response = await api.get("/api/pois/pending");
    return response.data?.data?.pois || response.data?.data || response.data || [];
  },

  /**
   * Approve or reject a POI
   */
  async approveOrRejectPoi(poiId, status, notes = "") {
    const response = await api.post("/api/pois/approve", { poi_id: poiId, status, notes });
    return response.data?.data || response.data;
  },

  /**
   * Fetch POI approval audit logs
   */
  async getApprovalLogs() {
    const response = await api.get("/api/pois/approval-logs");
    return response.data?.data?.logs || response.data?.data || response.data || [];
  },

  /**
   * Fetch data quality summary
   */
  async getQualitySummary() {
    const response = await api.get("/api/pois/quality-summary");
    return response.data?.data || response.data;
  },

  /**
   * Resolve anomaly in POI category
   */
  async resolveAnomaly(poiId, category, action = "APPROVE") {
    const response = await api.post("/api/pois/resolve-anomaly", { poi_id: poiId, category, action });
    return response.data?.data || response.data;
  },
};
