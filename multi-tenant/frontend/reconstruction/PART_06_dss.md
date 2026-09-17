# FRONTEND PART 06 — DSS ENGINE, BWM CALIBRATION & TOPSIS RANKINGS

## 1. Objective
Reconstruct Decision Support System (DSS) interfaces: interactive Best-Worst Method (BWM) criteria calibration, radar charts for weight distributions, consistency ratio ($\xi^*$) visualizer, and TOPSIS multi-criteria zone ranking preview.

## 2. Target Svelte Components & Routes
- `src/pages/superadmin/SuperAdminDssPage.svelte`
- `src/components/dss/BwmCalibrationTab.svelte`
- `src/components/dss/TopsisRankTab.svelte`
- `src/components/dss/DssSnapshotHistoryTab.svelte`
- `src/components/dss/RadarWeightChart.svelte`
- `src/services/dssService.ts`

## 3. API Contract Binding (Backend Dependency)
- `GET /api/dss/bwm/criteria` → Response `BwmCriterion[]` with code and description
- `POST /api/dss/bwm/calculate` → Request `{ best_criteria_id, worst_criteria_id, best_to_others, others_to_worst }` → Response `BwmCalculationResult`
- `POST /api/dss/bwm/configs` → Save active BWM configuration
- `POST /api/dss/evaluate` → Request `{ zone_ids, time_slot }` → Response `{ snapshot_id, topsis_summary: { rankings: TopsisRankItem[] } }`
- `GET /api/dss/snapshots` → Query `page?`, `limit?`

## 4. State Management & Svelte 5 Runes Spec
- **BWM Calibration State:**
  ```typescript
  class BwmState {
    criteria = $state<BwmCriterion[]>([]);
    bestId = $state<string>("");
    worstId = $state<string>("");
    bestToOthers = $state<Record<string, number>>({});
    othersToWorst = $state<Record<string, number>>({});
    calcResult = $state<BwmCalculationResult | null>(null);
    isConsistent = $derived((this.calcResult?.consistency_ratio ?? 1) <= 0.10);
  }
  ```

## 5. UI/UX Interaction & Edge Cases
- **Role-Based Tab Visibility:**
  - `SUPERADMIN`: Full Access (BWM Criteria calibration, weight saving, and TOPSIS execution).
  - `SUPERVISOR`: Tab `BwmCalibrationTab.svelte` disembunyikan/disetel Read-Only. Supervisor hanya boleh melihat ranking TOPSIS (`TopsisRankTab.svelte`) dan menjalankan evaluasi harian (`POST /api/dss/evaluate`).
  - `MANAGEMENT`: Menu DSS disembunyikan total dari sidebar.
- **Dynamic Human-Readable Mapping:** Maps criterion codes (C1–C5) alongside human-readable names (Potensi Pasar, Aksesibilitas, Kompetisi, Cuaca, Jarak Hub).
- **Consistency Ratio Warning:** Displays clear visual indicator: Green badge if $\xi^* \le 0.10$ ("Konsisten"), Red pulsing banner if $\xi^* > 0.10$ ("Tidak Konsisten — Mohon Kalibrasi Ulang").
- **Preference Score Clamping:** Guarantees all TOPSIS final scores are formatted within $[0.000, 1.000]$.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export interface BwmCriterion {
  id: string;
  code: string;
  name: string;
  description: string;
  is_benefit: boolean;
}

export interface BwmCalculationResult {
  weights: Record<string, number>;
  consistency_ratio: number;
  is_consistent: boolean;
  formatted_details: Array<{
    code: string;
    name: string;
    weight: number;
    weight_percentage: number;
  }>;
}

export interface TopsisRankItem {
  rank: number;
  zone_id: string;
  zone_name: string;
  final_score: number;
  distance_positive: number;
  distance_negative: number;
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:** `src/pages/superadmin/SuperAdminDssPage.svelte`, `src/components/dss/*`, `src/services/dssService.ts`
- **Forbidden:** Rider POS catalog and sales logging.

## 8. Verification & Acceptance Criteria
- [x] BWM solver executes and renders radar weight chart immediately.
- [x] TOPSIS evaluation displays sorted zone ranking table with color-coded score badges.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 06 Setup | BWM calibration, TOPSIS rankings & history verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |
