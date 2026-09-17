# MOVA BACKEND REQUIREMENTS — SINGLE SOURCE OF TRUTH (SSOT)

**Document Status:** REQUIREMENT BASELINE (READ-ONLY BEFORE RECONSTRUCTION)  
**Runtime & Stack:** Bun 1.4, TypeScript, Express 5, PostgreSQL 16 + PostGIS, Redis, BullMQ  
**Created:** 2026-09-03  
**Purpose:** Authoritative requirement baseline extracted from UI contracts, API routes, services, reconstruction plan, and audit findings. This document is the SSOT before any backend reconstruction begins.

> [!IMPORTANT]
> This document defines WHAT the system must do, not HOW it is currently implemented. Existing code is referenced only to identify gaps, contradictions, and current state.

---

## Table of Contents

1. [System Scope](#1-system-scope)
2. [Actors & Roles](#2-actors--roles)
3. [Authentication Requirements](#3-authentication-requirements)
4. [Onboarding & Operational Context](#4-onboarding--operational-context)
5. [User Management](#5-user-management)
6. [Rider Operational State](#6-rider-operational-state)
7. [Fleet / Armada](#7-fleet--armada)
8. [Zone Management](#8-zone-management)
9. [POI & Spatial Data Pipeline](#9-poi--spatial-data-pipeline)
10. [Weather](#10-weather)
11. [DSS — BWM + TOPSIS](#11-dss--bwm--topsis)
12. [Distribution / Plotting](#12-distribution--plotting)
13. [Rider Execution / Check-in / Checkout / LBS](#13-rider-execution--check-in--checkout--lbs)
14. [Sales / Transaction](#14-sales--transaction)
15. [Dashboard](#15-dashboard)
16. [Reporting & Analytics](#16-reporting--analytics)
17. [Audit & Logging](#17-audit--logging)
18. [Background Jobs / Cron / Queue](#18-background-jobs--cron--queue)
19. [API Requirements](#19-api-requirements)
20. [Database & Data Integrity Requirements](#20-database--data-integrity-requirements)
21. [Security Requirements](#21-security-requirements)
22. [Performance Requirements](#22-performance-requirements)
23. [Historical Data Requirements](#23-historical-data-requirements)
24. [Traceability Requirements](#24-traceability-requirements)
25. [Non-Functional Requirements](#25-non-functional-requirements)
26. [Known Gaps / Explicitly Deferred Features](#26-known-gaps--explicitly-deferred-features)

---

## 1. System Scope

MOVA (Mobile Operational & Vehicle/Zone Analytics) is a Decision Support System (DSS) for mobile coffee distribution operations. It manages:

- **Operational hub configuration** with geographic scope (city, radius, coordinates)
- **Rider workforce** lifecycle: invitation → first login → duty confirmation → zone assignment → field execution → sales recording → checkout
- **Fleet/armada management** with atomic 5-minute reservation holds and physical inspection checklists
- **Spatial zone management** with PostGIS polygon geometry and capacity constraints
- **POI ingestion pipeline** from OpenStreetMap Overpass API with 51 classified categories
- **Weather integration** from Open-Meteo API for risk scoring
- **Hybrid BWM-TOPSIS DSS engine** for zone ranking and rider distribution recommendations
- **Automated & manual rider-to-zone distribution** based on DSS rankings and zone capacity
- **Real-time GPS tracking** via Redis geospatial hashes and Socket.IO
- **Product sales POS** with server-side price enforcement
- **Executive dashboard & reporting** with SQL-based aggregations
- **Background job processing** via BullMQ workers and Bun native cron

| ID | Requirement |
|:---:|---|
| **SCOPE-001** | System must operate within a configurable geographic hub city with defined coordinates and operational radius |
| **SCOPE-002** | System must support multi-role access: SUPERADMIN, MANAGEMENT, SUPERVISOR, RIDER |
| **SCOPE-003** | All spatial operations must use PostGIS extensions (geometry, GiST indexes) |
| **SCOPE-004** | System must support real-time WebSocket communication for GPS tracking |
| **SCOPE-005** | System must process background jobs asynchronously via BullMQ queues |

---

## 2. Actors & Roles

| ID | Role | Description | Primary UI Screens |
|:---:|---|---|---|
| **ROLE-001** | `SUPERADMIN` | Full system control. Manages users, zones, fleet, DSS, products, cron, audit logs, data sync, system settings | All SuperAdmin pages, Setup Wizard |
| **ROLE-002** | `MANAGEMENT` | Business oversight. Views reports, dashboard, fleet, users. Cannot modify DSS or zones | Dashboard, Reports, User Management |
| **ROLE-003** | `SUPERVISOR` | Field operations manager. Manages distribution, manual overrides, fleet issues | Distribution, Monitoring Map, Reports |
| **ROLE-004** | `RIDER` | Mobile field operator. Confirms duty, claims armada, checks in, records sales, checks out | RiderDashboardPage |

### Role Permission Matrix

| Resource | SUPERADMIN | MANAGEMENT | SUPERVISOR | RIDER |
|---|:---:|:---:|:---:|:---:|
| System Settings / Setup | RW | R | — | — |
| User Management | RW | RW | — | — |
| Zone CRUD | RW | — | — | — |
| Fleet CRUD | RW | RW | — | — |
| Fleet Issues | RW | RW | RW | Report Only |
| DSS BWM Calibration | RW | R | R | — |
| DSS Evaluation | RW | — | RW | — |
| Distribution Overview | R | R | R | — |
| Distribution Execute | RW | — | RW | — |
| Duty Confirm | — | — | — | RW |
| Armada Hold/Claim | — | — | — | RW |
| Check-in/Checkout | — | — | — | RW |
| Record Sale | — | — | — | RW |
| Dashboard Stats | R | R | R | — |
| Reports | R | R | R | — |
| Audit Logs | R | — | — | — |
| Cron Management | RW | — | — | — |
| Data Sync | RW | — | — | — |
| Products | RW | RW | — | R (catalog) |
| Notifications | R | R | R | R |

---

## 3. Authentication Requirements

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **AUTH-001** | System must authenticate users via email + password with bcrypt hashing | P0 | `authRoutes.ts`, `LoginPage.svelte` |
| **AUTH-002** | System must issue JWT access tokens on successful login | P0 | `authController.ts` |
| **AUTH-003** | System must support refresh token rotation for session continuity | P0 | `POST /api/auth/refresh-token` |
| **AUTH-004** | System must invalidate refresh tokens on logout | P0 | `POST /api/auth/logout` |
| **AUTH-005** | System must track `first_login` flag and redirect to password setup | P0 | `FirstLoginPage.svelte`, `PATCH /api/users/me/complete-first-login` |
| **AUTH-006** | System must support invitation-based user creation with check-invitation flow | P1 | `POST /api/auth/check-invitation` |
| **AUTH-007** | System must support forgot-password flow with email reset tokens | P1 | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| **AUTH-008** | System must verify reset tokens before allowing password change | P1 | `GET /api/auth/verify-reset-token/:token` |
| **AUTH-009** | System must return authenticated user profile via `GET /api/auth/me` | P0 | `authRoutes.ts` |
| **AUTH-010** | System must enforce rate limiting on login, register, forgot-password, and refresh-token endpoints | P1 | `rateLimiterMiddleware.ts` |
| **AUTH-011** | System must support CAPTCHA generation for brute-force protection | P2 | `GET /api/auth/captcha` |
| **AUTH-012** | System must support Google OAuth login | P2 | `POST /api/auth/google` |
| **AUTH-013** | System must support risk-status check for account security | P2 | `GET /api/auth/risk-status` |

### State Machine: User Authentication Lifecycle

```
INVITED (created by admin, first_login=true)
  │
  ├─► CHECK_INVITATION (POST /api/auth/check-invitation)
  │     └─► REGISTER (POST /api/auth/register) ─► first_login=true
  │
  └─► LOGIN (POST /api/auth/login)
        │
        ├─► first_login=true ─► FIRST_LOGIN_SETUP (PATCH /api/users/me/complete-first-login)
        │     └─► first_login=false ─► ACTIVE
        │
        └─► first_login=false ─► ACTIVE
              │
              ├─► LOGOUT (POST /api/auth/logout) ─► Refresh token revoked
              └─► FORGOT_PASSWORD ─► RESET_PASSWORD ─► ACTIVE
```

### Acceptance Criteria

**AUTH-001:**
- Given: Valid email and password
- When: POST /api/auth/login
- Then: Returns `{ token, refreshToken, user: { id, role, first_login } }`

**AUTH-005:**
- Given: User with `first_login = true`
- When: PATCH /api/users/me/complete-first-login with `{ new_password }`
- Then: Password updated, `first_login` set to `false`, user redirected to main app

---

## 4. Onboarding & Operational Context

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **ONB-001** | System must provide a multi-step setup wizard for initial configuration | P0 | `systemRoutes.ts`, `SetupReviewStep.svelte` |
| **ONB-002** | System must persist hub city name (`HUB_CITY_NAME`) in `system_settings` | P0 | `OperationalContextService.ts` |
| **ONB-003** | System must persist central hub coordinates (`CENTRAL_HUB_LAT`, `CENTRAL_HUB_LNG`) | P0 | ADR-001 |
| **ONB-004** | System must persist operational radius (`OPERATIONAL_RADIUS_KM`) | P0 | ADR-001 |
| **ONB-005** | `OperationalContextService` must be the authoritative SSOT for geographic scope | P0 | ADR-001 |
| **ONB-006** | Missing hub configuration must return HTTP 422 with code `OPERATIONAL_SCOPE_NOT_CONFIGURED` | P0 | ADR-001 |
| **ONB-007** | System must never silently fallback to a default city name | P0 | ADR-001 |
| **ONB-008** | System must cache operational context for 60 seconds in-memory | P1 | `OperationalContextService.ts` |
| **ONB-009** | System must invalidate cache when setup configuration changes | P0 | `systemSettingController.ts` |
| **ONB-010** | System must provide setup-status endpoint to check initialization state | P0 | `GET /api/system/setup-status` |
| **ONB-011** | System must provide system readiness endpoint | P0 | `GET /api/system/readiness` |

### UI → API Traceability

| UI Screen | User Action | API Endpoint | Method | Requirement |
|---|---|---|:---:|:---:|
| SetupWizard Step 1 | Enter hub city & coordinates | `POST /api/system/setup-step` | POST | ONB-001, ONB-002, ONB-003 |
| SetupWizard Review | Apply system setup | `POST /api/system/apply-setup` | POST | ONB-001 |
| SuperAdminSettingsPage | View/update settings | `GET /api/system/settings` | GET | ONB-010, ONB-011 |
| SuperAdminSettingsPage | Update settings | `PUT /api/system/settings` | PUT | ONB-002, ONB-009 |

---

## 5. User Management

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **USER-001** | System must support CRUD operations on user accounts | P0 | `userRoutes.ts` |
| **USER-002** | Email and username must be unique across the system | P0 | Reconstruction Plan PART 02 |
| **USER-003** | Only SUPERADMIN and MANAGEMENT can create/view/delete users | P0 | `userRoutes.ts` role middleware |
| **USER-004** | System must support user profile view and self-update | P0 | `GET /api/users/profile`, `PUT /api/users/:id` |
| **USER-005** | System must support password change by authenticated user | P0 | `PUT /api/users/change-password` |
| **USER-006** | System must support admin-initiated password reset | P1 | `POST /api/users/:id/reset-password` |
| **USER-007** | System must support activate/deactivate user status | P0 | `PATCH /api/users/:id/status` |
| **USER-008** | System must support resending invitation email | P1 | `POST /api/users/:id/resend-invitation` |
| **USER-009** | System must support user preferences (map theme, notification, dashboard layout) | P2 | `GET /api/users/preferences`, `PUT /api/users/preferences` |
| **USER-010** | Inactive users (`is_active = false`) must be blocked from system access | P0 | Business rule |
| **USER-011** | System must support first-login password setup flow | P0 | `PATCH /api/users/me/complete-first-login` |

### Acceptance Criteria

**USER-002:**
- Given: A user with email `rider@mova.id` exists
- When: POST /api/users with same email
- Then: HTTP 409 Conflict returned

**USER-007:**
- Given: Active user with id X
- When: PATCH /api/users/X/status with `{ is_active: false }`
- Then: User deactivated, subsequent login attempts rejected with HTTP 403

---

## 6. Rider Operational State

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **RIDER-001** | Only users with `role = 'RIDER'` and `is_active = true` can enter duty queue | P0 | Reconstruction Plan PART 02 |
| **RIDER-002** | Rider must confirm daily readiness to enter the duty queue | P0 | `POST /api/distribution/duty-confirm` |
| **RIDER-003** | Rider readiness confirmation must be idempotent per duty date | P0 | PART 02 business rule |
| **RIDER-004** | System must provide rider's active session and assignment status | P0 | `GET /api/rider/active-session` |
| **RIDER-005** | Rider duty history must be queryable | P1 | `GET /api/distribution/my-history` |

### State Machine: Rider Duty Lifecycle

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
  IDLE ──► WAITING ──► PLOTTED ──► CHECKED_IN ──► COMPLETED  │
             │                       │                        │
             │                       └── (Checkout) ──────────┘
             │
             ├──► NO_SHOW (admin override)
             └──► CANCELLED (admin override)
```

| State | Trigger | Source Table | Business Rule |
|---|---|---|---|
| `WAITING` | Rider confirms readiness | `rider_duty_queues` | One entry per rider per duty_date |
| `PLOTTED` | Distribution assigns rider to zone | `zone_assignments` | Capacity constraint respected |
| `CHECKED_IN` | Rider GPS check-in within zone polygon | `zone_assignments` | PostGIS ST_Contains validation |
| `COMPLETED` | Rider checks out or shift ends | `zone_assignments` | Armada returned, timestamps recorded |
| `NO_SHOW` | Admin marks rider who didn't appear | `rider_duty_queues` | Manual override by SUPERVISOR+ |
| `CANCELLED` | Admin cancels rider's duty | `rider_duty_queues` | Manual override by SUPERVISOR+ |

> [!WARNING]
> **CONTRADICTION:** Frontend `riderService.ts` defines duty status as `"QUEUED" | "ASSIGNED" | "ACTIVE" | "COMPLETED" | "CANCELLED"` but backend `distributionService.ts` and reconstruction plan use `"WAITING" | "PLOTTED" | "CHECKED_IN" | "COMPLETED"`. **OPEN DECISION: Align on single enum set.**

### Acceptance Criteria

**RIDER-002:**
- Given: Rider has not confirmed readiness today
- When: POST /api/distribution/duty-confirm
- Then: One queue record created with status `WAITING`; second request does not create duplicate

**RIDER-004:**
- Given: Rider has active assignment today
- When: GET /api/rider/active-session
- Then: Returns `{ has_active_session: true, duty: { status, zone_id, zone_name, armada_id } }`

---

## 7. Fleet / Armada

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **FLEET-001** | System must maintain armada inventory with status tracking | P0 | `armadaRoutes.ts` |
| **FLEET-002** | Armada status enum: `ACTIVE`, `IN_USE`, `MAINTENANCE`, `RESERVED`, `RETIRED` | P0 | Reconstruction Plan PART 03 |
| **FLEET-003** | System must support 5-minute atomic reservation hold via Redis distributed lock | P0 | `armadaHoldWorker.ts` |
| **FLEET-004** | Concurrent reservations on same armada must result in exactly one winner (HTTP 409 for losers) | P0 | PART 03 |
| **FLEET-005** | Hold expiration must auto-release armada after 5 minutes | P0 | BullMQ `armadaHoldWorker` |
| **FLEET-006** | Claiming armada creates `fleet_assignments` and sets `armadas.current_rider_id` | P0 | PART 03 |
| **FLEET-007** | Rider can only hold one active armada reservation at any time | P0 | PART 03 |
| **FLEET-008** | Critical issue report must auto-transition armada to `MAINTENANCE` | P1 | PART 03 |
| **FLEET-009** | System must support armada issue reporting with severity levels | P1 | `POST /api/armadas/:id/report-issue` |
| **FLEET-010** | System must support armada issue resolution | P1 | `PUT /api/armadas/issues/:id/resolve` |
| **FLEET-011** | System must support armada assignment history | P1 | `GET /api/armadas/:id/history` |
| **FLEET-012** | Only SUPERADMIN and MANAGEMENT can create/update/delete armadas | P0 | `armadaRoutes.ts` |

### State Machine: Armada Lifecycle

```
  ACTIVE ──► HOLD (5-min Redis lock)
    │          │
    │          ├──► IN_USE (rider claimed) ──► ACTIVE (checkout return)
    │          │                                  │
    │          └──► ACTIVE (hold expired)         └──► MAINTENANCE (issue reported)
    │                                                      │
    │                                                      └──► ACTIVE (issue resolved)
    │
    └──► MAINTENANCE (direct issue report)
    │
    └──► RETIRED (admin decommission)
```

> [!WARNING]
> **CONTRADICTION:** Frontend `riderService.ts` uses armada status `"AVAILABLE" | "HOLD" | "IN_USE" | "MAINTENANCE"` but backend uses `"ACTIVE" | "IN_USE" | "MAINTENANCE" | "RESERVED" | "RETIRED"`. Frontend uses `AVAILABLE`, backend uses `ACTIVE`. Frontend lacks `RESERVED` and `RETIRED`. **OPEN DECISION: Align enum naming.**

### UI → API Traceability

| UI Screen | User Action | API Endpoint | Method | Requirement |
|---|---|---|:---:|:---:|
| Rider Dashboard | View hub armadas | `GET /api/rider/hub-armadas` | GET | FLEET-001 |
| Rider Dashboard | Hold armada (5min) | `POST /api/rider/hold-armada` | POST | FLEET-003 |
| Rider Dashboard | Cancel hold | `POST /api/rider/cancel-hold-armada` | POST | FLEET-003 |
| Rider Dashboard | Claim armada | `POST /api/rider/claim-armada` | POST | FLEET-006 |
| SuperAdmin Fleet | View all armadas | `GET /api/fleets` | GET | FLEET-001 |
| SuperAdmin Fleet | Create armada | `POST /api/fleets` | POST | FLEET-012 |
| SuperAdmin Fleet | Update armada | `PUT /api/fleets/:id` | PUT | FLEET-012 |
| SuperAdmin Fleet | Report issue | `POST /api/armadas/:id/report-issue` | POST | FLEET-009 |
| SuperAdmin Fleet | View issues | `GET /api/fleets/issues` | GET | FLEET-009 |
| SuperAdmin Fleet | Resolve issue | `PUT /api/fleets/issues/:id/resolve` | PUT | FLEET-010 |

---

## 8. Zone Management

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **ZONE-001** | System must support CRUD operations on operational zones | P0 | `zoneRoutes.ts` |
| **ZONE-002** | Zone polygon must be a valid GeoJSON Polygon (closed linear ring) | P0 | PART 04 |
| **ZONE-003** | Zone furthest vertex must not exceed `OPERATIONAL_RADIUS_KM` from central hub | P0 | ADR-001 |
| **ZONE-004** | Zone must have positive integer capacity ≥ 1 | P0 | PART 04 |
| **ZONE-005** | System must validate zone geometry before creation | P0 | `POST /api/zones/validate` |
| **ZONE-006** | System must provide zone configuration (hub coordinates, radius) | P0 | `GET /api/zones/config` |
| **ZONE-007** | Zone status management (active/inactive) | P1 | `PATCH /api/zones/:id/status` |
| **ZONE-008** | Zone capacity quick-update | P1 | `PATCH /api/zones/:id/capacity` |
| **ZONE-009** | Only SUPERADMIN can create/modify/delete zones | P0 | `zoneRoutes.ts` |

### Acceptance Criteria

**ZONE-003:**
- Given: Hub at coordinates (lat, lng) with radius 12km
- When: POST /api/zones/validate with polygon where furthest vertex is 15km from hub
- Then: Returns `{ is_within_radius: false, max_distance_km: 15, radius_limit_km: 12 }`

---

## 9. POI & Spatial Data Pipeline

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **POI-001** | System must ingest POI data from OpenStreetMap Overpass API | P0 | `SpatialETLPipelineService.ts` |
| **POI-002** | POI ingestion must run asynchronously via BullMQ background queue | P0 | `overpassWorker.ts` |
| **POI-003** | System must classify POIs into 51 active categories with Likert 1-5 crowd scores | P0 | ADR-002 |
| **POI-004** | System must provide POI categories listing with time-based crowd scores | P0 | `GET /api/poi-categories` |
| **POI-005** | All POI queries must use PostGIS GiST spatial index (`p.geom`) | P0 | ADR-004 |
| **POI-006** | POI dataset promotion must use compare-and-swap (CAS) atomic operations | P1 | PART 05 |
| **POI-007** | POIs with `operational_status = 'EXCLUDED'` must not count in DSS | P0 | PART 05 |
| **POI-008** | System must support data sync trigger, job status polling, version history, and rollback | P0 | `dataSyncRoutes.ts` |
| **POI-009** | Ingestion must be bounded by operational hub city from SSOT | P0 | ADR-001 |
| **POI-010** | System must provide POI listing with category and spatial filtering | P0 | `GET /api/pois` |

### UI → API Traceability

| UI Screen | User Action | API Endpoint | Method | Requirement |
|---|---|---|:---:|:---:|
| Settings Data Sync | Trigger POI sync | `POST /api/data-sync/trigger` | POST | POI-002, POI-008 |
| Settings Data Sync | Poll job status | `GET /api/data-sync/jobs/:jobId` | GET | POI-008 |
| Settings Data Sync | View versions | `GET /api/data-sync/versions/:datasetType` | GET | POI-008 |
| Settings Data Sync | Rollback version | `POST /api/data-sync/rollback` | POST | POI-008 |
| Monitoring Map | View POIs | `GET /api/pois` | GET | POI-010 |
| DSS Settings | View categories | `GET /api/poi-categories` | GET | POI-004 |

---

## 10. Weather

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **WEATHER-001** | System must fetch weather from Open-Meteo API for operational zones | P0 | `WeatherRepository.ts` |
| **WEATHER-002** | Weather observations must be append-only (no destructive DELETE) | P0 | ADR-003 |
| **WEATHER-003** | Latest weather must be retrieved via `ORDER BY updated_at DESC LIMIT 1` | P0 | ADR-003 |
| **WEATHER-004** | Cached weather valid for 60-minute TTL per zone | P1 | PART 06 |
| **WEATHER-005** | C4 Weather Risk score must be a Cost criterion (higher rain = higher cost) | P0 | PART 06 |
| **WEATHER-006** | System must provide hub-level weather information | P0 | `GET /api/weathers/hub` |
| **WEATHER-007** | System must provide zone-level weather data | P0 | `GET /api/weathers/zone/:zoneId` |

---

## 11. DSS — BWM + TOPSIS

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **DSS-001** | System must implement Best-Worst Method (BWM) for criteria weight calculation | P0 | `BwmWeightService.ts` |
| **DSS-002** | System must implement TOPSIS for zone ranking | P0 | `TopsisEngineService.ts` |
| **DSS-003** | BWM consistency ratio threshold must be < 0.20 | P0 | PART 07 |
| **DSS-004** | Sum of BWM weights must equal 1.00 ± 0.001 | P0 | PART 07 |
| **DSS-005** | TOPSIS score must be bounded between 0.0 and 1.0 | P0 | PART 07 |
| **DSS-006** | TOPSIS must handle zero-variance columns without division by zero | P0 | PART 07 |
| **DSS-007** | Full DSS evaluation snapshot must be persisted in `dss_histories` (JSONB) | P0 | PART 07 |
| **DSS-008** | System must support BWM weight preview/simulation without persistence | P1 | `POST /api/dss/bwm/preview-impact` |
| **DSS-009** | System must support BWM configuration versioning and activation | P0 | `POST /api/dss/bwm/:id/activate` |
| **DSS-010** | System must support raw criteria evaluation for individual zones | P1 | `GET /api/dss/zones/:id/raw-evaluation` |
| **DSS-011** | System must support TOPSIS recommendations (quick mode) | P1 | `GET /api/dss/recommendations` |
| **DSS-012** | System must support snapshot history browsing | P0 | `GET /api/dss/snapshots`, `GET /api/dss/snapshots/:id` |

### 6 Evaluation Criteria

| Code | Name | Type | Source |
|---|---|---|---|
| C1 | POI Density | Benefit | PostGIS GiST count within zone |
| C2 | POI Diversity | Benefit | Distinct active categories in zone |
| C3 | Time-based Crowd Score | Benefit | Likert weights by time slot |
| C4 | Weather Risk | Cost | Precipitation probability |
| C5 | Distance to Hub/Rider | Cost | Haversine formula |
| C6 | Competitor Threat Index | Cost | Survey + coffee shop POIs |

### UI → API Traceability

| UI Screen | User Action | API Endpoint | Method | Requirement |
|---|---|---|:---:|:---:|
| BwmCalibrationTab | Calculate weights | `POST /api/dss/bwm/calculate` | POST | DSS-001 |
| BwmCalibrationTab | Preview impact | `POST /api/dss/bwm/preview-impact` | POST | DSS-008 |
| BwmCalibrationTab | Activate config | `POST /api/dss/bwm/:id/activate` | POST | DSS-009 |
| BwmCalibrationTab | View configs | `GET /api/dss/bwm/configs` | GET | DSS-009 |
| SuperAdminDssPage | Run evaluation | `POST /api/dss/evaluate` | POST | DSS-002 |
| DssReportTab | View snapshots | `GET /api/dss/snapshots` | GET | DSS-012 |
| Dashboard | Quick recommendations | `GET /api/dss/recommendations` | GET | DSS-011 |

---

## 12. Distribution / Plotting

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **DIST-001** | System must provide distribution overview with waiting riders, zone capacities, and assignments | P0 | `GET /api/distribution/overview` |
| **DIST-002** | System must support automatic distribution based on TOPSIS rankings and capacity | P0 | `POST /api/distribution/auto` |
| **DIST-003** | System must support manual supervisor override for rider-to-zone assignment | P0 | `POST /api/distribution/manual` |
| **DIST-004** | Zone cannot be assigned beyond its `max_capacity` | P0 | PART 08 |
| **DIST-005** | Only riders with status `WAITING` can be distributed | P0 | PART 08 |
| **DIST-006** | Each rider can only have one active assignment per date | P0 | PART 08 |
| **DIST-007** | System must support distribution preview before confirmation | P0 | `GET /api/distribution/preview` |
| **DIST-008** | System must support distribution confirmation with proposed allocations | P0 | `POST /api/distribution/confirm` |
| **DIST-009** | Manual override must record override reason for DSS accuracy tracking | P1 | BLK-001 |
| **DIST-010** | System must support distribution run history | P1 | `GET /api/distribution/runs` |
| **DIST-011** | System must support rider duty status update by supervisors | P1 | `PUT /api/distribution/duty/:id/status` |

### Acceptance Criteria

**DIST-004:**
- Given: Zone A has max_capacity=3 and 3 riders already assigned
- When: POST /api/distribution/manual with rider_id=X, zone_id=A
- Then: HTTP 400/409 returned indicating zone at capacity

**DIST-006:**
- Given: Rider already has assignment for today
- When: System attempts to assign rider again
- Then: Duplicate assignment prevented (unique constraint)

---

## 13. Rider Execution / Check-in / Checkout / LBS

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **LBS-001** | Check-in must validate rider GPS coordinates inside assigned zone polygon via PostGIS | P0 | PART 09 |
| **LBS-002** | Check-in rejected with HTTP 400 if coordinates fall outside zone polygon | P0 | PART 09 |
| **LBS-003** | `check_in_time` must be recorded as immutable operational timestamp | P0 | PART 09 |
| **LBS-004** | Checkout must release armada back to `ACTIVE` or `MAINTENANCE` | P0 | PART 09 |
| **LBS-005** | `check_out_time` must be recorded as immutable operational timestamp | P0 | PART 09 |
| **LBS-006** | System must support real-time GPS tracking via Redis geospatial hash | P1 | `POST /api/lbs/track` |
| **LBS-007** | System must support nearby riders search | P1 | `GET /api/lbs/nearby` |
| **LBS-008** | System must support rider distance calculation | P2 | `GET /api/lbs/distance` |
| **LBS-009** | System must support individual rider location query | P1 | `GET /api/lbs/riders/:riderId` |
| **LBS-010** | Socket.IO must emit rider location updates for real-time dashboard | P1 | `lbsHandler.ts` |

### Acceptance Criteria

**LBS-001:**
- Given: Rider assigned to Zone A with polygon geometry
- When: POST /api/rider/check-in with coordinates inside Zone A
- Then: Assignment status updated to `CHECKED_IN`, `check_in_time` recorded

**LBS-002:**
- Given: Rider assigned to Zone A
- When: POST /api/rider/check-in with coordinates outside Zone A
- Then: HTTP 400 with message "Location outside assigned zone"

---

## 14. Sales / Transaction

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **SALES-001** | Rider must have active checked-in assignment to record sales | P0 | PART 10 |
| **SALES-002** | Server must calculate `total_price = quantity × product.price` (no client-side price) | P0 | PART 10 |
| **SALES-003** | Sales must be linked to `assignment_id` and `zone_id` | P0 | PART 10 |
| **SALES-004** | System must provide aggregated sales overview with product/zone/rider breakdowns | P0 | `GET /api/sales/overview` |
| **SALES-005** | Rider must be able to view personal sales history | P0 | `GET /api/sales/my-sales`, `GET /api/rider/my-sales` |
| **SALES-006** | Product price updates must not retroactively alter past `sales_logs` | P0 | PART 10 |
| **SALES-007** | System must support product catalog CRUD with image upload (WebP compression) | P0 | `productRoutes.ts` |
| **SALES-008** | Products must support active/inactive status toggle | P1 | `PATCH /api/products/:id/status` |
| **SALES-009** | Product deletion must be guarded if historical sales exist | P1 | `DELETE /api/products/:id` |

> [!NOTE]
> **DEFERRED:** `payment_method` field (`CASH`/`QRIS`) — Frontend `riderService.ts` sends `payment_method` but backend `sales_logs` table lacks this column. Documented as BLK-002. **DEFERRED as future enhancement.**

### UI → API Traceability

| UI Screen | User Action | API Endpoint | Method | Requirement |
|---|---|---|:---:|:---:|
| Rider POS | Record sale | `POST /api/rider/record-sale` | POST | SALES-001, SALES-002 |
| Rider POS | View my sales | `GET /api/rider/my-sales` | GET | SALES-005 |
| Sales Report | View overview | `GET /api/sales/overview` | GET | SALES-004 |
| Product Catalog | View products | `GET /api/products` | GET | SALES-007 |
| Product Catalog | Create product | `POST /api/products` | POST | SALES-007 |
| Product Catalog | Upload image | `POST /api/products/upload-image` | POST | SALES-007 |
| Supervisor | View product catalog | `GET /api/products` | GET | SALES-007 |

---

## 15. Dashboard

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **DASH-001** | Dashboard must display real-time KPIs from PostgreSQL aggregation (no mock data) | P0 | PART 11 |
| **DASH-002** | System must provide summary statistics (active riders, zones, fleet utilization, revenue) | P0 | `GET /api/dashboard/summary` |
| **DASH-003** | System must provide sales trend data | P0 | `GET /api/dashboard/sales-trend` |
| **DASH-004** | System must provide zone performance analytics | P0 | `GET /api/dashboard/zone-performance` |
| **DASH-005** | System must provide product performance analytics | P1 | `GET /api/dashboard/product-performance` |
| **DASH-006** | Data must be scoped to active operational hub | P0 | PART 11 |
| **DASH-007** | Empty database states must return zeros, not null crashes | P0 | PART 11 |

---

## 16. Reporting & Analytics

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **REPORT-001** | System must provide rider operational report | P0 | `GET /api/reports/riders` |
| **REPORT-002** | System must provide zone effectiveness report | P0 | `GET /api/reports/zones/effectiveness` |
| **REPORT-003** | System must provide fleet status and issue report | P0 | `GET /api/reports/fleet` |
| **REPORT-004** | System must provide DSS accuracy report (recommendation acceptance rate) | P0 | `GET /api/reports/dss/accuracy` |
| **REPORT-005** | System must provide executive summary with high-level KPIs | P0 | `GET /api/reports/executive-summary` |
| **REPORT-006** | All reports must support date range filtering (`start_date`, `end_date`) | P0 | Query params |
| **REPORT-007** | Reports restricted to SUPERADMIN, MANAGEMENT, SUPERVISOR | P0 | `reportRoutes.ts` |
| **REPORT-008** | All aggregations must be deterministic and verifiable against raw data | P0 | PART 12 |

---

## 17. Audit & Logging

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **AUDIT-001** | `audit_logs` table must be strictly append-only (no UPDATE/DELETE) | P0 | PART 13 |
| **AUDIT-002** | Security-critical actions must be logged with IP address and user-agent | P0 | PART 13 |
| **AUDIT-003** | Audit logs must be queryable by user_id, action, entity_type, status | P0 | `GET /api/audit-logs` |
| **AUDIT-004** | Audit log access restricted to SUPERADMIN only | P0 | `auditRoutes.ts` |

---

## 18. Background Jobs / Cron / Queue

| ID | Requirement | Priority | Source |
|:---:|---|:---:|---|
| **CRON-001** | System must run 4 BullMQ workers: overpass-sync, armada-hold, notification, dss-batch | P0 | `index.ts` imports |
| **CRON-002** | Cron jobs must acquire Redis distributed lock before execution to prevent duplicates | P0 | PART 13 |
| **CRON-003** | System must provide cron configuration viewing and toggling | P1 | `GET /api/cron-management/configs` |
| **CRON-004** | System must support manual cron trigger | P1 | `POST /api/cron-management/trigger/:cronKey` |
| **CRON-005** | System must provide cron execution logs | P1 | `GET /api/cron-management/logs` |
| **CRON-006** | Background workers must handle failures with retry backoff | P1 | PART 13 |
| **CRON-007** | In-app notifications must be delivered via BullMQ notification worker | P1 | `notificationWorker.ts` |
| **NOTIF-001** | System must support user notification listing | P1 | `GET /api/notifications` |
| **NOTIF-002** | System must support marking notifications as read (single and bulk) | P1 | `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all` |
| **NOTIF-003** | System must support notification deletion | P2 | `DELETE /api/notifications/:id` |

---

## 19. API Requirements

| ID | Requirement | Priority |
|:---:|---|:---:|
| **API-001** | All API endpoints must be prefixed with `/api/` | P0 |
| **API-002** | All protected endpoints must validate JWT via `authenticateToken` middleware | P0 |
| **API-003** | Role-based endpoints must enforce RBAC via `checkRole` middleware | P0 |
| **API-004** | API responses must use consistent JSON structure: `{ status, data/msg, error }` | P0 |
| **API-005** | Error responses must include `statusCode`, `code`, and `msg` fields | P0 |
| **API-006** | Global error handler must catch unhandled errors and return structured JSON | P0 |
| **API-007** | Rate limiting must be applied to `/api` prefix globally | P1 |
| **API-008** | HTTP compression (level 9) must be applied to responses > 512 bytes | P1 |

---

## 20. Database & Data Integrity Requirements

| ID | Requirement | Priority |
|:---:|---|:---:|
| **DATA-001** | PostgreSQL 16 with PostGIS, pgcrypto, uuid-ossp extensions | P0 |
| **DATA-002** | All primary keys must use UUID type | P0 |
| **DATA-003** | Spatial columns must use `geometry(Point, 4326)` or `geometry(Polygon, 4326)` with GiST indexes | P0 |
| **DATA-004** | `zone_assignments` must enforce unique rider-assignment-per-date constraint | P0 |
| **DATA-005** | `sales_logs.total_price` must be computed server-side, never from client input | P0 |
| **DATA-006** | Weather data must be append-only (HISTORICAL) | P0 |
| **DATA-007** | `audit_logs` must be append-only (HISTORICAL) | P0 |
| **DATA-008** | `dss_histories` must be append-only (HISTORICAL) | P0 |
| **DATA-009** | `distribution_runs` must be append-only (HISTORICAL) | P0 |
| **DATA-010** | `sales_logs` must be append-only (HISTORICAL) | P0 |
| **DATA-011** | `cron_logs` must be append-only (HISTORICAL) | P1 |

### Data Lifecycle Classification

| Table | Lifecycle | Immutable Fields | Notes |
|---|---|---|---|
| `users` | CURRENT STATE | `id`, `created_at` | Mutable: name, role, is_active, password |
| `system_settings` | CURRENT STATE | `key` | Value updated via setup wizard |
| `zones` | CURRENT STATE | `id`, `created_at` | Polygon and capacity mutable |
| `armadas` | CURRENT STATE | `id`, `created_at` | Status transitions tracked |
| `products` | CURRENT STATE | `id`, `created_at` | Price changes affect future sales only |
| `pois` | CURRENT STATE (versioned) | `id` | Promoted from staging via CAS |
| `poi_categories` | CURRENT STATE | `id` | 51 seeded categories |
| `rider_duty_queues` | DAILY STATE | `id`, `duty_date`, `rider_id` | One per rider per day |
| `zone_assignments` | HISTORICAL | `id`, `check_in_time`, `check_out_time`, `created_at` | Timestamps immutable once set |
| `sales_logs` | HISTORICAL / APPEND-ONLY | All | Never modified after creation |
| `weathers` | HISTORICAL / APPEND-ONLY | All | Never deleted, latest retrieved via ORDER BY |
| `audit_logs` | HISTORICAL / APPEND-ONLY | All | Strictly immutable |
| `dss_histories` | HISTORICAL / APPEND-ONLY | All | Full snapshots in JSONB |
| `distribution_runs` | HISTORICAL / APPEND-ONLY | All | Run metadata preserved |
| `fleet_assignments` | HISTORICAL | All | Assignment records |
| `fleet_issue_reports` | HISTORICAL | `id`, `created_at` | Resolution may update |
| `refresh_tokens` | SESSION | — | Deleted on logout/expiry |
| `notifications` | CURRENT STATE | `id`, `created_at` | `is_read` mutable |

---

## 21. Security Requirements

| ID | Requirement | Priority |
|:---:|---|:---:|
| **SEC-001** | Passwords must be hashed with bcrypt before storage | P0 |
| **SEC-002** | JWT tokens must have configurable expiry | P0 |
| **SEC-003** | Refresh tokens must support rotation and revocation | P0 |
| **SEC-004** | CORS must be configured with explicit allowed origins | P0 |
| **SEC-005** | Rate limiting must protect against brute-force attacks | P1 |
| **SEC-006** | Role-based access control must be enforced at route level | P0 |
| **SEC-007** | Cookie parser must be enabled for secure cookie handling | P1 |
| **SEC-008** | All state-altering API calls must be auditable | P1 |
| **SEC-009** | Response interceptor must handle 401/403 globally on frontend | P0 |

---

## 22. Performance Requirements

| ID | Requirement | Priority |
|:---:|---|:---:|
| **PERF-001** | Dashboard query execution time must be < 150ms | P1 |
| **PERF-002** | PostGIS spatial queries must use GiST index (no sequential scans) | P0 |
| **PERF-003** | HTTP response compression at level 9 for payloads > 512 bytes | P1 |
| **PERF-004** | Operational context cached for 60s to avoid repeated DB queries | P1 |
| **PERF-005** | Weather cached for 60min TTL per zone | P1 |
| **PERF-006** | Static files (GeoJSON, uploads) served with 1-day and 7-day Cache-Control | P2 |

---

## 23. Historical Data Requirements

| ID | Requirement | Priority |
|:---:|---|:---:|
| **HIST-001** | Weather observations must be retained for historical correlation reports | P0 |
| **HIST-002** | DSS evaluation snapshots must be retained for accuracy analysis | P0 |
| **HIST-003** | Sales logs must be retained for revenue analytics | P0 |
| **HIST-004** | Zone assignment history must be retained for rider performance reports | P0 |
| **HIST-005** | Distribution run records must be retained for operational audit | P0 |
| **HIST-006** | Audit logs must be retained indefinitely | P0 |

---

## 24. Traceability Requirements

| ID | Requirement | Priority |
|:---:|---|:---:|
| **TRACE-001** | Every sale must be traceable to: rider → assignment → zone → product | P0 |
| **TRACE-002** | Every zone assignment must be traceable to: distribution_run → DSS evaluation | P0 |
| **TRACE-003** | Manual overrides must record `original_zone_id` and `override_reason` | P1 |
| **TRACE-004** | DSS accuracy must be computable from auto vs manual assignment ratios | P0 |
| **TRACE-005** | Fleet issue reports must be traceable to reporting rider and resolving supervisor | P1 |

---

## 25. Non-Functional Requirements

| ID | Requirement | Priority |
|:---:|---|:---:|
| **NFR-001** | Backend must run on Bun 1.4 runtime | P0 |
| **NFR-002** | TypeScript strict mode with zero compilation errors | P0 |
| **NFR-003** | Clean Architecture: Controllers parse input → Services execute logic → Repositories execute SQL | P0 |
| **NFR-004** | WebSocket support via Socket.IO for real-time features | P1 |
| **NFR-005** | Redis required for distributed locks, BullMQ queues, and geospatial hashes | P0 |
| **NFR-006** | Swagger/OpenAPI documentation available at `/api/docs` | P2 |

---

## 26. Known Gaps / Explicitly Deferred Features

| ID | Description | Reason | Status |
|:---:|---|---|:---:|
| **DEF-001** | `payment_method` (CASH/QRIS) in `sales_logs` | Frontend sends it, backend table lacks column. Future enhancement per BLK-002 | `DEFERRED` |
| **DEF-002** | GPS breadcrumb trajectory persistence & odometer km | Live GPS in Redis only; DB accumulation not implemented per BLK-003 | `DEFERRED` |
| **DEF-003** | Supervisor manual override `original_zone_id` FK column | Currently saved in `zone_assignments.notes` as workaround per BLK-001 | `WORKAROUND` |
| **DEF-004** | Google OAuth full integration | Route exists (`POST /api/auth/google`) but flow unverified | `DEFERRED` |
| **DEF-005** | CAPTCHA integration | Route exists (`GET /api/auth/captcha`) but integration unverified | `DEFERRED` |
| **DEF-006** | Risk status check | Route exists (`GET /api/auth/risk-status`) but implementation unverified | `DEFERRED` |
| **DEF-007** | Candidate Selling Location feature | Routes exist but full requirement unspecified | `DEFERRED` |

### Contradictions

| ID | Description | Source A | Source B | Status |
|:---:|---|---|---|:---:|
| **CONTRA-001** | Rider duty status enum mismatch | Frontend: `QUEUED/ASSIGNED/ACTIVE/COMPLETED/CANCELLED` | Backend: `WAITING/PLOTTED/CHECKED_IN/COMPLETED` | `OPEN DECISION` |
| **CONTRA-002** | Armada status enum mismatch | Frontend: `AVAILABLE/HOLD/IN_USE/MAINTENANCE` | Backend: `ACTIVE/IN_USE/MAINTENANCE/RESERVED/RETIRED` | `OPEN DECISION` |
| **CONTRA-003** | Dual sales endpoint duplication | `GET /api/rider/my-sales` and `GET /api/sales/my-sales` both exist | Same data, different paths | `OPEN DECISION` |
| **CONTRA-004** | Dual fleet route mounting | `app.use("/api/armadas", armadaRoutes)` AND `app.use("/api/fleets", armadaRoutes)` | Same handler, two prefixes | `OPEN DECISION` |

---

## REQUIREMENT → PART MAPPING

| Requirement ID | Domain | PART | Priority | Dependencies | Status |
|:---:|---|:---:|:---:|---|:---:|
| SCOPE-001..005 | System Scope | 00 | P0 | — | BASELINE |
| ROLE-001..004 | Actors | 00 | P0 | — | BASELINE |
| AUTH-001..013 | Authentication | 01 | P0-P2 | PART 00 | BASELINE |
| ONB-001..011 | Onboarding | 01 | P0-P1 | PART 00 | BASELINE |
| USER-001..011 | User Management | 02 | P0-P2 | PART 01 | BASELINE |
| RIDER-001..005 | Rider State | 02 | P0-P1 | PART 01 | BASELINE |
| FLEET-001..012 | Fleet / Armada | 03 | P0-P1 | PART 01, 02 | BASELINE |
| ZONE-001..009 | Zone Management | 04 | P0-P1 | PART 01 | BASELINE |
| POI-001..010 | POI Pipeline | 05 | P0-P1 | PART 01, 04 | BASELINE |
| WEATHER-001..007 | Weather | 06 | P0-P1 | PART 01, 04 | BASELINE |
| DSS-001..012 | DSS BWM+TOPSIS | 07 | P0-P1 | PART 04, 05, 06 | BASELINE |
| DIST-001..011 | Distribution | 08 | P0-P1 | PART 02, 03, 07 | BASELINE |
| LBS-001..010 | Rider Execution | 09 | P0-P2 | PART 02, 03, 04, 08 | BASELINE |
| SALES-001..009 | Sales | 10 | P0-P1 | PART 09 | BASELINE |
| DASH-001..007 | Dashboard | 11 | P0-P1 | PART 02, 03, 09, 10 | BASELINE |
| REPORT-001..008 | Reporting | 12 | P0 | PART 02, 03, 07, 08, 09, 10 | BASELINE |
| AUDIT-001..004 | Audit | 13 | P0 | PART 01 | BASELINE |
| CRON-001..007, NOTIF-001..003 | Background Jobs | 13 | P0-P2 | PART 01, 02, 03, 05, 06, 08 | BASELINE |
| API-001..008 | API Standards | 14 | P0-P1 | PART 01..13 | BASELINE |
| DATA-001..011 | Data Integrity | 14 | P0-P1 | PART 01..13 | BASELINE |
| SEC-001..009 | Security | 14 | P0-P1 | PART 01..13 | BASELINE |
| PERF-001..006 | Performance | 14 | P0-P2 | PART 01..13 | BASELINE |
| HIST-001..006 | Historical Data | 14 | P0 | PART 06, 07, 10 | BASELINE |
| TRACE-001..005 | Traceability | 14 | P0-P1 | PART 08, 10, 12 | BASELINE |
| NFR-001..006 | Non-Functional | 15 | P0-P2 | All | BASELINE |
| DEF-001..007 | Deferred | — | — | — | DEFERRED |
| CONTRA-001..004 | Contradictions | — | — | — | OPEN DECISION |

---

## API CONTRACT BASELINE

### Category: EXISTING & VALID

| # | Method | Path | Role | Purpose | Req IDs |
|:---:|:---:|---|---|---|---|
| 1 | POST | `/api/auth/login` | Public | User login | AUTH-001, AUTH-002 |
| 2 | POST | `/api/auth/refresh-token` | Public | Token refresh | AUTH-003 |
| 3 | POST | `/api/auth/logout` | Public | Logout | AUTH-004 |
| 4 | GET | `/api/auth/me` | Authenticated | Get current user | AUTH-009 |
| 5 | POST | `/api/auth/register` | Public (rate-limited) | Register account | AUTH-006 |
| 6 | POST | `/api/auth/check-invitation` | Public (rate-limited) | Check invitation | AUTH-006 |
| 7 | POST | `/api/auth/forgot-password` | Public (rate-limited) | Forgot password | AUTH-007 |
| 8 | POST | `/api/auth/reset-password` | Public | Reset password | AUTH-007 |
| 9 | GET | `/api/auth/verify-reset-token/:token` | Public | Verify reset token | AUTH-008 |
| 10 | GET | `/api/system/readiness` | Authenticated | System readiness | ONB-011 |
| 11 | GET | `/api/system/settings` | Authenticated | Get settings | ONB-010 |
| 12 | PUT | `/api/system/settings` | SUPERADMIN, MANAGEMENT | Update settings | ONB-002, ONB-009 |
| 13 | GET | `/api/system/setup-status` | Authenticated | Check setup | ONB-010 |
| 14 | POST | `/api/system/setup-step` | SUPERADMIN | Save setup step | ONB-001 |
| 15 | POST | `/api/system/apply-setup` | SUPERADMIN | Apply setup | ONB-001 |
| 16 | GET | `/api/users` | SUPERADMIN, MANAGEMENT | List users | USER-001 |
| 17 | POST | `/api/users` | SUPERADMIN, MANAGEMENT | Create user | USER-001 |
| 18 | GET | `/api/users/profile` | Authenticated | Self profile | USER-004 |
| 19 | PUT | `/api/users/change-password` | Authenticated | Change password | USER-005 |
| 20 | PATCH | `/api/users/me/complete-first-login` | Authenticated | First login setup | USER-011, AUTH-005 |
| 21 | GET | `/api/users/:id` | SUPERADMIN, MANAGEMENT | User detail | USER-001 |
| 22 | PUT | `/api/users/:id` | Authenticated | Update user | USER-004 |
| 23 | PATCH | `/api/users/:id/status` | SUPERADMIN, MANAGEMENT | Activate/deactivate | USER-007 |
| 24 | DELETE | `/api/users/:id` | SUPERADMIN, MANAGEMENT | Delete user | USER-001 |
| 25 | POST | `/api/users/:id/reset-password` | SUPERADMIN, MANAGEMENT | Admin reset | USER-006 |
| 26 | POST | `/api/users/:id/resend-invitation` | SUPERADMIN, MANAGEMENT | Resend invite | USER-008 |
| 27 | GET | `/api/users/preferences` | Authenticated | Get preferences | USER-009 |
| 28 | PUT | `/api/users/preferences` | Authenticated | Set preferences | USER-009 |
| 29 | GET | `/api/fleets` | Authenticated | List armadas | FLEET-001 |
| 30 | GET | `/api/fleets/:id` | Authenticated | Armada detail | FLEET-001 |
| 31 | POST | `/api/fleets` | SUPERADMIN, MANAGEMENT | Create armada | FLEET-012 |
| 32 | PUT | `/api/fleets/:id` | SUPERADMIN, MANAGEMENT | Update armada | FLEET-012 |
| 33 | DELETE | `/api/fleets/:id` | SUPERADMIN, MANAGEMENT | Delete armada | FLEET-012 |
| 34 | GET | `/api/fleets/issues` | SUPERADMIN, MANAGEMENT, SUPERVISOR | List issues | FLEET-009 |
| 35 | PUT | `/api/fleets/issues/:id/resolve` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Resolve issue | FLEET-010 |
| 36 | POST | `/api/armadas/:id/report-issue` | Authenticated | Report issue | FLEET-009 |
| 37 | GET | `/api/armadas/:id/history` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Assignment history | FLEET-011 |
| 38 | GET | `/api/rider/active-session` | Authenticated | Active session | RIDER-004 |
| 39 | GET | `/api/rider/hub-armadas` | Authenticated | Hub armadas | FLEET-001 |
| 40 | POST | `/api/rider/hold-armada` | Authenticated | Hold armada | FLEET-003 |
| 41 | POST | `/api/rider/cancel-hold-armada` | Authenticated | Cancel hold | FLEET-003 |
| 42 | POST | `/api/rider/claim-armada` | Authenticated | Claim armada | FLEET-006 |
| 43 | POST | `/api/rider/check-in` | Authenticated | GPS check-in | LBS-001 |
| 44 | POST | `/api/rider/record-sale` | Authenticated | Record sale | SALES-001 |
| 45 | GET | `/api/rider/my-sales` | Authenticated | My sales | SALES-005 |
| 46 | POST | `/api/rider/checkout` | Authenticated | Checkout | LBS-004 |
| 47 | GET | `/api/zones` | Authenticated | List zones | ZONE-001 |
| 48 | GET | `/api/zones/config` | Authenticated | Zone config | ZONE-006 |
| 49 | GET | `/api/zones/:id` | Authenticated | Zone detail | ZONE-001 |
| 50 | POST | `/api/zones/validate` | Authenticated | Validate geometry | ZONE-005 |
| 51 | POST | `/api/zones` | SUPERADMIN | Create zone | ZONE-001 |
| 52 | PUT | `/api/zones/:id` | SUPERADMIN | Update zone | ZONE-001 |
| 53 | PATCH | `/api/zones/:id/status` | SUPERADMIN | Zone status | ZONE-007 |
| 54 | PATCH | `/api/zones/:id/capacity` | SUPERADMIN | Zone capacity | ZONE-008 |
| 55 | DELETE | `/api/zones/:id` | SUPERADMIN | Delete zone | ZONE-001 |
| 56 | GET | `/api/pois` | Authenticated | List POIs | POI-010 |
| 57 | GET | `/api/poi-categories` | Authenticated | POI categories | POI-004 |
| 58 | POST | `/api/data-sync/trigger` | SUPERADMIN | Trigger sync | POI-008 |
| 59 | GET | `/api/data-sync/jobs/:jobId` | SUPERADMIN | Job status | POI-008 |
| 60 | GET | `/api/data-sync/versions/:datasetType` | SUPERADMIN | Version history | POI-008 |
| 61 | POST | `/api/data-sync/rollback` | SUPERADMIN | Rollback version | POI-008 |
| 62 | GET | `/api/weathers/hub` | Authenticated | Hub weather | WEATHER-006 |
| 63 | GET | `/api/weathers/zone/:zoneId` | Authenticated | Zone weather | WEATHER-007 |
| 64 | POST | `/api/dss/bwm/calculate` | SUPERADMIN | BWM calculate | DSS-001 |
| 65 | POST | `/api/dss/bwm/preview-impact` | SUPERADMIN, SUPERVISOR, MANAGEMENT | Preview impact | DSS-008 |
| 66 | POST | `/api/dss/bwm/:id/activate` | SUPERADMIN | Activate config | DSS-009 |
| 67 | GET | `/api/dss/bwm/active` | SUPERADMIN, SUPERVISOR, MANAGEMENT | Active config | DSS-009 |
| 68 | GET | `/api/dss/bwm/configs` | SUPERADMIN, SUPERVISOR, MANAGEMENT | All configs | DSS-009 |
| 69 | GET | `/api/dss/zones/:id/raw-evaluation` | SUPERADMIN, SUPERVISOR | Raw eval | DSS-010 |
| 70 | POST | `/api/dss/evaluate` | SUPERADMIN, SUPERVISOR | Run evaluation | DSS-002 |
| 71 | GET | `/api/dss/snapshots` | SUPERADMIN, SUPERVISOR | Snapshots | DSS-012 |
| 72 | GET | `/api/dss/snapshots/:id` | SUPERADMIN, SUPERVISOR | Snapshot detail | DSS-012 |
| 73 | GET | `/api/dss/recommendations` | Authenticated | Quick recs | DSS-011 |
| 74 | POST | `/api/distribution/duty-confirm` | Authenticated | Confirm duty | RIDER-002 |
| 75 | GET | `/api/distribution/overview` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Overview | DIST-001 |
| 76 | GET | `/api/distribution/preview` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Preview | DIST-007 |
| 77 | POST | `/api/distribution/confirm` | SUPERADMIN, SUPERVISOR | Confirm dist | DIST-008 |
| 78 | POST | `/api/distribution/auto` | SUPERADMIN, SUPERVISOR | Auto distribute | DIST-002 |
| 79 | POST | `/api/distribution/manual` | SUPERADMIN, SUPERVISOR | Manual dist | DIST-003 |
| 80 | GET | `/api/distribution/runs` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Run history | DIST-010 |
| 81 | PUT | `/api/distribution/duty/:id/status` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Update duty status | DIST-011 |
| 82 | GET | `/api/distribution/my-history` | Authenticated | Rider history | RIDER-005 |
| 83 | POST | `/api/lbs/track` | Authenticated | Track GPS | LBS-006 |
| 84 | GET | `/api/lbs/nearby` | All Roles | Nearby riders | LBS-007 |
| 85 | GET | `/api/lbs/distance` | All Roles | Distance calc | LBS-008 |
| 86 | GET | `/api/lbs/riders/:riderId` | All Roles | Rider location | LBS-009 |
| 87 | GET | `/api/sales/overview` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Sales analytics | SALES-004 |
| 88 | GET | `/api/sales/my-sales` | Authenticated | My sales | SALES-005 |
| 89 | GET | `/api/products` | Authenticated | Product catalog | SALES-007 |
| 90 | GET | `/api/products/:id` | Authenticated | Product detail | SALES-007 |
| 91 | POST | `/api/products` | SUPERADMIN, MANAGEMENT | Create product | SALES-007 |
| 92 | PUT | `/api/products/:id` | SUPERADMIN, MANAGEMENT | Update product | SALES-007 |
| 93 | PATCH | `/api/products/:id/status` | SUPERADMIN, MANAGEMENT | Toggle status | SALES-008 |
| 94 | DELETE | `/api/products/:id` | SUPERADMIN, MANAGEMENT | Delete product | SALES-009 |
| 95 | POST | `/api/products/upload-image` | SUPERADMIN, MANAGEMENT | Upload image | SALES-007 |
| 96 | GET | `/api/dashboard/summary` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Summary KPIs | DASH-002 |
| 97 | GET | `/api/dashboard/sales-trend` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Sales trend | DASH-003 |
| 98 | GET | `/api/dashboard/zone-performance` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Zone perf | DASH-004 |
| 99 | GET | `/api/dashboard/product-performance` | SUPERADMIN, MANAGEMENT | Product perf | DASH-005 |
| 100 | GET | `/api/reports/riders` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Rider report | REPORT-001 |
| 101 | GET | `/api/reports/zones/effectiveness` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Zone report | REPORT-002 |
| 102 | GET | `/api/reports/fleet` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Fleet report | REPORT-003 |
| 103 | GET | `/api/reports/dss/accuracy` | SUPERADMIN, MANAGEMENT, SUPERVISOR | DSS accuracy | REPORT-004 |
| 104 | GET | `/api/reports/executive-summary` | SUPERADMIN, MANAGEMENT, SUPERVISOR | Executive | REPORT-005 |
| 105 | GET | `/api/audit-logs` | SUPERADMIN | Audit logs | AUDIT-003 |
| 106 | GET | `/api/cron-management/configs` | SUPERADMIN | Cron configs | CRON-003 |
| 107 | GET | `/api/cron-management/logs` | SUPERADMIN | Cron logs | CRON-005 |
| 108 | PUT | `/api/cron-management/toggle/:cronKey` | SUPERADMIN | Toggle cron | CRON-003 |
| 109 | POST | `/api/cron-management/trigger/:cronKey` | SUPERADMIN | Trigger cron | CRON-004 |
| 110 | GET | `/api/notifications` | Authenticated | List notifs | NOTIF-001 |
| 111 | PATCH | `/api/notifications/read-all` | Authenticated | Mark all read | NOTIF-002 |
| 112 | PATCH | `/api/notifications/:id/read` | Authenticated | Mark read | NOTIF-002 |
| 113 | DELETE | `/api/notifications/:id` | Authenticated | Delete notif | NOTIF-003 |
| 114 | GET | `/api/health` | Public | Health check | NFR-006 |

### Category: EXISTING BUT INCOMPLETE

| # | Method | Path | Issue | Req IDs |
|:---:|:---:|---|---|---|
| 1 | POST | `/api/rider/record-sale` | Backend does not accept `payment_method` from frontend | SALES-001, DEF-001 |
| 2 | POST | `/api/distribution/manual` | Does not persist `original_zone_id` FK; uses notes field | DIST-009, DEF-003 |

### Category: CONTRADICTORY

| # | Issue | Details |
|:---:|---|---|
| 1 | Duplicate sales endpoint | `GET /api/rider/my-sales` AND `GET /api/sales/my-sales` — CONTRA-003 |
| 2 | Duplicate fleet route mounting | `/api/armadas` AND `/api/fleets` point to same handler — CONTRA-004 |

### Category: DEFERRED

| # | Method | Path | Reason |
|:---:|:---:|---|---|
| 1 | POST | `/api/auth/google` | Google OAuth — DEF-004 |
| 2 | GET | `/api/auth/captcha` | CAPTCHA — DEF-005 |
| 3 | GET | `/api/auth/risk-status` | Risk check — DEF-006 |

---

*End of MOVA Backend Requirements SSOT*
