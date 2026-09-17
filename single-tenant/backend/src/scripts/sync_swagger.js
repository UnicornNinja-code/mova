import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yamljs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerPath = path.resolve(__dirname, "../docs/swagger.yaml");

const doc = YAML.load(swaggerPath);
doc.paths = doc.paths || {};

// Helper to add endpoint if not already present or alias
function ensurePath(routePath, method, spec) {
  if (!doc.paths[routePath]) {
    doc.paths[routePath] = {};
  }
  doc.paths[routePath][method.toLowerCase()] = spec;
}

// 1. Dashboard Overview
ensurePath("/dashboard/overview", "get", {
  tags: ["Dashboard & Analytics"],
  summary: "Get Unified Executive & Supervisor KPI Dashboard Overview",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "query", name: "date", schema: { type: "string", format: "date" } }],
  responses: {
    200: { description: "Unified Dashboard Metrics (Active Zones, Riders, Fleets, Compliance & Revenue)" },
  },
});

ensurePath("/dashboard/summary", "get", {
  tags: ["Dashboard & Analytics"],
  summary: "Get Dashboard Summary Metrics (Alias)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "query", name: "date", schema: { type: "string", format: "date" } }],
  responses: {
    200: { description: "Dashboard Summary" },
  },
});

// 2. Weather Hub & Timeline
ensurePath("/weather/hub/{city_name}", "get", {
  tags: ["Weather & Roads"],
  summary: "Get Current Weather Condition for Central Hub by City Name",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "city_name", required: true, schema: { type: "string", example: "Sidoarjo" } }],
  responses: {
    200: { description: "Hub Weather Data (Temperature, Precipitation, Condition, Wind)" },
  },
});

ensurePath("/weather/zone/{zone_id}", "get", {
  tags: ["Weather & Roads"],
  summary: "Get Weather Condition and Suitability Score for Specific Zone",
  security: [{ BearerAuth: [] }],
  parameters: [
    { in: "path", name: "zone_id", required: true, schema: { type: "string", format: "uuid" } },
    { in: "query", name: "time", schema: { type: "string" } },
  ],
  responses: {
    200: { description: "Zone Weather Suitability & Forecast" },
  },
});

ensurePath("/weather/zone/{zone_id}/timeline", "get", {
  tags: ["Weather & Roads"],
  summary: "Get Hourly Weather Timeline & Rainfall Forecast for a Zone",
  security: [{ BearerAuth: [] }],
  parameters: [
    { in: "path", name: "zone_id", required: true, schema: { type: "string", format: "uuid" } },
    { in: "query", name: "date", schema: { type: "string", default: "today" } },
    { in: "query", name: "slot", schema: { type: "string", default: "all" } },
  ],
  responses: {
    200: { description: "Hourly Weather Timeline" },
  },
});

// 3. Candidate Selling Locations (Canonical Backend Routes)
ensurePath("/candidate-selling-locations/zone/{zoneId}", "get", {
  tags: ["Candidate Locations"],
  summary: "Get High-Potential Candidate Selling Spots for a Zone",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "zoneId", required: true, schema: { type: "string", format: "uuid" } }],
  responses: {
    200: { description: "Array of Ranked Candidate Selling Locations" },
  },
});

ensurePath("/candidate-selling-locations", "post", {
  tags: ["Candidate Locations"],
  summary: "Create Candidate Selling Spot Manually (SUPERADMIN, SUPERVISOR)",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["zone_id", "name", "latitude", "longitude"],
          properties: {
            zone_id: { type: "string", format: "uuid" },
            name: { type: "string" },
            latitude: { type: "number", format: "double" },
            longitude: { type: "number", format: "double" },
            notes: { type: "string" },
          },
        },
      },
    },
  },
  responses: {
    201: { description: "Candidate Spot Created" },
  },
});

ensurePath("/candidate-selling-locations/{id}", "get", {
  tags: ["Candidate Locations"],
  summary: "Get Candidate Selling Spot Details by ID",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
  responses: {
    200: { description: "Candidate Spot Detail" },
  },
});

ensurePath("/candidate-selling-locations/generate/zone/{zoneId}", "post", {
  tags: ["Candidate Locations"],
  summary: "Auto-Generate Candidate Selling Spots for a Zone based on POI Clustering (SUPERADMIN, SUPERVISOR)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "zoneId", required: true, schema: { type: "string", format: "uuid" } }],
  responses: {
    200: { description: "Spots Generated and Clustered Successfully" },
  },
});

ensurePath("/candidate-selling-locations/{id}/evaluate", "post", {
  tags: ["Candidate Locations"],
  summary: "Evaluate and Rank Single Candidate Location with TOPSIS Multi-Criteria (SUPERADMIN, SUPERVISOR)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
  responses: {
    200: { description: "Candidate Evaluation and Score Result" },
  },
});

ensurePath("/candidate-selling-locations/evaluate/zone/{zoneId}", "post", {
  tags: ["Candidate Locations"],
  summary: "Evaluate and Rank All Candidate Locations in a Zone (SUPERADMIN, SUPERVISOR)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "zoneId", required: true, schema: { type: "string", format: "uuid" } }],
  responses: {
    200: { description: "All Zone Candidate Spots Evaluated" },
  },
});

ensurePath("/candidate-selling-locations/evaluation/{evaluationId}", "get", {
  tags: ["Candidate Locations"],
  summary: "Fetch Evaluation Snapshot by ID (Phase 8 Audit Trail)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "evaluationId", required: true, schema: { type: "string", format: "uuid" } }],
  responses: {
    200: { description: "Snapshot Object" },
  },
});

ensurePath("/candidate-selling-locations/evaluation/{evaluationId}/explanation", "get", {
  tags: ["Candidate Locations"],
  summary: "Fetch Evaluation Explanation and Criteria Breakdown",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "evaluationId", required: true, schema: { type: "string", format: "uuid" } }],
  responses: {
    200: { description: "Explanation Breakdown" },
  },
});

ensurePath("/candidate-selling-locations/evaluation/{evaluationId}/audit", "get", {
  tags: ["Candidate Locations"],
  summary: "Fetch Evaluation Audit Metadata",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "evaluationId", required: true, schema: { type: "string", format: "uuid" } }],
  responses: {
    200: { description: "Audit Metadata" },
  },
});

// 4. Zone Updates
ensurePath("/zones/{id}/capacity", "patch", {
  tags: ["Zone Master"],
  summary: "Quick Update Zone Max Rider Capacity (SUPERADMIN)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["max_capacity"],
          properties: { max_capacity: { type: "integer", minimum: 1, example: 15 } },
        },
      },
    },
  },
  responses: {
    200: { description: "Capacity Updated" },
  },
});

ensurePath("/zones/{id}/status", "patch", {
  tags: ["Zone Master"],
  summary: "Toggle Zone Status (SUPERADMIN)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["status"],
          properties: { status: { type: "string", enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"] } },
        },
      },
    },
  },
  responses: {
    200: { description: "Zone Status Updated" },
  },
});

ensurePath("/zones/validate", "post", {
  tags: ["Zone Master"],
  summary: "Pre-Validate Zone GeoJSON Polygon (Dry-Run PostGIS ST_IsValid & ST_Overlaps) (SUPERADMIN)",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["polygon"],
          properties: {
            polygon: { type: "object", description: "GeoJSON Polygon Object" },
            name: { type: "string" },
            exclude_id: { type: "string", format: "uuid" },
          },
        },
      },
    },
  },
  responses: {
    200: { description: "Validation Result with Validity and Overlap Flags" },
  },
});

ensurePath("/zones/config", "get", {
  tags: ["Zone Master"],
  summary: "Get Zone Spatial Configuration and Constraints",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Zone Configuration Settings" },
  },
});

// 5. Rider Operations (Canonical /rider/*)
ensurePath("/rider/hub-armadas", "get", {
  tags: ["Rider Operations"],
  summary: "List Available Hub Armada Units with Real-Time Lock Status",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "List of Claimable Armadas" },
  },
});

ensurePath("/rider/hold-armada", "post", {
  tags: ["Rider Operations"],
  summary: "Temporary 5-Minute Hold on Armada Unit for Physical Inspection (Ticket-Booking Lock)",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["armada_id"],
          properties: { armada_id: { type: "string", format: "uuid" } },
        },
      },
    },
  },
  responses: {
    200: { description: "Armada Reserved for 5 Minutes" },
  },
});

ensurePath("/rider/cancel-hold-armada", "post", {
  tags: ["Rider Operations"],
  summary: "Release Temporary 5-Minute Hold on Armada Unit",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["armada_id"],
          properties: { armada_id: { type: "string", format: "uuid" } },
        },
      },
    },
  },
  responses: {
    200: { description: "Hold Released" },
  },
});

ensurePath("/rider/claim-armada", "post", {
  tags: ["Rider Operations"],
  summary: "Confirm Permanent Claim of Armada Unit (Converts status to IN_USE)",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["armada_id"],
          properties: { armada_id: { type: "string", format: "uuid" } },
        },
      },
    },
  },
  responses: {
    200: { description: "Armada Claimed (Status IN_USE)" },
  },
});

ensurePath("/rider/check-in", "post", {
  tags: ["Rider Operations"],
  summary: "GPS Check-in to Assigned Zone (PostGIS ST_Covers Verification)",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["latitude", "longitude"],
          properties: {
            latitude: { type: "number", format: "double", example: -7.4478 },
            longitude: { type: "number", format: "double", example: 112.7183 },
          },
        },
      },
    },
  },
  responses: {
    200: { description: "Check-in Verified Inside Zone Polygon (Status: OPERATING)" },
    400: { description: "GPS Location Outside Assigned Zone" },
  },
});

ensurePath("/rider/lock-spot", "post", {
  tags: ["Rider Operations"],
  summary: "Lock Candidate Selling Spot Inside Zone (Prevents Multi-Rider Conflict)",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["candidate_location_id"],
          properties: {
            candidate_location_id: { type: "string", format: "uuid" },
            latitude: { type: "number", format: "double" },
            longitude: { type: "number", format: "double" },
          },
        },
      },
    },
  },
  responses: {
    200: { description: "Spot Locked for Selling Session" },
  },
});

ensurePath("/rider/record-sale", "post", {
  tags: ["Rider Operations"],
  summary: "Record Field Product Sale Transaction with Session Provenance",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["product_id", "quantity"],
          properties: {
            product_id: { type: "string", format: "uuid" },
            quantity: { type: "integer", minimum: 1, example: 2 },
            latitude: { type: "number", format: "double" },
            longitude: { type: "number", format: "double" },
          },
        },
      },
    },
  },
  responses: {
    201: { description: "Sale Transaction Recorded" },
  },
});

ensurePath("/rider/my-sales", "get", {
  tags: ["Rider Operations"],
  summary: "Fetch Personal Field Sales History for Authenticated Rider",
  security: [{ BearerAuth: [] }],
  parameters: [
    { in: "query", name: "date", schema: { type: "string", format: "date" } },
    { in: "query", name: "page", schema: { type: "integer", default: 1 } },
    { in: "query", name: "limit", schema: { type: "integer", default: 20 } },
  ],
  responses: {
    200: { description: "Paginated Personal Sales History" },
  },
});

ensurePath("/rider/checkout", "post", {
  tags: ["Rider Operations"],
  summary: "Finish Daily Shift, Release Armada back to Hub & Complete Session",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: false,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            return_status: { type: "string", enum: ["ACTIVE", "MAINTENANCE"], default: "ACTIVE" },
            notes: { type: "string" },
          },
        },
      },
    },
  },
  responses: {
    200: { description: "Shift Completed Successfully" },
  },
});

// 6. Armada Maintenance
ensurePath("/armadas/{id}/maintenance", "post", {
  tags: ["Armada Fleet"],
  summary: "Set Armada Unit to Maintenance Status (SUPERADMIN, MANAGEMENT, SUPERVISOR)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
  requestBody: {
    required: false,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: { reason: { type: "string" } },
        },
      },
    },
  },
  responses: {
    200: { description: "Armada Set to Maintenance" },
  },
});

ensurePath("/armadas/{id}/release-maintenance", "post", {
  tags: ["Armada Fleet"],
  summary: "Release Armada Unit from Maintenance back to ACTIVE (SUPERADMIN, MANAGEMENT, SUPERVISOR)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
  responses: {
    200: { description: "Armada Released back to ACTIVE" },
  },
});

// 7. Products
ensurePath("/products/{id}", "get", {
  tags: ["Catalog & Products"],
  summary: "Get Product Detail by ID",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
  responses: { 200: { description: "Product Detail Object" } },
});

ensurePath("/products/{id}", "put", {
  tags: ["Catalog & Products"],
  summary: "Update Product Catalog Item (SUPERADMIN, MANAGEMENT)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            status: { type: "string", enum: ["AVAILABLE", "OUT_OF_STOCK", "DISCONTINUED"] },
          },
        },
      },
    },
  },
  responses: { 200: { description: "Product Updated" } },
});

ensurePath("/products/{id}", "delete", {
  tags: ["Catalog & Products"],
  summary: "Delete Product Catalog Item (SUPERADMIN, MANAGEMENT)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
  responses: { 200: { description: "Product Deleted" } },
});

ensurePath("/products/{id}/status", "patch", {
  tags: ["Catalog & Products"],
  summary: "Toggle Product Status (AVAILABLE / OUT_OF_STOCK) (SUPERADMIN, MANAGEMENT)",
  security: [{ BearerAuth: [] }],
  parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["status"],
          properties: { status: { type: "string", enum: ["AVAILABLE", "OUT_OF_STOCK", "DISCONTINUED"] } },
        },
      },
    },
  },
  responses: {
    200: { description: "Product Status Updated" },
  },
});

// 8. POI Moderation & Sync
ensurePath("/pois/pending", "get", {
  tags: ["POI & Spatial"],
  summary: "List Unapproved / Pending POIs Awaiting Moderation (SUPERADMIN, SUPERVISOR)",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Array of Pending POIs" },
  },
});

ensurePath("/pois/approve", "post", {
  tags: ["POI & Spatial"],
  summary: "Approve or Reject POI Submission (SUPERADMIN, SUPERVISOR)",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["poi_id", "is_approved"],
          properties: {
            poi_id: { type: "string", format: "uuid" },
            is_approved: { type: "boolean" },
            rejection_reason: { type: "string" },
          },
        },
      },
    },
  },
  responses: {
    200: { description: "POI Moderation Decision Saved" },
  },
});

ensurePath("/pois/sync-city", "post", {
  tags: ["POI & Spatial"],
  summary: "Master Data Full City POI Synchronization from Overpass OSM (SUPERADMIN)",
  security: [{ BearerAuth: [] }],
  requestBody: {
    required: false,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            city: { type: "string", example: "Sidoarjo" },
            force: { type: "boolean", default: false },
          },
        },
      },
    },
  },
  responses: {
    200: { description: "POI Sync Dispatched" },
  },
});

ensurePath("/pois/operational-area", "get", {
  tags: ["POI & Spatial"],
  summary: "List All Approved Operational Area POIs",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Array of Approved Operational Area POIs" },
  },
});

// 9. Report Export
ensurePath("/reports/export", "get", {
  tags: ["Dashboard & Analytics"],
  summary: "Multi-Format Report Export Engine (CSV or PDF)",
  security: [{ BearerAuth: [] }],
  parameters: [
    { in: "query", name: "reportType", required: true, schema: { type: "string", enum: ["EXECUTIVE", "RIDER_OPS", "ZONE_EFFECTIVENESS", "FLEET", "DSS_ACCURACY", "AUDIT"] } },
    { in: "query", name: "format", schema: { type: "string", enum: ["csv", "pdf"], default: "csv" } },
    { in: "query", name: "startDate", schema: { type: "string", format: "date" } },
    { in: "query", name: "endDate", schema: { type: "string", format: "date" } },
  ],
  responses: {
    200: { description: "File Download Stream (CSV text or PDF binary)" },
  },
});

// 10. New Dashboard Super Admin Aggregations (POI Stats, Competitor Summary, Fleet Distance Summary)
ensurePath("/pois/stats", "get", {
  tags: ["POI & Spatial"],
  summary: "Get Global POI Statistics, Category Breakdown & Spatial Density by Zone",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Global POI Overview, Total POIs, Active Categories & Zone Density Metrics" },
  },
});

ensurePath("/pois/summary", "get", {
  tags: ["POI & Spatial"],
  summary: "Get Global POI Statistics & Density Summary (Alias)",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "POI Summary" },
  },
});

ensurePath("/competitors/summary", "get", {
  tags: ["Competitors"],
  summary: "Get Citywide Competitor Overview, Category Breakdown & Zone Density Metrics",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Citywide Competitor Summary (Field Surveys + Coffee POIs)" },
  },
});

ensurePath("/competitors/stats", "get", {
  tags: ["Competitors"],
  summary: "Get Citywide Competitor Summary (Alias)",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Competitor Stats" },
  },
});

ensurePath("/lbs/zones-distance-summary", "get", {
  tags: ["LBS Telemetry"],
  summary: "Get Fleet Multi-Rider Live Distance & Hub Proximity Summary to All Zones",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Fleet Multi-Rider Geodesic Distances to Zone Centroids" },
  },
});

ensurePath("/lbs/zones-distance", "get", {
  tags: ["LBS Telemetry"],
  summary: "Get Fleet Multi-Rider Distance Summary (Alias)",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Fleet Distance Summary" },
  },
});

// Format and save YAML
const updatedYaml = YAML.stringify(doc, 10, 2);
fs.writeFileSync(swaggerPath, updatedYaml, "utf8");
console.log("✅ swagger.yaml successfully synchronized with all backend endpoints!");

