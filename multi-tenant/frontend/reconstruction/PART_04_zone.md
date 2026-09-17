# FRONTEND PART 04 — OPERATIONAL ZONES & SPATIAL GEOJSON MANAGEMENT

## 1. Objective
Reconstruct operational zone interfaces: interactive GeoJSON polygon boundary drawer, PostGIS coordinate ordering compliance (`[longitude, latitude]`), pre-validation against hub operational radius, and quick capacity updates.

## 2. Target Svelte Components & Routes
- `src/pages/superadmin/SuperAdminZonesPage.svelte`
- `src/components/zones/ZoneEditorModal.svelte`
- `src/components/zones/ZoneDrawerMap.svelte`
- `src/components/zones/ZoneCapacityBadge.svelte`
- `src/components/zones/ZoneListTable.svelte`
- `src/services/zoneService.ts`

## 3. API Contract Binding (Backend Dependency)
- `GET /api/zones` → Response `ZoneItem[]`
- `GET /api/zones?format=geojson` → Response GeoJSON `FeatureCollection` (RFC 7946)
- `GET /api/zones/config` → Response `{ hub: { lat, lng, city_name, radius_km } }`
- `POST /api/zones/validate` → Request `{ polygon: GeoJSON }` → Response `{ is_within_radius, max_distance_km, radius_limit_km }`
- `POST /api/zones` & `PUT /api/zones/:id` → Request `{ name, description?, max_capacity, polygon: GeoJSON }`
- `PATCH /api/zones/:id/capacity` → Request `{ max_capacity: number }`
- `PATCH /api/zones/:id/status` → Request `{ status: "active" | "inactive" }`
- `DELETE /api/zones/:id`

## 4. State Management & Svelte 5 Runes Spec
- **Zone Workspace State:**
  ```typescript
  class ZonePageState {
    zones = $state<ZoneItem[]>([]);
    selectedZone = $state<ZoneItem | null>(null);
    isDrawing = $state(false);
    hubConfig = $state<{ lat: number; lng: number; radius_km: number } | null>(null);
  }
  ```
- **PostGIS Coordinate Ordering Convention:**
  Leaflet uses `[lat, lng]`, whereas GeoJSON and PostGIS `ST_MakePoint` use `[longitude, latitude]` / `(X, Y)`. The frontend adapter MUST transform Leaflet layer coordinates cleanly to `[lng, lat]` before dispatching to the API.

## 5. UI/UX Interaction & Edge Cases
- **Role-Based View & Action Guard:**
  - `SUPERADMIN`: Full Access (Drawing, Edit, Delete, dan Capacity Update).
  - `SUPERVISOR`: View & Operational Mode (Hanya boleh mengubah kapasitas kuota via quick-update, dilarang create/delete polygon).
  - `MANAGEMENT`: Halaman zona disembunyikan total dari navigasi.
- **Out of Operational Radius Warning:** The drawer map dynamically highlights polygon borders in red if any vertex exceeds `hubConfig.radius_km` with real-time distance readout.
- **Quick Capacity Update:** Allows supervisors to increment/decrement zone capacity on-the-fly with optimistic UI updates.
- **Direct GeoJSON Map Rendering:** Direct integration with Leaflet GeoJSON layer for high-performance rendering of multi-zone layouts.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][]; // [longitude, latitude]
}

export interface ZoneItem {
  id: string;
  name: string;
  description?: string;
  max_capacity: number;
  assigned_count?: number;
  remaining_capacity?: number;
  status: "active" | "inactive";
  polygon: GeoJsonPolygon;
  created_at: string;
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:** `src/pages/superadmin/SuperAdminZonesPage.svelte`, `src/components/zones/*`, `src/services/zoneService.ts`
- **Forbidden:** BWM criteria configurations and sales logging tables.

## 8. Verification & Acceptance Criteria
- [x] Polygon drawer draws valid closed linear rings with correct `[lng, lat]` coordinate order.
- [x] Pre-validation endpoint triggers and blocks invalid geometry exceeding operational radius.
- [x] Capacity quick-update reflects immediately in table and map badges.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 04 Setup | Zone table, drawer map, validation modal & service verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |
