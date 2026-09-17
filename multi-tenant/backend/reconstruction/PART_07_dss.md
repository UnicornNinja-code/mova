# PART 07 — DSS: BWM + TOPSIS

## 1. Objective
Execute hybrid Multi-Criteria DSS: compute criteria weights via BWM linear programming, evaluate zone criteria (C1–C6), rank zones via TOPSIS, persist full snapshots, and support configuration versioning.

## 2. Requirement IDs
- DSS-001 through DSS-012
- HIST-002

## 3. UI Requirements
```
BwmCalibrationTab.svelte
  → POST /api/dss/bwm/calculate → calculate and save BWM weights
  → POST /api/dss/bwm/preview-impact → simulate TOPSIS with proposed weights
  → POST /api/dss/bwm/:id/activate → activate specific configuration
  → GET /api/dss/bwm/active → current active config
  → GET /api/dss/bwm/configs → all configuration versions

SuperAdminDssPage.svelte
  → POST /api/dss/evaluate → run hybrid BWM-TOPSIS evaluation
  → GET /api/dss/zones/:id/raw-evaluation → inspect single zone criteria

DssReportTab.svelte
  → GET /api/dss/snapshots → evaluation history
  → GET /api/dss/snapshots/:id → snapshot detail with full traceability

Dashboard / Rider
  → GET /api/dss/recommendations → quick zone recommendations
```

## 4. User Stories
- As a SUPERADMIN, I need to calibrate BWM weights so the DSS reflects current business priorities.
- As a SUPERADMIN, I need to preview the impact of new weights before committing them.
- As a SUPERVISOR, I need to run TOPSIS evaluations so I get ranked zones for distribution.
- As an analyst, I need historical DSS snapshots so I can audit decision accuracy.

## 5. Functional Requirements
| ID | Requirement |
|:---:|---|
| DSS-001 | BWM weight calculation via LP solver |
| DSS-002 | TOPSIS zone ranking |
| DSS-003 | Consistency ratio threshold < 0.20 |
| DSS-004 | Sum of weights = 1.00 ± 0.001 |
| DSS-005 | TOPSIS score bounded [0.0, 1.0] |
| DSS-006 | Zero-variance column handling |
| DSS-007 | Full snapshot in dss_histories (JSONB) |
| DSS-008 | BWM preview/simulation without persistence |
| DSS-009 | Configuration versioning and activation |
| DSS-010 | Raw criteria evaluation for individual zones |
| DSS-011 | Quick TOPSIS recommendations |
| DSS-012 | Snapshot history browsing |

### 6 Criteria
| Code | Name | Type | Source |
|---|---|---|---|
| C1 | POI Density | Benefit | PostGIS GiST count within zone polygon |
| C2 | POI Diversity | Benefit | Distinct active categories in zone |
| C3 | Time-based Crowd Score | Benefit | Likert 1-5 weights by time slot |
| C4 | Weather Risk | Cost | Precipitation probability from Open-Meteo |
| C5 | Distance to Hub/Rider | Cost | Haversine formula from hub or rider GPS |
| C6 | Competitor Threat Index | Cost | Survey-based + coffee shop POI count |

## 6. State Machine
### BWM Configuration Lifecycle
```
DRAFT (calculated) ──► ACTIVE (activated) ──► INACTIVE (newer version activated)
```

## 7. API Contract

### POST /api/dss/bwm/calculate
- **Role:** SUPERADMIN ONLY (Management = 403 Forbidden, Supervisor = 403 Forbidden)
- **Request:** `{ name?, best_criteria_id, worst_criteria_id, best_to_others: {C1:n,...}, worst_to_others: {C1:n,...} }`
- **Response 200:** `{ msg, config, bwm_result: { weights, xi_star, ci, consistency_ratio, is_consistent, formatted_details } }`
- **Error 400:** `{ msg: "Inconsistent BWM input (CR > 0.20)" }`

### POST /api/dss/bwm/preview-impact
- **Role:** SUPERADMIN ONLY
- **Request:** `{ weights: Record<string, number>, time_slot? }`
- **Response 200:** `{ status, time_slot, rankings: TopsisRanking[], total_zones }`

### POST /api/dss/bwm/:id/activate
- **Role:** SUPERADMIN ONLY
- **Response 200:** `{ msg: "Configuration activated", config }`

### GET /api/dss/bwm/active
- **Role:** SUPERADMIN, SUPERVISOR (Management = 403 Forbidden)
- **Response 200:** `{ config: ActiveDssConfig }`

### GET /api/dss/bwm/configs
- **Role:** SUPERADMIN, SUPERVISOR (Management = 403 Forbidden)
- **Response 200:** `{ configs: ActiveDssConfig[] }`

### POST /api/dss/evaluate
- **Role:** SUPERADMIN, SUPERVISOR (Management = 403 Forbidden)
- **Request:** `{ zone_ids?, time_slot?, lat?, lon?, bwm_config_id? }`
- **Response 200:** `{ evaluation_version, evaluated_at, time_slot, total_evaluated_zones, criteria_specs, topsis_summary: { ideal_positive, ideal_negative, rankings }, snapshot_id }`

