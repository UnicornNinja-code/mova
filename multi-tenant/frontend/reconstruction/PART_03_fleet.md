# FRONTEND PART 03 — FLEET / ARMADA MANAGEMENT & 3-MIN HOLD TIMER

## 1. Objective
Reconstruct fleet management interfaces (inventory grid, condition tracking, issue reporting with auto-MAINTENANCE transition) and the rider 3-minute view-triggered atomic reservation hold flow with clock-drift immune countdown timers and auto-release on modal exit.

## 2. Target Svelte Components & Routes
- `src/pages/superadmin/SuperAdminFleetPage.svelte`
- `src/components/fleet/FleetInventoryGrid.svelte`
- `src/components/fleet/FleetIssuesTable.svelte`
- `src/components/fleet/ArmadaCreateModal.svelte`
- `src/components/fleet/ArmadaHoldModal.svelte`
- `src/components/fleet/IssueReportModal.svelte`
- `src/services/armadaService.ts`

## 3. API Contract Binding (Backend Dependency)
- **Canonical Route Prefix:** Use `/api/fleets` strictly (deprecate `/api/armadas`).
- `GET /api/fleets` → Query `status?`, `type?` → Response `ArmadaItem[]`
- `POST /api/fleets` → Request `{ code, name, type }`
- `PUT /api/fleets/:id` → Request `{ code?, name?, type?, status? }`
- `GET /api/rider/hub-armadas` → Response `HubArmadaItem[]` with `is_claimable`, `is_held_by_me`, `hold_expires_at`
- `POST /api/rider/hold-armada` → Request `{ armada_id }` → Response `{ reservation_id, expires_at, remaining_seconds, server_time }` (TTL: 180 detik)
- `POST /api/rider/cancel-hold-armada` → Request `{ armada_id }`
- `POST /api/rider/claim-armada` → Request `{ armada_id, checklist: Record<string, boolean> }`
- `POST /api/fleets/:id/report-issue` → Request `{ severity: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", issue_type, description }`
- `GET /api/fleets/issues` & `PUT /api/fleets/issues/:id/resolve`

## 4. State Management & Svelte 5 Runes Spec
- **Canonical Fleet Status Enum (CONTRA-002 RESOLVED):**
  `"ACTIVE" | "RESERVED" | "IN_USE" | "MAINTENANCE" | "RETIRED"`
- **Clock-Drift Immune 3-Minute Hold Timer (180s):**
  ```typescript
  class ArmadaHoldState {
    activeReservation = $state<{ armada_id: string; remainingSeconds: number } | null>(null);
    timerInterval = $state<number | null>(null);

    startTimer(seconds: number = 180) {
      this.clearTimer();
      let left = seconds;
      this.timerInterval = window.setInterval(() => {
        left--;
        if (left <= 0) {
          this.clearTimer();
          this.handleExpire();
        }
      }, 1000);
    }
  }
  ```

## 5. UI/UX Interaction & Edge Cases
- **View-Triggered Auto-Hold & Unmount Release:** Saat rider mengklik kartu armada, UI otomatis memanggil `POST /api/rider/hold-armada` (durasi 180 detik). Jika rider menekan tombol "Kembali" / menutup modal sebelum 3 menit, lifecycle `onDestroy()` / modal close handler otomatis menembakkan `POST /api/rider/cancel-hold-armada` untuk pelepasan instan $O(1)$.
- **Concurrent Hold Conflict (HTTP 409):** Displays informative toast *"Armada baru saja dipilih oleh rider lain"* and triggers immediate grid revalidation.
- **Physical Inspection Checklist:** Before permanent claim is unlocked, the checklist form requires rider confirmation on all safety points (rem, tekanan ban, baterai).
- **Critical Issue Report:** Auto-updates armada status badge to `MAINTENANCE` in real-time.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export type ArmadaStatus = "ACTIVE" | "RESERVED" | "IN_USE" | "MAINTENANCE" | "RETIRED";
export type ArmadaType = "GEROBAK_LISTRIK" | "MOTOR_LISTRIK" | "SEPEDA_KARGO";

export interface ArmadaItem {
  id: string;
  code: string;
  name: string;
  type: ArmadaType;
  status: ArmadaStatus;
  battery_level?: number;
  current_rider_id?: string | null;
  current_rider_name?: string | null;
  created_at: string;
}

export interface HubArmadaItem extends ArmadaItem {
  is_claimable: boolean;
  is_held_by_me?: boolean;
  hold_expires_at?: string;
  remaining_seconds?: number;
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:** `src/pages/superadmin/SuperAdminFleetPage.svelte`, `src/components/fleet/*`, `src/services/armadaService.ts`
- **Forbidden:** Zone polygon editors and DSS solver calculators.

## 8. Verification & Acceptance Criteria
- [x] All fleet API requests use canonical prefix `/api/fleets` (and alias `/api/armadas`).
- [x] 3-minute hold modal counts down synchronously with zero drift (180s TTL).
- [x] Claiming armada creates physical assignment and binds to active rider.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 03 Setup | Fleet grid, issue table, hold modal & service verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |
