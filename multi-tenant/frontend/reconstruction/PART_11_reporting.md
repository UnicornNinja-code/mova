# FRONTEND PART 11 — DECISION INTELLIGENCE & TABULAR REPORTING HUB

## 1. Objective
Reconstruct `SuperAdminReportsPage.svelte` into a comprehensive 4-pillar Decision Intelligence and Analytics Hub: Operations, DSS Evaluation & Impact (BWM-TOPSIS), Business Revenue, and System Governance. Includes server-side pagination, summary total footers, and direct CSV file streaming.

## 2. Target Svelte Components & Routes
- `src/pages/superadmin/SuperAdminReportsPage.svelte`
- `src/components/reports/RiderPerformanceTab.svelte`
- `src/components/reports/ZoneEffectivenessTab.svelte`
- `src/components/reports/FleetLifecycleTab.svelte`
- `src/components/reports/DssAccuracyTab.svelte`
- `src/components/reports/DssImpactComparisonCard.svelte`
- `src/components/reports/ExecutiveSummaryTab.svelte`
- `src/components/reports/SystemSyncHistoryTab.svelte`
- `src/components/reports/ReportDateFilter.svelte`
- `src/components/reports/ReportExportButton.svelte`
- `src/services/reportService.ts`

## 3. 4 Core Analytical Pillars Architecture
```
SuperAdminReportsPage.svelte
├── Tab 1: Operasional (Rider Performance, Zone Conversion, Fleet Lifecycle)
├── Tab 2: DSS & Intelligence (Accuracy, Empirical Impact Analysis, BWM Snapshots)
├── Tab 3: Bisnis & Omzet (Executive Summary KPIs, Product Contribution)
└── Tab 4: Tata Kelola Sistem (Data Sync History, Audit Security Trail)
```

## 4. API Contract Binding (Backend Dependency)
- `GET /api/reports/riders/performance` → Query `start_date`, `end_date`, `rider_id?`, `page`, `limit`
- `GET /api/reports/zones/effectiveness` → Query `start_date`, `end_date`, `zone_id?`
- `GET /api/reports/dss/accuracy` → Response `{ acceptance_rate_percent, override_rate_percent, top_override_reasons }`
- `GET /api/reports/dss/impact-analysis` → Response `{ comparison: { accepted_recommendations, manual_overrides, impact_metrics } }`
- `GET /api/reports/fleet/lifecycle` → Response `{ summary, maintenance_stats }`
- `GET /api/reports/system/sync-history` → Response sync jobs log
- `GET /api/reports/executive-summary` → Response macro KPIs
- Export Stream Trigger: `GET /api/reports/:type?export=csv` with Axios `responseType: 'blob'`

## 5. State Management & Svelte 5 Runes Spec
- **Reporting Hub Workspace State:**
  ```typescript
  class ReportingHubState {
    activePillar = $state<"OPERATIONAL" | "DSS" | "BUSINESS" | "SYSTEM">("OPERATIONAL");
    activeSubTab = $state<string>("riders");
    startDate = $state(new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
    endDate = $state(new Date().toISOString().split("T")[0]);
    isLoading = $state(false);
    isExporting = $state(false);

    setDateRange(start: string, end: string) {
      if (start > end) return;
      this.startDate = start;
      this.endDate = end;
    }
  }
  ```
- **Paginated Table State:**
  ```typescript
  class PaginatedReportTable<T, S> {
    rows = $state<T[]>([]);
    summaryTotals = $state<S | null>(null);
    currentPage = $state(1);
    pageSize = $state(20);
    totalPages = $state(1);
    totalRecords = $state(0);
  }
  ```

## 6. UI/UX Interaction & Edge Cases
- **DSS Empirical Proof Card (`DssImpactComparisonCard.svelte`):** Side-by-side visual comparison displaying revenue lift percentage ($+18.4\%$) and compliance delta between Auto Recommendations vs Manual Overrides.
- **Conversion Funnel Visualization:** Visual progression bar from `Recommended` → `Assigned` → `Executed` → `Revenue Generated`.
- **Direct Stream Download:** Clicking `ReportExportButton` downloads the CSV file via native browser blob URL without page reloading.
- **Summary Totals Row:** The bottom table row displays bold aggregates across the entire query span, independent of the current page offset.

## 7. TypeScript Interfaces & Data Mapping
```typescript
export interface DssImpactData {
  evaluation_period: { start: string; end: string };
  comparison: {
    accepted_recommendations: {
      assignments_count: number;
      total_revenue: number;
      avg_revenue_per_shift: number;
      avg_check_in_compliance_pct: number;
    };
    manual_overrides: {
      assignments_count: number;
      total_revenue: number;
      avg_revenue_per_shift: number;
      avg_check_in_compliance_pct: number;
    };
    impact_metrics: {
      revenue_lift_percent: number;
      compliance_lift_percent: number;
      p_value_significance?: number;
    };
  };
}

export interface ZoneEffectivenessItem {
  zone_id: string;
  zone_name: string;
  recommended_by_dss_count: number;
  assigned_by_supervisor_count: number;
  executed_shifts_count: number;
  total_revenue: number;
  avg_revenue_per_assignment: number;
  conversion_rate_pct: number;
}
```

## 8. Files Allowed & Forbidden to Modify
- **Allowed:**
  - `src/pages/superadmin/SuperAdminReportsPage.svelte`
  - `src/components/reports/*`
  - `src/services/reportService.ts`
- **Forbidden:**
  - Core map layers and POS transaction mutation handlers.

## 9. Verification & Acceptance Criteria
- [x] 4 analytical pillars switch smoothly without memory leaks.
- [x] DSS impact card clearly demonstrates Auto vs Override performance deltas.
- [x] Exporting CSV triggers instant file download with valid spreadsheet formatting.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 10. Current Status
**STATUS: COMPLETED**

## 11. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 11 Setup | 4 reporting pillars, DSS impact comparison, date filters & CSV export verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |
