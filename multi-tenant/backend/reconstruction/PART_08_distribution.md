# PART 08 — DISTRIBUTION / PLOTTING

## 1. Objective
Execute automated and manual rider-to-zone distribution based on DSS rankings, zone capacity constraints, and support supervisor overrides with audit traceability.

## 2. Requirement IDs
- DIST-001 through DIST-011
- TRACE-002, TRACE-003

## 3. UI Requirements
```
SuperAdminDistributionPage.svelte
  → GET /api/distribution/overview → waiting riders, zone capacities, current assignments
  → GET /api/distribution/preview → proposed allocations before confirmation
  → POST /api/distribution/confirm → confirm proposed allocations
  → POST /api/distribution/auto → auto-distribute all waiting riders
  → POST /api/distribution/manual → manually assign specific rider to zone
  → GET /api/distribution/runs → distribution run history

Distribution Duty Management
  → PUT /api/distribution/duty/:id/status → mark rider as NO_SHOW, CANCELLED
```

## 4. User Stories
- As a SUPERVISOR, I need to see which riders are waiting and which zones have capacity.
- As a SUPERVISOR, I need to preview auto-distribution before confirming.
- As a SUPERVISOR, I need to manually override rider assignments when operational judgment requires it.
- As a SUPERADMIN, I need distribution run history to audit operational decisions.

## 5. Functional Requirements
| ID | Requirement |
|:---:|---|
| DIST-001 | Overview: waiting riders, zone capacities, assignments |
| DIST-002 | Auto-distribution based on TOPSIS rankings |
| DIST-003 | Manual supervisor override |
| DIST-004 | Zone capacity constraint (max_capacity) |
| DIST-005 | Only WAITING riders can be distributed |
| DIST-006 | Unique rider assignment per date |
| DIST-007 | Distribution preview before confirmation |
| DIST-008 | Distribution confirmation with allocations |
| DIST-009 | Override reason recording for DSS accuracy |
| DIST-010 | Distribution run history |
| DIST-011 | Rider duty status update by supervisors |

## 6. State Machine
### Distribution Flow
```
TOPSIS Evaluation ──► PROPOSED ALLOCATIONS (Preview)
                         │
                         ├──► CONFIRMED (Auto/Manual)
                         │       │
                         │       └──► zone_assignments created (ASSIGNED)
                         │       └──► rider_duty_queues updated (PLOTTED)
                         │
                         └──► REJECTED (user discards preview)

Manual Override:
  WAITING rider + target zone ──► ASSIGNED (with override notes)
```

## 7. API Contract

### GET /api/distribution/overview
- **Role:** SUPERADMIN, MANAGEMENT, SUPERVISOR
- **Response 200:**
```json
{
  "session": { "id", "session_code", "time_slot", "status" },
  "duty_date": "2026-09-03",
  "summary": {
    "total_waiting": 12,
    "total_plotted": 5,
    "total_capacity": 30,
    "total_assigned": 5,
    "available_armadas_count": 8
  },
  "duty_queue": [{ "rider_id", "rider_name", "status", "confirmed_at" }],
  "zones": [{ "zone_id", "zone_name", "max_capacity", "assigned_count", "remaining_capacity" }],
  "assignments": [{ "id", "rider_name", "zone_name", "assignment_type", "status" }],
  "available_armadas": [{ "id", "code", "type", "status" }]
}
```

### GET /api/distribution/preview
- **Role:** SUPERADMIN, MANAGEMENT, SUPERVISOR
- **Response 200:**
```json
{
  "session": {},
  "is_empty": false,
  "total_riders_in_queue": 12,
  "allocations_count": 10,
  "unassigned_count": 2,
  "proposed_allocations": [{ "rider_id", "rider_name", "zone_id", "zone_name", "topsis_rank", "reason" }],
  "unassigned_riders": [{ "rider_id", "rider_name", "reason" }],
  "zone_allocation_summary": [{ "zone_name", "rank", "count", "max" }]
}
```

### POST /api/distribution/confirm
- **Role:** SUPERADMIN, SUPERVISOR
- **Request:** `{ execution_type?, allocations: ProposedAllocation[], unassigned_riders? }`
- **Response 200:** `{ msg, run: DistributionRun, assignments: Assignment[] }`

### POST /api/distribution/auto
- **Role:** SUPERADMIN, SUPERVISOR
- **Response 200:** `{ msg, run, assignments }`

### POST /api/distribution/manual
- **Role:** SUPERADMIN, SUPERVISOR
- **Request:** `{ rider_id, zone_id, armada_id?, notes? }`
- **Response 200:** `{ msg, assignment: AssignmentItem }`
- **Error 400:** `{ msg: "Zone at capacity" }`
- **Error 400:** `{ msg: "Rider not in WAITING status" }`

### GET /api/distribution/runs
- **Role:** SUPERADMIN, MANAGEMENT, SUPERVISOR
- **Query:** `limit`
- **Response 200:** `{ runs: DistributionRunItem[] }`