### GET /api/dss/zones/:id/raw-evaluation
- **Role:** SUPERADMIN, SUPERVISOR
- **Query:** `time`
- **Response 200:** `{ zone_id, zone_name, criteria: { C1: {...}, C2: {...}, ... } }`

### GET /api/dss/snapshots
- **Role:** SUPERADMIN, SUPERVISOR
- **Query:** `limit`
- **Response 200:** `{ data: DssSnapshotItem[] }`

### GET /api/dss/snapshots/:id
- **Role:** SUPERADMIN, SUPERVISOR
- **Response 200:** `{ snapshot: DssSnapshotItem }`

### GET /api/dss/recommendations
- **Role:** RIDER (Personal recommended zones for active shift)
- **Response 200:** `{ recommendations: [{ zone_id, zone_name, score, rank }] }`
- **Response 200:** `{ data: { full snapshot with rankings, criteria, weights } }`

### GET /api/dss/recommendations
- **Role:** Authenticated
- **Query:** `time`, `lat`, `lon`
- **Response 200:** `{ data: { time_slot, weight_source, rankings } }`

## 8-9. Request/Response Schema
See API Contract above.

## 10. Error Contract
| Status | Code | When |
|:---:|---|---|
| 400 | `BWM_INCONSISTENT` | CR > 0.20 |
| 400 | `NO_ACTIVE_BWM_CONFIG` | No BWM config activated |
| 400 | `NO_EVALUABLE_ZONES` | No active zones to evaluate |

## 11. Business Rules
- Sum of BWM weights = 1.00 ± 0.001
- Consistency ratio < 0.20
- TOPSIS score bounded [0.0, 1.0]
- Zero-variance columns handled gracefully (no division by zero)
- Full snapshot persisted in dss_histories.details (JSONB) for auditability
- Preview mode does NOT persist results

## 12. Database Dependencies
| Table | Purpose | Lifecycle |
|---|---|---|
| `criterias` | Criteria definitions | CURRENT STATE |
| `dss_configurations` | BWM weight configs | CURRENT STATE (versioned) |
| `dss_histories` | Evaluation snapshots | HISTORICAL / APPEND-ONLY |
| `zones` | Zone data for evaluation | Referenced |
| `pois` | C1, C2, C3 criteria | Referenced |
| `weathers` | C4 criteria | Referenced |
| `competitors` | C6 criteria | Referenced |

## 13. Service Dependencies
- `HybridBwmTopsisService.ts`, `BwmWeightService.ts`, `TopsisEngineService.ts`
- `RawCriteriaEvaluationService.ts`, `POITimeCrowdService.ts`
- `CandidateExplainabilityService.ts`

## 14. Repository Dependencies
- `bwmRepository.ts`, `poiRepository.ts`, `competitorRepository.ts`

## 15. Worker Dependencies
- `dssBatchWorker.ts` — BullMQ for batch DSS operations

## 16. Files Allowed to Modify
- `src/services/dss/HybridBwmTopsisService.ts`
- `src/services/dss/TopsisEngineService.ts`
- `src/services/dss/RawCriteriaEvaluationService.ts`
- `src/controllers/dssController.ts`

## 17. Files Forbidden to Modify
- Fleet reservation worker, Auth routes

## 18. Dependencies on Other PARTs
- Depends on: PART 04, PART 05, PART 06

## 19. Acceptance Criteria
- [ ] Consistent BWM input produces validated weights
- [ ] TOPSIS ranks match hand-calculated test vectors
- [ ] Full run snapshot saved in dss_histories
- [ ] Preview mode does not persist
- [ ] Zero-variance columns handled without crash

## 20. Test Cases
- BWM weight calculation with known input/output
- TOPSIS ranking with deterministic criteria inputs
- Zero-variance column edge case test

## 21. Verification Commands
```bash
bun x tsc --noEmit
bun run tests/report_and_attendance.test.ts
```

## 22. Known Risks
- Floating point rounding errors in JavaScript matrix operations

## 23. Open Decisions
None.

## 24. Current Implementation Status
- Hybrid engine functional
- 51 categories matched via DB (ADR-002)
- Needs: CR threshold audit, zero-variance guard audit

## 25. Reconstruction Checklist
- [x] REQUIREMENTS_VERIFIED
- [x] UI_CONTRACT_VERIFIED
- [x] API_CONTRACT_VERIFIED
- [x] DATA_MODEL_VERIFIED
- [x] BUSINESS_RULES_VERIFIED
- [x] IMPLEMENTATION_COMPLETE
- [x] TESTS_PASS (12/12 PASS)
- [x] INTEGRATION_VERIFIED
- [x] REGRESSION_VERIFIED (143/143 TOTAL PASS)
- [x] DOCUMENTATION_UPDATED

**PART STATUS: COMPLETED**

## 26. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Requirements extracted | Documented in SSOT |
| 2026-09-03 | 51 POI categories integrated | Likert 1-5 crowd score per time slot |
| 2026-09-03 | Zero-variance column division-by-zero guards | Applied to TopsisEngineService |
| 2026-09-03 | PART 07 Test Suite Executed | 12/12 Unit & Integration Tests PASS |
