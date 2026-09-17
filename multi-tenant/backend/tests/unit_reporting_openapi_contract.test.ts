/*
 * unit_reporting_openapi_contract.test.ts
 * S7-05-09: Contract Synchronization & Verification for OpenAPI v4.2.0
 * MOVA Reporting & Asynchronous Export Engine SSOT
 */

import { describe, it, expect } from "bun:test";
import { swaggerSpec } from "../src/docs/swagger.js";
import { ReportType, ReportFormat, ReportJobStatus } from "../src/types/reporting.types.js";

describe("S7-05-09: OpenAPI v4.2.0 Reporting Contract Verification", () => {
  // ==========================================================================
  // Section 1: Spec Metadata & Versioning
  // ==========================================================================
  describe("1. Spec Metadata & Versioning", () => {
    it("[OAS-01] spec version is strictly bumped to 4.2.0", () => {
      expect(swaggerSpec.info.version).toBe("4.2.0");
    });

    it("[OAS-02] platform title matches MOVA standard", () => {
      expect(swaggerSpec.info.title).toBe(
        "MOVA Geospatial Decision Intelligence & Fleet Operations Platform API"
      );
    });

    it("[OAS-03] info description documents Stage 7-05 Reporting & Asynchronous Export Engine", () => {
      expect(swaggerSpec.info.description).toContain("Operational Reporting & Asynchronous Export Engine (Stage 7-05 - FROZEN)");
      expect(swaggerSpec.info.description).toContain("HTTP 202 Accepted");
      expect(swaggerSpec.info.description).toContain("BullMQ");
      expect(swaggerSpec.info.description).toContain("Resource Governance");
    });

    it("[OAS-04] BearerAuth security scheme is configured for tenant isolation", () => {
      expect(swaggerSpec.components.securitySchemes.BearerAuth).toBeDefined();
      expect(swaggerSpec.components.securitySchemes.BearerAuth.type).toBe("http");
      expect(swaggerSpec.components.securitySchemes.BearerAuth.scheme).toBe("bearer");
    });
  });

  // ==========================================================================
  // Section 2: Schema SSOT Integration
  // ==========================================================================
  describe("2. Schema SSOT Integration", () => {
    const schemas = swaggerSpec.components.schemas;

    it("[OAS-05] defines ReportType enum matching domain model", () => {
      expect(schemas.ReportType).toBeDefined();
      expect(schemas.ReportType.enum).toEqual([
        ReportType.PRESENCE_COMPLIANCE_REPORT,
        ReportType.ZONE_PERFORMANCE_REPORT,
        ReportType.RIDER_DUTY_REPORT,
        ReportType.SALES_SETTLEMENT_REPORT,
      ]);
    });

    it("[OAS-06] defines ReportFormat enum matching domain model", () => {
      expect(schemas.ReportFormat).toBeDefined();
      expect(schemas.ReportFormat.enum).toEqual([
        ReportFormat.CSV,
        ReportFormat.XLSX,
        ReportFormat.PDF,
      ]);
    });

    it("[OAS-07] defines ReportJobStatus enum matching state machine", () => {
      expect(schemas.ReportJobStatus).toBeDefined();
      expect(schemas.ReportJobStatus.enum).toEqual([
        ReportJobStatus.QUEUED,
        ReportJobStatus.PROCESSING,
        ReportJobStatus.COMPLETED,
        ReportJobStatus.FAILED,
      ]);
    });

    it("[OAS-08] defines ReportAvailability schema with READY and DEFERRED", () => {
      expect(schemas.ReportAvailability).toBeDefined();
      expect(schemas.ReportAvailability.enum).toEqual(["READY", "DEFERRED"]);
    });

    it("[OAS-09] defines ReportCapabilitySpec schema with authoritative sources", () => {
      expect(schemas.ReportCapabilitySpec).toBeDefined();
      expect(schemas.ReportCapabilitySpec.required).toContain("reportType");
      expect(schemas.ReportCapabilitySpec.required).toContain("availability");
      expect(schemas.ReportCapabilitySpec.required).toContain("authoritativeSources");
      expect(schemas.ReportCapabilitySpec.required).toContain("supportedFormats");
    });

    it("[OAS-10] defines CreateExportJobRequest with required filter fields", () => {
      expect(schemas.CreateExportJobRequest).toBeDefined();
      expect(schemas.CreateExportJobRequest.required).toContain("reportType");
      expect(schemas.CreateExportJobRequest.required).toContain("format");
      expect(schemas.CreateExportJobRequest.required).toContain("rangeStart");
      expect(schemas.CreateExportJobRequest.required).toContain("rangeEnd");
    });

    it("[OAS-11] defines ReportExportJob and NEVER exposes internal artifactPath filesystem leak", () => {
      expect(schemas.ReportExportJob).toBeDefined();
      const props = Object.keys(schemas.ReportExportJob.properties);
      expect(props).toContain("id");
      expect(props).toContain("tenantId");
      expect(props).toContain("reportType");
      expect(props).toContain("format");
      expect(props).toContain("status");
      expect(props).toContain("progress");
      expect(props).toContain("rowCount");
      expect(props).toContain("rowLimit");
      expect(props).toContain("truncated");
      expect(props).toContain("artifactExpiresAt");

      // Critical Security Invariant: artifactPath MUST NOT be in public schema
      expect(props).not.toContain("artifactPath");
    });

    it("[OAS-12] defines ReportExportJobStatusResponse exposing downloadUrl and isExpired", () => {
      expect(schemas.ReportExportJobStatusResponse).toBeDefined();
      expect(schemas.ReportExportJobStatusResponse.required).toContain("job");
      expect(schemas.ReportExportJobStatusResponse.required).toContain("downloadUrl");
      expect(schemas.ReportExportJobStatusResponse.required).toContain("isExpired");
    });

    it("[OAS-13] defines CreateExportJobResponse exposing job and statusUrl", () => {
      expect(schemas.CreateExportJobResponse).toBeDefined();
      expect(schemas.CreateExportJobResponse.required).toContain("job");
      expect(schemas.CreateExportJobResponse.required).toContain("statusUrl");
    });

    it("[OAS-14] defines ExportJobListResponse with pagination metadata", () => {
      expect(schemas.ExportJobListResponse).toBeDefined();
      expect(schemas.ExportJobListResponse.required).toContain("jobs");
      expect(schemas.ExportJobListResponse.required).toContain("total");
      expect(schemas.ExportJobListResponse.required).toContain("limit");
      expect(schemas.ExportJobListResponse.required).toContain("offset");
    });

    it("[OAS-15] defines ReportError schema with canonical domain error codes", () => {
      expect(schemas.ReportError).toBeDefined();
      const codes = schemas.ReportError.properties.code.enum;
      expect(codes).toContain("MAX_CONCURRENT_EXPORT_JOBS");
      expect(codes).toContain("REPORT_RANGE_EXCEEDED");
      expect(codes).toContain("REPORT_CAPABILITY_DEFERRED");
      expect(codes).toContain("REPORT_JOB_NOT_FOUND");
      expect(codes).toContain("REPORT_NOT_READY");
      expect(codes).toContain("ARTIFACT_EXPIRED");
      expect(codes).toContain("ARTIFACT_UNAVAILABLE");
    });
  });

  // ==========================================================================
  // Section 3: Canonical Endpoint Integration
  // ==========================================================================
  describe("3. Canonical Endpoint Integration", () => {
    const paths = swaggerSpec.paths;

    it("[OAS-16] POST /api/reports/export specifies 202 Accepted async semantics", () => {
      const endpoint = paths["/api/reports/export"]?.post;
      expect(endpoint).toBeDefined();
      expect(endpoint.security).toEqual([{ BearerAuth: [] }]);
      expect(endpoint.responses["202"]).toBeDefined();
      expect(endpoint.responses["400"]).toBeDefined();
      expect(endpoint.responses["429"]).toBeDefined();
    });

    it("[OAS-17] GET /api/reports/export enforces implicit tenant isolation without client query parameter", () => {
      const endpoint = paths["/api/reports/export"]?.get;
      expect(endpoint).toBeDefined();
      expect(endpoint.security).toEqual([{ BearerAuth: [] }]);
      
      const paramNames = endpoint.parameters?.map((p: any) => p.name) || [];
      expect(paramNames).toContain("limit");
      expect(paramNames).toContain("offset");
      expect(paramNames).toContain("status");
      expect(paramNames).toContain("reportType");
      
      // Tenant parameter must NEVER be accepted from client query
      expect(paramNames).not.toContain("tenantId");
      expect(paramNames).not.toContain("tenant_id");
    });

    it("[OAS-18] GET /api/reports/export/{id} specifies path parameter and 404 error", () => {
      const endpoint = paths["/api/reports/export/{id}"]?.get;
      expect(endpoint).toBeDefined();
      expect(endpoint.security).toEqual([{ BearerAuth: [] }]);
      expect(endpoint.parameters[0].name).toBe("id");
      expect(endpoint.parameters[0].in).toBe("path");
      expect(endpoint.parameters[0].required).toBe(true);
      expect(endpoint.responses["200"]).toBeDefined();
      expect(endpoint.responses["404"]).toBeDefined();
    });

    it("[OAS-19] GET /api/reports/export/{id}/download specifies binary content types and 409/410 errors", () => {
      const endpoint = paths["/api/reports/export/{id}/download"]?.get;
      expect(endpoint).toBeDefined();
      expect(endpoint.security).toEqual([{ BearerAuth: [] }]);
      
      const contentTypes = Object.keys(endpoint.responses["200"].content);
      expect(contentTypes).toContain("text/csv");
      expect(contentTypes).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(contentTypes).toContain("application/pdf");

      expect(endpoint.responses["404"]).toBeDefined();
      expect(endpoint.responses["409"]).toBeDefined(); // NOT READY
      expect(endpoint.responses["410"]).toBeDefined(); // EXPIRED
    });
  });

  // ==========================================================================
  // Section 4: Non-Breaking Backward Compatibility
  // ==========================================================================
  describe("4. Non-Breaking Backward Compatibility", () => {
    it("[OAS-20] preserves all core Stage 1-6 and S7-03 endpoints", () => {
      const paths = Object.keys(swaggerSpec.paths);
      expect(paths).toContain("/api/auth/login");
      expect(paths).toContain("/api/users");
      expect(paths).toContain("/api/zones");
      expect(paths).toContain("/api/pois");
      expect(paths).toContain("/api/dss/recommendations");
      expect(paths).toContain("/api/fleets");
      expect(paths).toContain("/api/lbs/track");
      expect(paths).toContain("/api/analytics/historical/presence/summary");
      expect(paths).toContain("/api/analytics/historical/comparison");
      expect(paths).toContain("/api/reports/executive-summary");
    });
  });
});
