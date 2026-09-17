/**
 * queryKeys.js
 * Centralized Single Source of Truth (SSOT) Query Key Factories for TanStack Query
 * Follows hierarchical scoped array convention
 */

export const authKeys = {
  all: ["auth"],
  me: () => [...authKeys.all, "me"],
  users: () => [...authKeys.all, "users"],
  user: (id) => [...authKeys.users(), id],
};

export const zoneKeys = {
  all: ["zones"],
  lists: () => [...zoneKeys.all, "list"],
  list: (filters = {}) => [...zoneKeys.lists(), filters],
  details: () => [...zoneKeys.all, "detail"],
  detail: (id) => [...zoneKeys.details(), id],
  spatialCandidateSpots: (zoneId) => [...zoneKeys.all, "candidate-spots", zoneId],
};

export const dssKeys = {
  all: ["dss"],
  recommendation: (slot, location) => [...dssKeys.all, "recommendation", { slot, location }],
  spotRankings: (zoneId) => [...dssKeys.all, "spot-rankings", zoneId],
  activeWeights: () => [...dssKeys.all, "weights", "active"],
  criteriaMatrix: () => [...dssKeys.all, "criteria-matrix"],
  bwmConfigs: () => [...dssKeys.all, "bwm-configs"],
  history: (params = {}) => [...dssKeys.all, "history", params],
};

export const poiKeys = {
  all: ["pois"],
  lists: () => [...poiKeys.all, "list"],
  list: (params = {}) => [...poiKeys.lists(), params],
  detail: (id) => [...poiKeys.all, "detail", id],
  qualitySummary: () => [...poiKeys.all, "quality-summary"],
  pendingApprovals: () => [...poiKeys.all, "pending-approvals"],
  c3CrowdScores: () => [...poiKeys.all, "c3-crowd-scores"],
};

export const competitorKeys = {
  all: ["competitors"],
  summary: () => [...competitorKeys.all, "summary"],
  byZone: (zoneId) => [...competitorKeys.all, "zone", zoneId],
  c6Score: (zoneId) => [...competitorKeys.all, "score", zoneId],
};

export const roadKeys = {
  all: ["roads"],
  protocolRoads: () => [...roadKeys.all, "protocol"],
  tollRoads: () => [...roadKeys.all, "toll"],
};

export const weatherKeys = {
  all: ["weather"],
  hub: (hubName) => [...weatherKeys.all, "hub", hubName],
  zoneTimeline: (zoneId, params = {}) => [...weatherKeys.all, "zone-timeline", zoneId, params],
  c4Scores: (zoneId) => [...weatherKeys.all, "c4-scores", zoneId],
};

export const fleetKeys = {
  all: ["fleet"],
  lists: () => [...fleetKeys.all, "list"],
  list: (status) => [...fleetKeys.lists(), { status }],
  detail: (id) => [...fleetKeys.all, "detail", id],
};

export const riderKeys = {
  all: ["riders"],
  lists: () => [...riderKeys.all, "list"],
  liveDuty: (riderId) => [...riderKeys.all, "live-duty", riderId],
  liveLocations: () => [...riderKeys.all, "lbs", "locations"],
  dutyHistory: (riderId, params = {}) => [...riderKeys.all, "duty-history", riderId, params],
  dutyDetails: (sessionId) => [...riderKeys.all, "session-details", sessionId],
};

export const distributionKeys = {
  all: ["distribution"],
  fifoQueue: () => [...distributionKeys.all, "fifo-queue"],
  assignments: (date) => [...distributionKeys.all, "assignments", date],
};

export const catalogKeys = {
  all: ["catalog"],
  products: () => [...catalogKeys.all, "products"],
  product: (id) => [...catalogKeys.products(), id],
};

export const dashboardKeys = {
  all: ["dashboard"],
  executive: (date) => [...dashboardKeys.all, "executive", date],
  salesTrend: (days = 7) => [...dashboardKeys.all, "sales-trend", days],
  zonePerformance: () => [...dashboardKeys.all, "zone-performance"],
  fleetUtilization: () => [...dashboardKeys.all, "fleet-utilization"],
  auditLogs: (params = {}) => [...dashboardKeys.all, "audit-logs", params],
  systemSettings: () => [...dashboardKeys.all, "system-settings"],
};
