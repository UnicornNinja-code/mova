# FRONTEND PART 08 — RIDER MOBILE EXPERIENCE, GEOFENCE CHECK-IN & LIVE LBS

## 1. Objective
Reconstruct the mobile-responsive field operations interface for Riders: daily assignment card, armada claim checklist flow, GPS polygon geofence check-in with distance-to-boundary indicators, live location socket tracking, and shift checkout.

## 2. Target Svelte Components & Routes
- `src/pages/rider/RiderDashboardPage.svelte`
- `src/components/rider/AttendanceTab.svelte`
- `src/components/rider/GeofenceStatusCard.svelte`
- `src/components/rider/ArmadaClaimFlow.svelte`
- `src/components/rider/CheckoutModal.svelte`
- `src/services/riderService.ts`
- `src/lib/socket.ts`

## 3. API Contract Binding (Backend Dependency)
- `GET /api/rider/active-session` → Response `{ has_active_session, session, duty, armada }` (includes `zone.polygon` and `zone.centroid`)
- `POST /api/rider/check-in` → Request `{ latitude, longitude, assignment_id? }` → Response `{ assignment_id, zone_id, status: "CHECKED_IN", check_in_time }`
- `POST /api/rider/checkout` → Request `{ assignment_id?, notes? }` → Response `{ check_out_time, armada_returned }`
- `POST /api/lbs/track` → Request `{ latitude, longitude, accuracy?, speed? }`
- `GET /api/lbs/nearby` & `GET /api/lbs/riders/:riderId`

## 4. State Management & Svelte 5 Runes Spec
- **Rider Field State:**
  ```typescript
  class RiderOperationalState {
    activeSession = $state<RiderActiveSessionPayload | null>(null);
    currentLocation = $state<{ latitude: number; longitude: number } | null>(null);
    isLocating = $state(false);
    isInsideZone = $state(false);
    distanceToZoneMeters = $state<number | null>(null);
  }
  ```
- **Geolocation Watcher:** `$effect()` attaches `navigator.geolocation.watchPosition` on mobile to stream live coordinates to backend and socket.

## 5. UI/UX Interaction & Edge Cases
- **Mobile Map Layer Visibility (Rider View):** Lokasi Saya, Assigned Zone Polygon, Recommended Zones, Armada Terdekat, Jalan Protokol Terlarang, dan Batas Geofence.
- **Protocol Road Proximity Alert:** Jika jarak rider ke ruas jalan protokol terlarang $\le 50$ meter, UI memunculkan banner peringatan kuning melayang: *"Peringatan: Anda mendekati area jalan protokol terlarang (±{distance}m)"*.
- **Geofence Boundary Feedback:** If `POST /api/rider/check-in` returns `OUTSIDE_ZONE`, the UI renders an amber warning card: *"Anda berada di luar area penugasan (Kurang ±{distance_to_zone_meters} meter lagi)"*.
- **Auto-Center Polygon:** The mobile map automatically fits bounds to the assigned zone polygon as soon as `active-session` loads.
- **GPS Re-Acquisition Fallback:** Menyediakan tombol "Pindai Ulang GPS" (`getCurrentPosition` dengan `enableHighAccuracy: true` dan timeout 10 detik) jika `watchPosition` macet atau mengalami error `TIMEOUT`/`POSITION_UNAVAILABLE` saat perangkat masuk ke mode hemat baterai.
- **Shift Checkout Dialog:** Prompts rider for end-of-shift notes and confirms return of armada to `ACTIVE`.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export interface RiderActiveSessionPayload {
  has_active_session: boolean;
  session?: { id: string; time_slot: string; date: string; status: string };
  duty?: {
    id: string;
    status: RiderDutyStatus;
    zone_id: string;
    zone_name: string;
    zone_polygon?: GeoJsonPolygon;
    armada_id?: string;
    armada_code?: string;
    checked_in_at?: string;
  };
  armada?: {
    id: string;
    code: string;
    name: string;
    battery_level?: number;
    status: ArmadaStatus;
  };
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:** `src/pages/rider/*`, `src/components/rider/*`, `src/services/riderService.ts`, `src/lib/socket.ts`
- **Forbidden:** Backoffice SuperAdmin pages.

## 8. Verification & Acceptance Criteria
- [x] Mobile view renders responsive cards for Duty, Armada, and Geofence status.
- [x] Check-in inside polygon successfully transitions duty to `CHECKED_IN` and timestamps attendance.
- [x] Shift checkout releases armada and unlocks personal sales summary.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 08 Setup | Rider mobile dashboard, attendance, geofence status & armada claim verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |
