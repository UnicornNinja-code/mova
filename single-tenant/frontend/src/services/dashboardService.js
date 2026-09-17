import { api } from "./api";

export const dashboardService = {
  // --- Dashboard & Analytics Group 14 ---
  async getAnalyticsOverview(params = {}) {
    const response = await api.get("/api/analytics/overview", { params });
    return response.data?.data || response.data;
  },

  async getOperationalSummary(params = {}) {
    const response = await api.get("/api/analytics/operational/summary", { params });
    return response.data?.data || response.data;
  },

  async getFleetUtilization(params = {}) {
    const response = await api.get("/api/analytics/operational/fleet-utilization", { params });
    return response.data?.data || response.data;
  },

  async getComplianceSummary(params = {}) {
    const response = await api.get("/api/analytics/compliance/summary", { params });
    return response.data?.data || response.data;
  },

  async getSalesPerformance(params = {}) {
    const response = await api.get("/api/analytics/sales/performance", { params });
    return response.data?.data || response.data;
  },

  async getDssPlanVsActual(params = {}) {
    const response = await api.get("/api/analytics/dss/plan-vs-actual", { params });
    return response.data?.data || response.data;
  },

  async getDailySummaryReport(params = {}) {
    const response = await api.get("/api/analytics/reports/daily-summary", { params });
    return response.data?.data || response.data;
  },

  async getQuickAlerts() {
    const response = await api.get("/api/dashboard/quick-alerts");
    return response.data?.data || response.data;
  },

  async getExecutiveSummaryReport(params = {}) {
    const response = await api.get("/api/reports/executive-summary", { params });
    return response.data?.data || response.data;
  },

  async exportReport(reportType, params = {}) {
    const response = await api.get(`/api/reports/export/${reportType}`, {
      params,
      responseType: "blob",
    });
    return response.data;
  },

  // --- Audit & Settings Group 15 ---
  async getAuditLogs(params = {}) {
    const response = await api.get("/api/audit-logs", { params });
    return response.data?.data || response.data;
  },

  async getSystemSettings() {
    const response = await api.get("/api/settings");
    return response.data?.data || response.data;
  },

  async updateSystemSettings(settingsData) {
    const response = await api.put("/api/settings", settingsData);
    return response.data?.data || response.data;
  },

  async getCentralHubConfig() {
    const response = await api.get("/api/settings/central-hub");
    return response.data?.data || response.data;
  },

  // --- Data Freshness & Sync Group 16 ---
  async getDataFreshnessSummary() {
    const response = await api.get("/api/freshness/summary");
    return response.data?.data || response.data;
  },

  async triggerFreshnessSync(moduleName) {
    const response = await api.post("/api/freshness/sync", { module: moduleName });
    return response.data?.data || response.data;
  },
};
