/**
 * Standardized Query Key Factory (SSOT)
 * Aligned with: react-state-management, react-best-practices, and MAPING_UI_UX.md
 * Prevents key collision, enables precise cache invalidation and prefetching across all 18 domains.
 */

export const queryKeys = {
  // 1. Auth & Session
  auth: {
    all: ["auth"],
    me: () => [...queryKeys.auth.all, "me"],
    session: () => [...queryKeys.auth.all, "session"],
  },

  // 2. User Accounts
  users: {
    all: ["users"],
    list: (params = {}) => [...queryKeys.users.all, "list", params],
    detail: (id) => [...queryKeys.users.all, "detail", id],
  },

  // 3. Zone Master
  zones: {
    all: ["zones"],
    list: (params = {}) => [...queryKeys.zones.all, "list", params],
    detail: (id) => [...queryKeys.zones.all, "detail", id],
    config: () => [...queryKeys.zones.all, "config"],
    distanceSummary: () => [...queryKeys.zones.all, "distance-summary"],
  },

  // 4. DSS Engine
  dss: {
    all: ["dss"],
    configs: () => [...queryKeys.dss.all, "configs"],
    explanation: (runId) => [...queryKeys.dss.all, "explanation", runId],
    history: (params = {}) => [...queryKeys.dss.all, "history", params],
    historyDetail: (id) => [...queryKeys.dss.all, "history", id],
    historyZone: (zoneId) => [...queryKeys.dss.all, "history", "zone", zoneId],
  },

  // 5. POI & Spatial
  pois: {
    all: ["pois"],
    categories: () => [...queryKeys.pois.all, "categories"],
    crowdScores: () => [...queryKeys.pois.all, "crowd-scores"],
    stats: () => [...queryKeys.pois.all, "stats"],
    zoneDensity: (zoneId) => [...queryKeys.pois.all, "zone-density", zoneId],
    operationalArea: (params = {}) => [...queryKeys.pois.all, "operational-area", params],
    pending: (params = {}) => [...queryKeys.pois.all, "pending", params],
    approvalLogs: (params = {}) => [...queryKeys.pois.all, "approval-logs", params],
  },

  // 6. Competitors
  competitors: {
    all: ["competitors"],
    byZone: (zoneId) => [...queryKeys.competitors.all, "zone", zoneId],
    scoreByZone: (zoneId) => [...queryKeys.competitors.all, "score", zoneId],
  },

  // 7. Candidate Locations
  candidates: {
    all: ["candidates"],
    list: (params = {}) => [...queryKeys.candidates.all, "list", params],
    detail: (id) => [...queryKeys.candidates.all, "detail", id],
    explanation: (id) => [...queryKeys.candidates.all, "explanation", id],
    audit: (id) => [...queryKeys.candidates.all, "audit", id],
  },

  // 8. Weather & Roads
  weather: {
    all: ["weather"],
    current: () => [...queryKeys.weather.all, "current"],
    zone: (zoneId) => [...queryKeys.weather.all, "zone", zoneId],
    timeline: (zoneId, date = "today", slot = "all") => [...queryKeys.weather.all, "timeline", zoneId, date, slot],
    c4: (zoneId, time) => [...queryKeys.weather.all, "c4", zoneId, time],
    hub: (city) => [...queryKeys.weather.all, "hub", city],
  },
  roads: {
    all: ["roads"],
    protocol: () => [...queryKeys.roads.all, "protocol"],
    toll: () => [...queryKeys.roads.all, "toll"],
    accessibility: (zoneId) => [...queryKeys.roads.all, "accessibility", zoneId],
  },

  // 9. Armada Fleet
  armadas: {
    all: ["armadas"],
    list: (params = {}) => [...queryKeys.armadas.all, "list", params],
    detail: (id) => [...queryKeys.armadas.all, "detail", id],
    heldStatus: () => [...queryKeys.armadas.all, "held-status"],
  },

  // 10. Rider Operations (Field PWA)
  riderOps: {
    all: ["rider-ops"],
    activeSession: () => [...queryKeys.riderOps.all, "active-session"],
    dutyStatus: () => [...queryKeys.riderOps.all, "duty-status"],
    availableArmada: () => [...queryKeys.riderOps.all, "available-armada"],
    myZone: () => [...queryKeys.riderOps.all, "my-zone"],
    candidateSpots: () => [...queryKeys.riderOps.all, "candidate-spots"],
    mySales: (params = {}) => [...queryKeys.riderOps.all, "my-sales", params],
    checkoutSummary: () => [...queryKeys.riderOps.all, "checkout-summary"],
  },

  // 11. LBS Telemetry
  lbs: {
    all: ["lbs"],
    live: (params = {}) => [...queryKeys.lbs.all, "live", params],
    zoneLogs: (params = {}) => [...queryKeys.lbs.all, "zone-logs", params],
    distanceSummary: () => [...queryKeys.lbs.all, "distance-summary"],
  },

  // 12. Distribution & Plotting
  distribution: {
    all: ["distribution"],
    status: () => [...queryKeys.distribution.all, "status"],
    queue: (date) => [...queryKeys.distribution.all, "queue", date],
    runs: (params = {}) => [...queryKeys.distribution.all, "runs", params],
    runDetail: (id) => [...queryKeys.distribution.all, "runs", id],
  },

  // 13. Products & Menu
  products: {
    all: ["products"],
    list: (params = {}) => [...queryKeys.products.all, "list", params],
    detail: (id) => [...queryKeys.products.all, "detail", id],
  },

  // 14. Dashboard & Analytics
  dashboard: {
    all: ["dashboard"],
    overview: (params = {}) => [...queryKeys.dashboard.all, "overview", params],
    summary: () => [...queryKeys.dashboard.all, "summary"],
    quickAlerts: () => [...queryKeys.dashboard.all, "quick-alerts"],
  },
  analytics: {
    all: ["analytics"],
    overview: (params = {}) => [...queryKeys.analytics.all, "overview", params],
    operationalSummary: (params = {}) => [...queryKeys.analytics.all, "operational-summary", params],
    salesPerformance: (params = {}) => [...queryKeys.analytics.all, "sales-performance", params],
    fleetUtilization: (params = {}) => [...queryKeys.analytics.all, "fleet-utilization", params],
    complianceSummary: (params = {}) => [...queryKeys.analytics.all, "compliance-summary", params],
    dssPerformance: (params = {}) => [...queryKeys.analytics.all, "dss-performance", params],
    dssPlanVsActual: (params = {}) => [...queryKeys.analytics.all, "dss-plan-vs-actual", params],
    hourlySalesCurves: (params = {}) => [...queryKeys.analytics.all, "hourly-sales-curves", params],
    zoneHourlyCurves: (zoneId, params = {}) => [...queryKeys.analytics.all, "zone-hourly-curves", zoneId, params],
    inZoneVsOut: (params = {}) => [...queryKeys.analytics.all, "in-zone-vs-out", params],
  },

  // 15. Audit & Settings
  audit: {
    all: ["audit"],
    list: (params = {}) => [...queryKeys.audit.all, "list", params],
    detail: (id) => [...queryKeys.audit.all, "detail", id],
    byUser: (userId) => [...queryKeys.audit.all, "user", userId],
    byAction: (action) => [...queryKeys.audit.all, "action", action],
  },
  settings: {
    all: ["settings"],
    system: () => [...queryKeys.settings.all, "system"],
    hub: () => [...queryKeys.settings.all, "hub"],
    basemap: () => [...queryKeys.settings.all, "basemap"],
    operationalRules: () => [...queryKeys.settings.all, "operational-rules"],
  },

  // 16. Data Freshness & Readiness
  dataFreshness: {
    all: ["data-freshness"],
    status: () => [...queryKeys.dataFreshness.all, "status"],
    history: (params = {}) => [...queryKeys.dataFreshness.all, "history", params],
  },
  readiness: {
    all: ["readiness"],
    overview: () => [...queryKeys.readiness.all, "overview"],
  },

  // 17. Reports
  reports: {
    all: ["reports"],
    dailySummary: (params = {}) => [...queryKeys.reports.all, "daily-summary", params],
    riderOperational: (params = {}) => [...queryKeys.reports.all, "rider-operational", params],
    zoneEffectiveness: (params = {}) => [...queryKeys.reports.all, "zone-effectiveness", params],
    fleetUtilization: (params = {}) => [...queryKeys.reports.all, "fleet-utilization", params],
    dssAccuracy: (params = {}) => [...queryKeys.reports.all, "dss-accuracy", params],
  },
};

export default queryKeys;
