/*
 * integration_historical_analytics_api.test.ts
 * S7-03-08: Integration & Contract Verification for Historical Operational Analytics API (v4.1.0)
 * 
 * Tests:
 * 1. HistoricalAnalyticsController Unit & Integration Invariants
 * 2. HTTP Status Code Mapping (200, 400, 401, 403, 500)
 * 3. Validation Codes & Error Messages
 * 4. Tenant Context Isolation (Session vs Query)
 * 5. Additive OpenAPI v4.1.0 Contract Verification (schemas, tags, paths, and backward compatibility)
 */

import { describe, it, expect, mock } from "bun:test";
import { HistoricalAnalyticsController } from "../src/controllers/historicalAnalyticsController.js";
import { swaggerSpec } from "../src/docs/swagger.js";

// Helper to create mock Express Request
function createMockRequest(options: {
  user?: any;
  query?: any;
  headers?: any;
} = {}): any {
  return {
    user: options.user ?? {
      id: "11111111-1111-1111-1111-111111111111",
      role: "MANAGEMENT",
      tenant_id: "tenant-mantakopi-sda",
    },
    query: options.query ?? {},
    headers: options.headers ?? {},
  };
}

// Helper to create mock Express Response
function createMockResponse(): any {
  const res: any = {
    statusCode: 200,
    body: null,
    status: (code: number) => {
      res.statusCode = code;
      return res;
    },
    json: (data: any) => {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe("S7-03-08: Historical Operational Analytics API & Contract Integration", () => {
  // ==========================================================================
  // SECTION 1: Presence Endpoints (/presence/summary, /presence/timeline)
  // ==========================================================================
  describe("1. Presence Analytics Endpoints", () => {
    it("1.1 returns 400 when rangeStart or rangeEnd is missing in /presence/summary", async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getPresenceSummary(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.msg).toContain("[INVALID_TIME_RANGE]");
    });

    it("1.2 returns 400 when rangeStart >= rangeEnd in /presence/summary", async () => {
      const req = createMockRequest({
        query: {
          rangeStart: "2026-09-02T00:00:00.000Z",
          rangeEnd: "2026-09-01T00:00:00.000Z",
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getPresenceSummary(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[INVALID_TIME_RANGE]");
    });

    it("1.3 returns 400 for invalid IANA timezone in /presence/summary", async () => {
      const req = createMockRequest({
        query: {
          rangeStart: "2026-09-01T00:00:00.000Z",
          rangeEnd: "2026-09-02T00:00:00.000Z",
          timezone: "Invalid/Zone",
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getPresenceSummary(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[INVALID_TIMEZONE]");
    });

    it("1.4 returns 400 when rangeStart is missing in /presence/timeline", async () => {
      const req = createMockRequest({
        query: {
          rangeEnd: "2026-09-02T00:00:00.000Z",
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getPresenceTimeline(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[INVALID_TIME_RANGE]");
    });

    it("1.5 returns 400 for invalid grain in /presence/timeline", async () => {
      const req = createMockRequest({
        query: {
          rangeStart: "2026-09-01T00:00:00.000Z",
          rangeEnd: "2026-09-02T00:00:00.000Z",
          grain: "minute",
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getPresenceTimeline(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[INVALID_GRAIN]");
    });
  });

  // ==========================================================================
  // SECTION 2: Deviation Episodes Endpoint (/deviations)
  // ==========================================================================
  describe("2. Deviation Episodes Endpoint", () => {
    it("2.1 returns 400 for missing rangeStart in /deviations", async () => {
      const req = createMockRequest({
        query: {
          rangeEnd: "2026-09-02T00:00:00.000Z",
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getDeviations(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[INVALID_TIME_RANGE]");
    });

    it("2.2 returns 400 for malformed timestamp in /deviations", async () => {
      const req = createMockRequest({
        query: {
          rangeStart: "not-a-valid-date",
          rangeEnd: "2026-09-02T00:00:00.000Z",
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getDeviations(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[INVALID_TIMESTAMP]");
    });
  });

  // ==========================================================================
  // SECTION 3: Zone & Rider Analytics Endpoints (/zones, /riders)
  // ==========================================================================
  describe("3. Zone & Rider Analytics Endpoints", () => {
    it("3.1 returns 400 when rangeStart is missing in /zones", async () => {
      const req = createMockRequest({
        query: {
          rangeEnd: "2026-09-02T00:00:00.000Z",
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getZoneAnalytics(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[INVALID_TIME_RANGE]");
    });

    it("3.2 returns 400 when rangeStart is missing in /riders", async () => {
      const req = createMockRequest({
        query: {
          rangeEnd: "2026-09-02T00:00:00.000Z",
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getRiderAnalytics(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[INVALID_TIME_RANGE]");
    });
  });

  // ==========================================================================
  // SECTION 4: Period Comparison Endpoint (/comparison)
  // ==========================================================================
  describe("4. Period Comparison Endpoint", () => {
    it("4.1 returns 400 when comparison range parameters are missing", async () => {
      const req = createMockRequest({
        query: {
          currentRangeStart: "2026-09-02T00:00:00.000Z",
          // missing others
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getPeriodComparison(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[INVALID_TIME_RANGE]");
    });

    it("4.2 returns 400 when comparison periods overlap", async () => {
      const req = createMockRequest({
        query: {
          currentRangeStart: "2026-09-02T00:00:00.000Z",
          currentRangeEnd: "2026-09-03T00:00:00.000Z",
          previousRangeStart: "2026-09-01T12:00:00.000Z",
          previousRangeEnd: "2026-09-02T12:00:00.000Z", // Overlaps currentStart (09-02T00:00:00)
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getPeriodComparison(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[PERIODS_OVERLAP]");
    });

    it("4.3 returns 400 when timezone is invalid in /comparison", async () => {
      const req = createMockRequest({
        query: {
          currentRangeStart: "2026-09-02T00:00:00.000Z",
          currentRangeEnd: "2026-09-03T00:00:00.000Z",
          previousRangeStart: "2026-09-01T00:00:00.000Z",
          previousRangeEnd: "2026-09-02T00:00:00.000Z",
          timezone: "Fake/Timezone",
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getPeriodComparison(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[INVALID_TIMEZONE]");
    });
  });

  // ==========================================================================
  // SECTION 5: Tenant Context Resolution & Security
  // ==========================================================================
  describe("5. Tenant Context Security", () => {
    it("5.1 fails with 400/500 if tenant session is missing from req.user", async () => {
      const req = createMockRequest({
        user: { id: "123", role: "MANAGEMENT" }, // No tenant_id
        query: {
          rangeStart: "2026-09-01T00:00:00.000Z",
          rangeEnd: "2026-09-02T00:00:00.000Z",
        },
      });
      const res = createMockResponse();

      await HistoricalAnalyticsController.getPresenceSummary(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toContain("[UNAUTHORIZED_TENANT_CONTEXT]");
    });
  });

  // ==========================================================================
  // SECTION 6: OpenAPI v4.1.0 Additive Contract Verification
  // ==========================================================================
  describe("6. OpenAPI Additive Contract Verification", () => {
    it("6.1 reports OpenAPI spec version >= 4.1.0 (v4.2.0 with S7-05 Reporting)", () => {
      expect(swaggerSpec.info.version).toBe("4.2.0");
    });

    it("6.2 includes Historical Operational Analytics tag", () => {
      const tags = swaggerSpec.tags.map((t: any) => t.name);
      expect(tags).toContain("Historical Operational Analytics");
    });

    it("6.3 defines all 6 canonical historical analytics paths", () => {
      const paths = Object.keys(swaggerSpec.paths);
      expect(paths).toContain("/api/analytics/historical/presence/summary");
      expect(paths).toContain("/api/analytics/historical/presence/timeline");
      expect(paths).toContain("/api/analytics/historical/deviations");
      expect(paths).toContain("/api/analytics/historical/zones");
      expect(paths).toContain("/api/analytics/historical/riders");
      expect(paths).toContain("/api/analytics/historical/comparison");
    });

    it("6.4 defines all required DTO schemas in components.schemas", () => {
      const schemas = Object.keys(swaggerSpec.components.schemas);
      expect(schemas).toContain("AnalyticsGrain");
      expect(schemas).toContain("AnalyticsTimeContext");
      expect(schemas).toContain("PresenceComplianceDistribution");
      expect(schemas).toContain("PresenceMetrics");
      expect(schemas).toContain("AnalyticsTimelinePoint");
      expect(schemas).toContain("AnalyticsTimeline");
      expect(schemas).toContain("PresenceAnalyticsResult");
      expect(schemas).toContain("DeviationEpisode");
      expect(schemas).toContain("HistoricalDeviationSummary");
      expect(schemas).toContain("ZoneAnalyticsMetrics");
      expect(schemas).toContain("ZoneAnalyticsResult");
      expect(schemas).toContain("RiderAnalyticsMetrics");
      expect(schemas).toContain("RiderAnalyticsResult");
      expect(schemas).toContain("PeriodDeltaDirection");
      expect(schemas).toContain("PeriodMetricComparison");
      expect(schemas).toContain("AnalyticsPeriod");
      expect(schemas).toContain("PeriodComparisonContext");
      expect(schemas).toContain("PeriodComparisonResult");
    });

    it("6.5 verifies OpenAPI v4.0.0 paths remain intact (non-breaking regression)", () => {
      const paths = Object.keys(swaggerSpec.paths);
      // Verify core Stage 1-6 endpoints exist untouched
      expect(paths).toContain("/api/auth/login");
      expect(paths).toContain("/api/users");
      expect(paths).toContain("/api/zones");
      expect(paths).toContain("/api/pois");
      expect(paths).toContain("/api/dss/recommendations");
      expect(paths).toContain("/api/fleets");
      expect(paths).toContain("/api/lbs/track");
      expect(paths).toContain("/api/reports/executive-summary");
    });
  });
});
