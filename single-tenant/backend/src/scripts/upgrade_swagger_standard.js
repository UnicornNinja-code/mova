import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yamljs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerPath = path.resolve(__dirname, "../docs/swagger.yaml");

console.log("Loading existing swagger.yaml from:", swaggerPath);
const existingDoc = YAML.load(swaggerPath);

const updatedDoc = {
  openapi: "3.0.3",
  info: {
    title: "MOVA DSS Engine & Fleet Operations API (Single-Tenant)",
    description: `## Coffee Operational Zone Intelligence System (COZIS / MOVA)
### Enterprise Single-Tenant Spatial Decision Support System & Fleet Orchestration Contract

Welcome to the **MOVA DSS Single-Tenant API Specification**. This document serves as the Single Source of Truth (SSOT) contract between backend micro-services, spatial calculation engines, background queue workers, and modern web/mobile frontend applications.

---

### 🏛️ System Architecture Overview
MOVA is an intelligent geospatial Decision Support System (DSS) tailored for mobile retail coffee fleets. It operates on a high-concurrency Node.js + Express 5 runtime backed by PostgreSQL with PostGIS extensions, Redis caching & BullMQ distributed job queues, and Socket.io for real-time Location-Based Services (LBS).

\`\`\`mermaid
graph TD
    Client[Web / Mobile Client] -->|HTTPS REST / JWT| Gateway[Express 5 API Gateway]
    Client -->|WSS Socket.io| LBS[LBS Real-Time Gateway]
    Gateway --> Auth[4-Role RBAC Middleware]
    Gateway --> DSS[BWM-TOPSIS Solver Engine]
    Gateway --> Fleet[5-Min Armada Lock Queue]
    Gateway --> GIS[PostGIS Spatial Repository]
    DSS --> Solver[LP Linear Programming Worker]
    Fleet --> Redis[(Redis Key-Value & Lock)]
    GIS --> DB[(PostgreSQL + PostGIS)]
\`\`\`

---

### 👥 Multi-Role RBAC & Hierarchy Guard
The system enforces strict 4-Role Role-Based Access Control (RBAC):
- **\`SUPERADMIN\`**: Complete administrative authority, polygon creation, BWM weight calibration, manual sync triggers, and user hierarchy management.
- **\`MANAGEMENT\`**: Executive oversight, multi-zone KPI analytics, revenue reporting, fleet status inspection, and supervisor account provisioning.
- **\`SUPERVISOR\`**: Field operations commander, real-time rider dispatching, TOPSIS recommendation approval, manual override, and fleet check-in audits.
- **\`RIDER\`**: Field mobile operator, 5-minute armada holding/claiming, geofence check-in, selling spot claiming, and POS transactions recording.

> **Hierarchy Guard Rule**: A user cannot create or modify an account with a role equal to or higher than their own (e.g., \`MANAGEMENT\` cannot create or edit \`SUPERADMIN\` accounts).

---

### 🧠 Decision Support System (DSS) Pipeline
MOVA utilizes a **Hybrid Multi-Criteria Decision Making (MCDM)** pipeline:
1. **Best-Worst Method (BWM)**: Computes optimal criteria weights ($w_1, \\dots, w_6$) using a Linear Programming (LP) solver with consistency ratio ($CR \\le 0.10$).
2. **TOPSIS Ranking**: Evaluates operational zones based on 6 dynamic criteria:
   - **$C_1$ Crowd Density**: Spatial POI concentration with time-decay weights (pagi, siang, sore, malam).
   - **$C_2$ Weather Condition**: Real-time Open-Meteo precipitation and temperature suitability.
   - **$C_3$ Event Proximity**: Temporal public events & gatherings within 1km buffer.
   - **$C_4$ Road Accessibility**: Protocol and arterial road access (excluding toll roads).
   - **$C_5$ Hub Proximity**: Haversine/geodesic distance from central operational warehouse.
   - **$C_6$ Competitor Density**: Proximity penalty based on nearby commercial coffee vendors.

---

### 🛵 5-Minute Armada Reservation Lock Workflow
To prevent race conditions during morning shift check-in:
1. Rider initiates \`POST /api/rider/hold-armada\` or \`POST /api/rider-operational/hold-armada\`.
2. Redis acquires a distributed reservation lock with a strict 300-second TTL (ticket-booking style).
3. BullMQ scheduler automatically releases the unit back to \`AVAILABLE\` if physical check-in is not finalized within 5 minutes.
4. Rider confirms physical inspection via \`POST /api/rider/claim-armada\`, converting the state to \`IN_USE\`.

---

### 📦 Standard API Response Envelopes
All REST endpoints adhere to a standardized JSend-compliant envelope structure:

#### Success Response (\`200 OK\` / \`201 Created\`)
\`\`\`json
{
  "status": "success",
  "message": "Resource retrieved successfully",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
\`\`\`

#### Error Response (\`4xx\` / \`5xx\`)
\`\`\`json
{
  "status": "error",
  "message": "Validation failed on payload coordinates",
  "error": {
    "code": "SPATIAL_VALIDATION_ERROR",
    "details": ["Polygon intersects with restricted toll road corridor"]
  },
  "timestamp": "2026-09-16T09:17:32.000Z"
}
\`\`\`
`,
    version: "1.0.0",
    termsOfService: "https://kopikeliling.com/terms",
    contact: {
      name: "MOVA Engineering Team",
      email: "engineering@kopikeliling.com",
      url: "https://kopikeliling.com/developer",
    },
    license: {
      name: "Proprietary / MOVA Enterprise License",
      url: "https://kopikeliling.com/license",
    },
  },
  servers: [
    {
      url: "http://localhost:8090/api",
      description: "Local Single-Tenant Development Server (Express 5 Backend on Port 8090)",
    },
    {
      url: "http://localhost:8080/api",
      description: "Local Docker / Staging Environment Gateway",
    },
    {
      url: "/api",
      description: "Production Gateway (Relative URL Routing)",
    },
  ],
  tags: [
    {
      name: "Auth",
      description: "Authentication, JWT token issuance, session refresh, activation tokens & password recovery",
    },
    {
      name: "User Account",
      description: "User account management, profile settings, and role hierarchy enforcement guard",
    },
    {
      name: "Zone Master",
      description: "Spatial operational geofences, PostGIS polygon validation, self-intersection & overlap checks",
    },
    {
      name: "DSS Engine",
      description: "Hybrid BWM (LP Solver) and TOPSIS multi-criteria decision engine, active weight configs & historical snapshots",
    },
    {
      name: "POI & Spatial",
      description: "Point of Interest (POI) catalog, time-based crowd weights, Overpass OSM sync, and spatial density aggregation",
    },
    {
      name: "Competitors",
      description: "Commercial competitor surveys, spatial density scoring (C6), and market penetration analysis",
    },
    {
      name: "Candidate Locations",
      description: "High-potential candidate selling spots, in-zone spatial clustering, and spot-level TOPSIS ranking",
    },
    {
      name: "Weather & Roads",
      description: "Open-Meteo real-time weather suitability (C2), protocol road accessibility (C4), and toll road restrictions",
    },
    {
      name: "Armada Fleet",
      description: "Master fleet units, 5-minute ticket reservation lock, maintenance status, and vehicle telemetry",
    },
    {
      name: "Rider Operations",
      description: "Daily rider operational lifecycle: armada reservation, claim, GPS geofence check-in, POS sales, and checkout",
    },
    {
      name: "Distribution & Plotting",
      description: "FIFO rider duty queue, automatic DSS TOPSIS zone distribution, supervisor manual overrides, and shift history",
    },
    {
      name: "Catalog & Products",
      description: "Product menu items, pricing configuration, stock status, and inventory availability",
    },
    {
      name: "Sales & Revenue",
      description: "Daily field sales transactions, cashier ledger, revenue density by zone, and performance reports",
    },
    {
      name: "LBS Telemetry",
      description: "Location-Based Services telemetry, 30s GPS pings, multi-rider distance matrix, and geofence deviation detection",
    },
    {
      name: "Dashboard & Analytics",
      description: "Executive & supervisor KPI dashboards, sales trends, fleet utilization, and real-time quick alerts",
    },
    {
      name: "Audit & Settings",
      description: "Immutable system activity audit trail, central hub configuration, basemap tile providers, and system parameters",
    },
  ],
  paths: existingDoc.paths || {},
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Standard JSON Web Token (JWT) authorization header. Format: `Bearer <access_token>`",
      },
      CookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "refreshToken",
        description: "HTTP-Only secure cookie containing the session refresh token.",
      },
    },
    parameters: {
      IdPath: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Unique resource identifier (UUIDv4)",
      },
      ZoneIdPath: {
        name: "zone_id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Target operational zone UUIDv4 identifier",
      },
      DateQuery: {
        name: "date",
        in: "query",
        required: false,
        schema: { type: "string", format: "date", example: "2026-09-16" },
        description: "Target operational date in YYYY-MM-DD format",
      },
      TimeSlotQuery: {
        name: "time",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["pagi", "siang", "sore", "malam"], example: "pagi" },
        description: "Operational time window slot for DSS evaluation",
      },
      LimitQuery: {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
        description: "Maximum number of records to return in a single page",
      },
      PageQuery: {
        name: "page",
        in: "query",
        required: false,
        schema: { type: "integer", default: 1, minimum: 1 },
        description: "Pagination page index",
      },
      SearchQuery: {
        name: "search",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Full-text search keyword query",
      },
    },
    responses: {
      SuccessEnvelope: {
        description: "Standard successful response envelope",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: { type: "string", example: "success" },
                message: { type: "string", example: "Operation completed successfully" },
                data: { type: "object" },
              },
            },
          },
        },
      },
      CreatedEnvelope: {
        description: "Resource created successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: { type: "string", example: "success" },
                message: { type: "string", example: "Resource created successfully" },
                data: { type: "object" },
              },
            },
          },
        },
      },
      BadRequestError: {
        description: "Bad Request - Invalid payload parameters or malformed syntax",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      UnauthorizedError: {
        description: "Unauthorized - Missing, invalid, or expired JWT access token",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      ForbiddenError: {
        description: "Forbidden - Insufficient role permissions or RBAC hierarchy guard violation",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      NotFoundError: {
        description: "Not Found - Requested entity does not exist in the system",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      ConflictError: {
        description: "Conflict - State collision, duplicate key, or expired resource reservation lock",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      ValidationError: {
        description: "Validation Error - Schema validation failed on input attributes",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      RateLimitError: {
        description: "Too Many Requests - Rate limit exceeded. Please back off before retrying.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      InternalServerError: {
        description: "Internal Server Error - Unhandled system exception",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["status", "message"],
        properties: {
          status: { type: "string", example: "error" },
          message: { type: "string", example: "An error occurred during request execution" },
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              details: { type: "array", items: { type: "string" } },
            },
          },
          timestamp: { type: "string", format: "date-time", example: "2026-09-16T09:17:32.000Z" },
        },
      },
      GeoJSONPoint: {
        type: "object",
        required: ["type", "coordinates"],
        properties: {
          type: { type: "string", enum: ["Point"], example: "Point" },
          coordinates: {
            type: "array",
            items: { type: "number" },
            minItems: 2,
            maxItems: 2,
            example: [112.7166, -7.4478],
            description: "[longitude, latitude] in WGS84 coordinates",
          },
        },
      },
      GeoJSONPolygon: {
        type: "object",
        required: ["type", "coordinates"],
        properties: {
          type: { type: "string", enum: ["Polygon"], example: "Polygon" },
          coordinates: {
            type: "array",
            items: {
              type: "array",
              items: {
                type: "array",
                items: { type: "number" },
                minItems: 2,
                maxItems: 2,
              },
            },
            example: [
              [
                [112.716, -7.447],
                [112.72, -7.447],
                [112.72, -7.45],
                [112.716, -7.45],
                [112.716, -7.447],
              ],
            ],
            description: "Array of linear ring coordinate arrays. First and last points must be identical.",
          },
        },
      },
      User: {
        type: "object",
        required: ["id", "email", "username", "name", "role", "is_active"],
        properties: {
          id: { type: "string", format: "uuid", example: "d3b07384-d113-40e1-9549-d7b889370001" },
          email: { type: "string", format: "email", example: "supervisor1@kopikeliling.com" },
          username: { type: "string", example: "supervisor_sidoarjo" },
          name: { type: "string", example: "Supervisor Lapangan Sidoarjo" },
          phone: { type: "string", example: "081234567890" },
          role: {
            type: "string",
            enum: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"],
            example: "SUPERVISOR",
          },
          is_active: { type: "boolean", example: true },
          first_login: { type: "boolean", example: false },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      UserCreateInput: {
        type: "object",
        required: ["email", "username", "password", "name", "role"],
        properties: {
          email: { type: "string", format: "email", example: "supervisor1@kopikeliling.com" },
          username: { type: "string", example: "supervisor1" },
          password: { type: "string", format: "password", example: "SuperSecret2026!" },
          name: { type: "string", example: "Supervisor Lapangan Sidoarjo" },
          phone: { type: "string", example: "081234567890" },
          birth_date: { type: "string", format: "date", example: "1995-08-17" },
          role: {
            type: "string",
            enum: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"],
            example: "SUPERVISOR",
          },
        },
      },
      UserUpdateInput: {
        type: "object",
        properties: {
          name: { type: "string", example: "Supervisor Lapangan Baru" },
          email: { type: "string", format: "email", example: "supervisor_new@kopikeliling.com" },
          username: { type: "string", example: "supervisor_new" },
          phone: { type: "string", example: "081987654321" },
          role: {
            type: "string",
            enum: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"],
            example: "SUPERVISOR",
          },
        },
      },
      Zone: {
        type: "object",
        required: ["id", "name", "status", "max_capacity", "polygon"],
        properties: {
          id: { type: "string", format: "uuid", example: "8f5a3b90-1c2d-4e5f-8a9b-0c1d2e3f4a5b" },
          name: { type: "string", example: "Zona Alun-Alun Sidoarjo" },
          description: { type: "string", example: "Pusat keramaian publik dan taman kota" },
          max_capacity: { type: "integer", example: 3 },
          status: { type: "string", enum: ["ACTIVE", "RESTRICTED", "INACTIVE"], example: "ACTIVE" },
          area_sqm: { type: "number", example: 45020.5 },
          polygon: { $ref: "#/components/schemas/GeoJSONPolygon" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      ZoneInput: {
        type: "object",
        required: ["name", "polygon"],
        properties: {
          name: { type: "string", example: "Zona Alun-Alun Sidoarjo" },
          description: { type: "string", example: "Pusat keramaian publik dan taman kota" },
          max_capacity: { type: "integer", default: 3, example: 3 },
          status: { type: "string", enum: ["ACTIVE", "RESTRICTED", "INACTIVE"], default: "ACTIVE", example: "ACTIVE" },
          polygon: { $ref: "#/components/schemas/GeoJSONPolygon" },
        },
      },
      ZoneValidationInput: {
        type: "object",
        required: ["polygon"],
        properties: {
          polygon: { $ref: "#/components/schemas/GeoJSONPolygon" },
          name: { type: "string", example: "Test Valid Zone" },
          exclude_id: { type: "string", format: "uuid", description: "Optional zone ID to exclude when updating" },
        },
      },
      ZoneValidationResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "success" },
          valid: { type: "boolean", example: true },
          overlaps: { type: "boolean", example: false },
          intersects_restricted_road: { type: "boolean", example: false },
          area_sqm: { type: "number", example: 52310.8 },
          reasons: { type: "array", items: { type: "string" } },
        },
      },
      POICategory: {
        type: "object",
        required: ["id", "name", "category_group"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Universitas / Kampus" },
          category_group: { type: "string", example: "Pendidikan" },
          crowd_pagi: { type: "number", example: 0.9 },
          crowd_siang: { type: "number", example: 0.85 },
          crowd_sore: { type: "number", example: 0.6 },
          crowd_malam: { type: "number", example: 0.3 },
        },
      },
      POI: {
        type: "object",
        required: ["id", "name", "category_id", "latitude", "longitude", "status"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Universitas Muhammadiyah Sidoarjo (UMSIDA)" },
          category_id: { type: "string", format: "uuid" },
          category_name: { type: "string", example: "Universitas / Kampus" },
          zone_id: { type: "string", format: "uuid", nullable: true },
          latitude: { type: "number", format: "double", example: -7.4478 },
          longitude: { type: "number", format: "double", example: 112.7166 },
          status: { type: "string", enum: ["APPROVED", "PENDING", "REJECTED"], example: "APPROVED" },
          source: { type: "string", example: "OVERPASS_OSM" },
        },
      },
      Competitor: {
        type: "object",
        required: ["id", "name", "latitude", "longitude"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Kopi Kenangan Sidoarjo" },
          brand_type: { type: "string", example: "CHAIN_STORE" },
          latitude: { type: "number", format: "double", example: -7.4485 },
          longitude: { type: "number", format: "double", example: 112.7182 },
          zone_id: { type: "string", format: "uuid", nullable: true },
          price_range: { type: "string", example: "15k-30k" },
        },
      },
      CandidateSellingLocation: {
        type: "object",
        required: ["id", "zone_id", "name", "latitude", "longitude"],
        properties: {
          id: { type: "string", format: "uuid" },
          zone_id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Spot Gerbang Utama Kampus A" },
          latitude: { type: "number", format: "double", example: -7.448 },
          longitude: { type: "number", format: "double", example: 112.717 },
          is_locked: { type: "boolean", example: false },
          locked_by_rider_id: { type: "string", format: "uuid", nullable: true },
          rank: { type: "integer", example: 1 },
          score: { type: "number", example: 0.8842 },
        },
      },
      BWMCalculationInput: {
        type: "object",
        required: ["best_criteria_id", "worst_criteria_id", "best_to_others", "worst_to_others"],
        properties: {
          name: { type: "string", example: "Bobot BWM Q3 Sidoarjo 2026" },
          best_criteria_id: { type: "string", format: "uuid", example: "c1-uuid" },
          worst_criteria_id: { type: "string", format: "uuid", example: "c6-uuid" },
          best_to_others: {
            type: "object",
            description: "Pairwise comparisons 1-9 from Best to Others",
            example: { "c1": 1, "c2": 2, "c3": 3, "c4": 3, "c5": 4, "c6": 7 },
          },
          worst_to_others: {
            type: "object",
            description: "Pairwise comparisons 1-9 from Others to Worst",
            example: { "c1": 7, "c2": 5, "c3": 4, "c4": 3, "c5": 2, "c6": 1 },
          },
        },
      },
      BWMCalculationResult: {
        type: "object",
        properties: {
          status: { type: "string", example: "success" },
          weights: {
            type: "object",
            example: { "C1": 0.35, "C2": 0.22, "C3": 0.16, "C4": 0.12, "C5": 0.10, "C6": 0.05 },
          },
          consistency_ratio: { type: "number", example: 0.042 },
          is_consistent: { type: "boolean", example: true },
          config_id: { type: "string", format: "uuid" },
        },
      },
      Armada: {
        type: "object",
        required: ["id", "code", "plate_number", "status"],
        properties: {
          id: { type: "string", format: "uuid" },
          code: { type: "string", example: "ARM-01" },
          plate_number: { type: "string", example: "W 1234 AB" },
          status: { type: "string", enum: ["AVAILABLE", "HOLD", "IN_USE", "MAINTENANCE"], example: "AVAILABLE" },
          hold_expires_at: { type: "string", format: "date-time", nullable: true },
          current_rider_id: { type: "string", format: "uuid", nullable: true },
        },
      },
      RiderOperationalSession: {
        type: "object",
        properties: {
          session_id: { type: "string", format: "uuid" },
          rider_id: { type: "string", format: "uuid" },
          rider_name: { type: "string", example: "Budi Santoso" },
          armada_id: { type: "string", format: "uuid" },
          armada_code: { type: "string", example: "ARM-01" },
          zone_id: { type: "string", format: "uuid" },
          zone_name: { type: "string", example: "Zona Alun-Alun Sidoarjo" },
          status: { type: "string", enum: ["HOLDING", "CLAIMED", "CHECKED_IN", "SELLING", "CHECKED_OUT"], example: "CHECKED_IN" },
          checked_in_at: { type: "string", format: "date-time" },
          total_sales_amount: { type: "number", example: 350000 },
        },
      },
      Product: {
        type: "object",
        required: ["id", "name", "price", "status"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Es Kopi Susu Aren Klasik" },
          category: { type: "string", example: "Coffee" },
          price: { type: "number", example: 12000 },
          status: { type: "string", enum: ["AVAILABLE", "OUT_OF_STOCK"], example: "AVAILABLE" },
        },
      },
      Sale: {
        type: "object",
        required: ["id", "rider_id", "zone_id", "total_amount", "items"],
        properties: {
          id: { type: "string", format: "uuid" },
          session_id: { type: "string", format: "uuid" },
          rider_id: { type: "string", format: "uuid" },
          zone_id: { type: "string", format: "uuid" },
          total_amount: { type: "number", example: 36000 },
          payment_method: { type: "string", enum: ["CASH", "QRIS"], example: "QRIS" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string", format: "uuid" },
                product_name: { type: "string", example: "Es Kopi Susu Aren Klasik" },
                quantity: { type: "integer", example: 3 },
                unit_price: { type: "number", example: 12000 },
                subtotal: { type: "number", example: 36000 },
              },
            },
          },
          created_at: { type: "string", format: "date-time" },
        },
      },
      DistributionRun: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          run_type: { type: "string", enum: ["AUTO_FIFO_TOPSIS", "MANUAL_SUPERVISOR_OVERRIDE"], example: "AUTO_FIFO_TOPSIS" },
          assigned_count: { type: "integer", example: 8 },
          time_slot: { type: "string", example: "pagi" },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
};

// Generate standard operationIds and rich response references for paths
for (const [pKey, methods] of Object.entries(updatedDoc.paths)) {
  for (const [mKey, op] of Object.entries(methods)) {
    if (["get", "post", "put", "patch", "delete"].includes(mKey.toLowerCase())) {
      // Auto-assign clean operationId if missing
      if (!op.operationId) {
        const cleanPath = pKey
          .replace(/\/api/g, "")
          .replace(/[\{\}]/g, "")
          .split("/")
          .filter(Boolean)
          .map((seg, idx) => (idx === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
          .join("");
        op.operationId = mKey.toLowerCase() + (cleanPath.charAt(0).toUpperCase() + cleanPath.slice(1));
      }

      // Ensure standard responses format
      op.responses = op.responses || {};
      if (!op.responses["401"] && op.security) {
        op.responses["401"] = { description: "Unauthorized - Invalid or expired JWT token" };
      }
      if (!op.responses["403"] && op.security) {
        op.responses["403"] = { description: "Forbidden - Insufficient role permissions or hierarchy guard rejection" };
      }
      if (!op.responses["500"]) {
        op.responses["500"] = { description: "Internal Server Error - Unexpected server exception" };
      }
    }
  }
}

// Convert object to YAML with high indentation clarity
const newYaml = YAML.stringify(updatedDoc, 10, 2);
fs.writeFileSync(swaggerPath, newYaml, "utf8");
console.log("✅ Successfully upgraded swagger.yaml with complete api-documenter standards!");