### PUT /api/distribution/duty/:id/status
- **Role:** SUPERADMIN, MANAGEMENT, SUPERVISOR
- **Request:** `{ status: "NO_SHOW"|"CANCELLED", notes? }`
- **Response 200:** `{ msg: "Status updated" }`
- **Business Rule (Atomic Cascade):** Ketika status diubah menjadi `NO_SHOW` atau `CANCELLED`, service layer wajib menjalankan transaksi atomic untuk memperbarui status `zone_assignments` terkait menjadi `CANCELLED`, sekaligus mengurangi hitungan `assigned_count` (merestorasi `remaining_capacity`) pada tabel `zones`.

### GET /api/distribution/my-history
- **Role:** Authenticated
- **Response 200:** `{ history: [...] }`

## 8-9. Request/Response Schema
See API Contract above.

## 10. Error Contract
| Status | Code | When |
|:---:|---|---|
| 400 | `ZONE_AT_CAPACITY` | Target zone has no remaining capacity |
| 400 | `RIDER_NOT_WAITING` | Rider not in WAITING status |
| 409 | `RIDER_ALREADY_ASSIGNED` | Rider already has assignment today |

## 11. Business Rules
- Zone cannot exceed max_capacity
- Only WAITING riders can be distributed
- One active assignment per rider per date
- Manual override must record reason (currently in notes, BLK-001)
- Distribution run creates: distribution_runs + distribution_run_items + zone_assignments
- **Duty Cancellation Cascade:** Ketika status diubah menjadi `NO_SHOW` atau `CANCELLED`, service layer wajib menjalankan transaksi atomic untuk memperbarui status `zone_assignments` terkait menjadi `CANCELLED`, sekaligus mengurangi hitungan `assigned_count` (merestorasi `remaining_capacity`) pada tabel `zones`.

## 12. Database Dependencies
| Table | Purpose | Lifecycle |
|---|---|---|
| `distribution_runs` | Run metadata | HISTORICAL / APPEND-ONLY |
| `distribution_run_items` | Individual allocations | HISTORICAL / APPEND-ONLY |
| `zone_assignments` | Rider-zone binding | HISTORICAL |
| `rider_duty_queues` | Queue status tracking | DAILY STATE |
| `zones` | Capacity reference | Referenced |

## 13. Service Dependencies
- `DistributionService.ts`
- `RiderOperationalService.ts`

## 14. Repository Dependencies
- `distributionRepository.ts`

## 15. Worker Dependencies
None direct.

## 16. Files Allowed to Modify
- `src/services/distribution/DistributionService.ts`
- `src/controllers/distributionController.ts`
- `src/repositories/distributionRepository.ts`

## 17. Files Forbidden to Modify
- Overpass sync pipeline, Open-Meteo weather client

## 18. Dependencies on Other PARTs
- Depends on: PART 02, PART 03, PART 07

## 19. Acceptance Criteria
- [ ] Batch run assigns riders to top ranked zones up to capacity
- [ ] Manual override succeeds only if zone has remaining capacity
- [ ] DSS accuracy metrics reflect auto vs manual correctly
- [ ] Preview matches subsequent confirmation results
- [ ] Unique assignment per rider per date enforced

## 20. Test Cases
- Distribution capacity constraint test
- Manual override with full/empty zone
- Preview → Confirm flow consistency test

## 21. Verification Commands
```bash
bun x tsc --noEmit
bun run tests/report_and_attendance.test.ts
```

## 22. Known Risks
- Concurrent manual overrides on last remaining slot
- Race condition between preview and confirm

## 23. Open Decisions
- **BLK-001 [RESOLVED]:** `recommended_zone_id UUID`, `actual_zone_id UUID`, `is_override BOOLEAN`, dan `override_reason VARCHAR(255)` menjadi kolom skema database permanen pada tabel `zone_assignments` dan `distribution_run_items`.

## 24. Current Implementation Status
- Auto batch plotting: Functional
- Manual override: Functional (uses notes for override reason, BLK-001)
- Preview: Functional

## 25. Reconstruction Checklist
- [x] REQUIREMENTS_VERIFIED
- [x] UI_CONTRACT_VERIFIED
- [x] API_CONTRACT_VERIFIED
- [x] DATA_MODEL_VERIFIED
- [x] BUSINESS_RULES_VERIFIED
- [x] IMPLEMENTATION_COMPLETE
- [x] TESTS_PASS (14/14 PASS)
- [x] INTEGRATION_VERIFIED
- [x] REGRESSION_VERIFIED (157/157 TOTAL PASS)
- [x] DOCUMENTATION_UPDATED

**PART STATUS: COMPLETED**

## 26. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Requirements extracted | Documented in SSOT |
| 2026-09-03 | Duty Cancellation Cascade | Implemented atomic transaction in updateDutyQueueStatus |
| 2026-09-03 | Manual Distribute Fallback | Resilient targetZone lookup with capacity check |
| 2026-09-03 | PART 08 Test Suite Executed | 14/14 Unit & Integration Tests PASS |
