# PART 12 — REPORTING & DECISION INTELLIGENCE ANALYTICS

## 1. Objective
Provide official operational, DSS validation, business revenue, and system governance reports via server-side SQL aggregations across 4 core analytical pillars, including empirical DSS impact analysis (Auto/Accepted vs Manual Override).

## 2. Requirement IDs
- REPORT-001 through REPORT-012
- HIST-002 through HIST-006
- TRACE-004, TRACE-005
- BLK-001 (Resolved: explicit tracking columns for DSS overrides)

## 3. UI Requirements
SuperAdminReportsPage.svelte (4 Core Analytical Pillars):
- Pillar 1 (Operations):
  → GET /api/reports/riders/performance
  → GET /api/reports/zones/effectiveness
  → GET /api/reports/fleet/lifecycle
- Pillar 2 (DSS & Intelligence):
  → GET /api/reports/dss/accuracy
  → GET /api/reports/dss/impact-analysis
  → GET /api/dss/snapshots (from PART 07)
  → GET /api/dss/bwm/configs (from PART 07)
- Pillar 3 (Business & Revenue):
  → GET /api/reports/executive-summary
  → GET /api/sales/overview (from PART 10)
- Pillar 4 (System & Audit):
  → GET /api/reports/system/sync-history
  → GET /api/audit-logs (from PART 13)

## 4. User Stories
- As a RESEARCHER/STUDENT, I need DSS impact and accuracy reports so I can empirically prove the effectiveness of the hybrid BWM-TOPSIS recommendation model.
- As a MANAGEMENT USER, I need executive summaries and revenue breakdowns so I can make data-driven expansion decisions.
- As a SUPERVISOR, I need rider punctuality, zone conversion, and fleet lifecycle reports so I can optimize shift operations.

## 5. Functional Requirements
| ID | Requirement |
|:---:|---|
| REPORT-001 | Rider operational performance report (shifts, punctuality/delay, favorite zones) |
| REPORT-002 | Zone conversion funnel (Recommended vs Assigned vs Executed with sales) |
| REPORT-003 | Fleet lifecycle & maintenance downtime report |
| REPORT-004 | DSS Recommendation Accuracy (Acceptance rate vs Override rate) |
| REPORT-005 | DSS Impact Analysis (Revenue & efficiency comparison: Auto vs Manual Override) |
| REPORT-006 | Executive summary macro KPIs |
| REPORT-007 | External data synchronization audit report (Overpass POI & Open-Meteo) |
| REPORT-008 | Deterministic multi-table SQL aggregations via Repository layer |
| REPORT-009 | Server-side pagination with global footer summary aggregates |
| REPORT-010 | Direct CSV streaming export (`export=csv`) |
| REPORT-011 | Role restriction: SUPERADMIN, MANAGEMENT, SUPERVISOR |
| REPORT-012 | Strict date-range validation (`start_date <= end_date`) |

## 6. State Machine
N/A

## 7. API Contract

### GET /api/reports/riders/performance
- **Role:** SUPERADMIN, MANAGEMENT, SUPERVISOR
- **Query:** `start_date`, `end_date`, `rider_id?`, `page?`, `limit?`, `export?` ("csv")
- **Response 200 (JSON):**
```json
{
  "success": true,
  "message": "Rider performance report retrieved",
  "data": [
    {
      "rider_id": "uuid",
      "rider_name": "Budi Santoso",
      "total_shifts": 12,
      "total_check_ins": 12,
      "avg_check_in_delay_minutes": 4.5,
      "total_sales_units": 184,
      "total_revenue": 3312000,
      "avg_shift_duration_hours": 7.2,
      "favorite_zone_name": "Zone Central Core"
    }
  ],
  "summary_totals": {
    "total_shifts_all": 140,
    "total_revenue_all": 38500000,
    "avg_delay_minutes_overall": 6.1
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_records": 15,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

### GET /api/reports/zones/effectiveness
- **Role:** SUPERADMIN, MANAGEMENT, SUPERVISOR
- **Query:** `start_date`, `end_date`, `zone_id?`
- **Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "zone_id": "uuid",
      "zone_name": "Zone Central Core",
      "recommended_by_dss_count": 28,
      "assigned_by_supervisor_count": 25,
      "executed_shifts_count": 25,
      "total_revenue": 14200000,
      "avg_revenue_per_assignment": 568000,
      "conversion_rate_pct": 89.2
    }
  ]
}
```

### GET /api/reports/dss/accuracy
- **Role:** SUPERADMIN, MANAGEMENT, SUPERVISOR
- **Query:** `start_date`, `end_date`
- **Response 200:**
```json
{
  "success": true,
  "data": {
    "total_recommendations": 120,
    "auto_accepted_count": 98,
    "manual_override_count": 22,
    "acceptance_rate_percent": 81.67,
    "override_rate_percent": 18.33,
    "top_override_reasons": [
      { "reason": "Cuaca mendung mendadak", "count": 10 },
      { "reason": "Armada maintenance lokal", "count": 6 },
      { "reason": "Permintaan khusus supervisor", "count": 6 }
    ]
  }
}
```

### GET /api/reports/dss/impact-analysis
- **Role:** SUPERADMIN, MANAGEMENT, SUPERVISOR
- **Query:** `start_date`, `end_date`
- **Response 200:**
```json
{
  "success": true,
  "data": {
    "evaluation_period": { "start": "2026-08-01", "end": "2026-08-31" },
    "comparison": {
      "accepted_recommendations": {
        "assignments_count": 98,
        "total_revenue": 44100000,
        "avg_revenue_per_shift": 450000,
        "avg_check_in_compliance_pct": 95.2
      },
      "manual_overrides": {
        "assignments_count": 22,
        "total_revenue": 8360000,
        "avg_revenue_per_shift": 380000,
        "avg_check_in_compliance_pct": 86.4
      },
      "impact_metrics": {
        "revenue_lift_percent": 18.42,
        "compliance_lift_percent": 8.8,
        "p_value_significance": 0.024
      }
    }
  }
}
```

### GET /api/reports/fleet/lifecycle
- **Role:** SUPERADMIN, MANAGEMENT, SUPERVISOR
- **Query:** `start_date`, `end_date`
- **Response 200:**
```json
{
  "success": true,
  "data": {
    "summary": { "total_armadas": 20, "active": 16, "in_use": 3, "maintenance": 1 },
    "maintenance_stats": [
      {
        "armada_code": "ARM-004",
        "total_issues_reported": 4,
        "total_downtime_days": 3,
        "current_status": "MAINTENANCE"
      }
    ]
  }
}
```

### GET /api/reports/system/sync-history
- **Role:** SUPERADMIN
- **Query:** `dataset_type?` ("poi" | "weather")
- **Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "job_id": "sync-102",
      "dataset_type": "poi",
      "status": "COMPLETED",
      "records_fetched": 452,
      "records_deduplicated": 18,
      "duration_seconds": 14.2,
      "executed_at": "2026-09-02T03:00:00.000Z"
    }
  ]
}
```

### GET /api/reports/executive-summary
- **Role:** SUPERADMIN, MANAGEMENT, SUPERVISOR
- **Response 200:**
```json
{
  "success": true,
  "data": {
    "kpis": {
      "total_revenue": 1850000,
      "active_riders": 12,
      "active_zones": 8,
      "fleet_utilization": 75.0,
      "dss_accuracy": 81.67,
      "dss_revenue_lift_pct": 18.42
    }
  }
}
```

## 8-9. Request/Response Schema
See API Contract above.

## 10. Error Contract
| Status | Code | When |
|:---:|---|---|
| 400 | `INVALID_DATE_RANGE` | start_date > end_date |
| 422 | `UNSUPPORTED_EXPORT_FORMAT` | Query export selain "csv" |

## 11. Business Rules
- **Purity of Architecture:** Strict Clean Architecture enforced. Controllers parse queries, Service layer computes derived formulas/deltas, and `ReportRepository.ts` executes all multi-table SQL queries.
- **BLK-001 Resolved:** `zone_assignments` and `distribution_run_items` must store `recommended_zone_id UUID`, `actual_zone_id UUID`, `is_override BOOLEAN`, and `override_reason VARCHAR(255)`.
- **Streaming Export:** `export=csv` queries bypass standard JSON wrapper and return raw stream with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment`.

## 12. Database Dependencies
- `zone_assignments` (duty, timestamps, override tracking)
- `sales_logs` (revenue aggregations)
- `armadas` & `fleet_issue_reports` (lifecycle & downtime)
- `distribution_runs` & `distribution_run_items` (accuracy baseline)
- `dataset_sync_jobs` (sync telemetry)
- `zones` & `users`

## 13. Service Dependencies
- `ReportService.ts`

## 14. Repository Dependencies
- `reportRepository.ts`

## 15. Worker Dependencies
None.

## 16. Files Allowed to Modify
- `src/services/reportService.ts`
- `src/controllers/reportController.ts`
- `src/repositories/reportRepository.ts`
- `src/routes/reportRoutes.ts`

## 17. Files Forbidden to Modify
- Auth routes, PostGIS ingestion worker, TOPSIS LP solver.

## 18. Dependencies on Other PARTs
- Depends on: PART 02, PART 03, PART 07, PART 08, PART 09, PART 10

## 19. Acceptance Criteria
- [ ] All analytical endpoints return HTTP 200 with Global Success Envelope.
- [ ] DSS impact calculation correctly segments Auto vs Override assignments.
- [ ] Exporting CSV streams directly with correct MIME type.
- [ ] Date filtering properly scopes all multi-table SQL aggregations.

## 20. Test Cases
- Rider performance aggregation test (including delay calculation)
- DSS accuracy and impact analysis calculation test
- CSV streaming export integration test
- Date range guard test (`start_date > end_date`)

## 21. Verification Commands
```bash
bun x tsc --noEmit
bun run tests/report_and_attendance.test.ts
```

## 22. Known Risks
- Heavy aggregations on massive date spans without composite indexing.

## 23. Open Decisions
None (BLK-001 resolved).

## 24. Current Implementation Status
Ready for reconstruction update.

## 25. Reconstruction Checklist
- [x] REQUIREMENTS_VERIFIED
- [x] UI_CONTRACT_VERIFIED
- [x] API_CONTRACT_VERIFIED
- [x] DATA_MODEL_VERIFIED
- [x] BUSINESS_RULES_VERIFIED
- [x] IMPLEMENTATION_COMPLETE
- [x] TESTS_PASS (20/20 PASS)
- [x] INTEGRATION_VERIFIED
- [x] REGRESSION_VERIFIED (228/228 TOTAL PASS)
- [x] DOCUMENTATION_UPDATED

**PART STATUS: COMPLETED**

## 26. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Requirements extracted | Documented in SSOT |
| 2026-09-03 | Reporting Routes & Controller Verified | 5 domain reporting endpoints active |
| 2026-09-03 | PART 12 Test Suite Executed | 20/20 Unit & Integration Tests PASS |
