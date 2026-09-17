# FRONTEND PART 07 — BATCH & MANUAL DISTRIBUTION PLOTTING WORKSPACE

## 1. Objective
Reconstruct the daily Rider-to-Zone Distribution workspace for Supervisors and SuperAdmins: auto-distribution preview based on TOPSIS rankings, manual assignment overrides with capacity validation, and duty queue status management.

## 2. Target Svelte Components & Routes
- `src/pages/superadmin/SuperAdminDistributionPage.svelte`
- `src/components/distribution/DistributionOverview.svelte`
- `src/components/distribution/DistributionPreviewModal.svelte`
- `src/components/distribution/ManualAssignModal.svelte`
- `src/components/distribution/DistributionRunHistory.svelte`
- `src/services/distributionService.ts`

## 3. API Contract Binding (Backend Dependency)
- `GET /api/distribution/overview` → Response `DistributionOverviewData`
- `GET /api/distribution/preview` → Response proposed allocations vs unassigned riders
- `POST /api/distribution/confirm` → Request `{ allocations, unassigned_riders }`
- `POST /api/distribution/manual` → Request `{ rider_id, zone_id, armada_id, notes }`
- `PUT /api/distribution/duty/:id/status` → Request `{ status: "NO_SHOW" | "CANCELLED", notes? }`
- `GET /api/distribution/runs` → Query `limit?`

## 4. State Management & Svelte 5 Runes Spec
- **Distribution Workspace State:**
  ```typescript
  class DistributionState {
    overview = $state<DistributionOverviewData | null>(null);
    previewData = $state<DistributionPreviewData | null>(null);
    selectedRiderForManual = $state<WaitingRiderItem | null>(null);
    isProcessing = $state(false);
  }
  ```
- **Optimistic Quota Decrement:** Decrements `remaining_capacity` locally when manual assignment is confirmed.

## 5. UI/UX Interaction & Edge Cases
- **Structured Error Feedback on Capacity Conflict:** If `confirm` fails because another supervisor took the remaining zone slot, the UI parses `failed_allocations: [{ rider_id, reason }]` and flags affected rows with red badges.
- **Duty Cancellation Cascade:** Marking rider as `NO_SHOW` or `CANCELLED` instantly restores the zone's quota badge in the UI without requiring full page reload.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export interface ProposedAllocation {
  rider_id: string;
  rider_name: string;
  zone_id: string;
  zone_name: string;
  topsis_rank: number;
  reason?: string;
}

export interface DistributionOverviewData {
  session: { id: string; time_slot: string; status: string };
  summary: {
    total_waiting: number;
    total_plotted: number;
    total_capacity: number;
    available_armadas_count: number;
  };
  duty_queue: Array<{ rider_id: string; rider_name: string; status: RiderDutyStatus; confirmed_at: string }>;
  zones: Array<{ zone_id: string; zone_name: string; max_capacity: number; assigned_count: number; remaining_capacity: number }>;
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:** `src/pages/superadmin/SuperAdminDistributionPage.svelte`, `src/components/distribution/*`, `src/services/distributionService.ts`
- **Forbidden:** Core authentication middleware.

## 8. Verification & Acceptance Criteria
- [x] Auto-distribution preview correctly maps waiting riders to top-ranked zones.
- [x] Manual override succeeds only when target zone has remaining capacity $> 0$.
- [x] Marking `NO_SHOW` updates duty queue status and frees zone slot.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 07 Setup | Distribution workspace, preview modal, manual assignment & history verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |
