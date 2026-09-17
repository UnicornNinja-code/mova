# FRONTEND PART 05 — POI CLUSTERING, COMPETITORS & WEATHER TELEMETRY

## 1. Objective
Reconstruct spatial Point-of-Interest (POI) visualization using marker clustering, competitor layer overlays, real-time Open-Meteo weather telemetry cards, and Bounding Box (BBox) fetch optimization.

## 2. Target Svelte Components & Routes
- `src/components/map/MonitoringMap.svelte`
- `src/components/map/PoiClusterLayer.svelte`
- `src/components/map/CompetitorLayer.svelte`
- `src/components/map/WeatherOverlayWidget.svelte`
- `src/services/mapService.ts`
- `src/services/poiCategoryService.ts`
- `src/services/competitorService.ts`

## 3. API Contract Binding (Backend Dependency)
- `GET /api/pois` → Query `bbox=minLon,minLat,maxLon,maxLat`, `category?`, `limit?`, `zone_id?`
- `GET /api/pois/categories` → Response `PoiCategory[]`
- `GET /api/competitors` → Response `CompetitorItem[]`
- `GET /api/weather/current` → Query `zone_id?`, `lat?`, `lon?` → Response `WeatherData`
- `POST /api/data-sync/trigger` → Request `{ dataset_type: "poi" }`

## 4. State Management & Svelte 5 Runes Spec
- **Map Viewport State:**
  ```typescript
  class MapViewportState {
    currentBBox = $state<{ minLon: number; minLat: number; maxLon: number; maxLat: number } | null>(null);
    activePoiCategories = $state<string[]>([]);
    showCompetitors = $state(true);
    showWeather = $state(true);
    isFetchingPois = $state(false);
  }
  ```
- **Debounced Fetching:** Listens to Leaflet `moveend` event and triggers BBox query with a 300ms debounce to avoid overwhelming the server during continuous pan/zoom.

## 5. UI/UX Interaction & Edge Cases
- **Role-Based Layer Visibility (Shared Monitoring Map):**
  - **SUPERADMIN:** Seluruh layer aktif (Users, Fleet, Zones, POI, Weather, Protocol Roads, Geofence, DSS Recommendation).
  - **MANAGEMENT:** Hanya layer Riders, Fleet, Zones (Fokus aset dan sebaran armada bisnis).
  - **SUPERVISOR:** Riders, Fleet, Zones, DSS Recommendation, POI, Protocol Roads, Geofence (Fokus komando operasional).
- **Dynamic Marker Clustering:** Groups hundreds of POI markers into color-coded cluster bubbles based on zoom level.
- **Weather Alert Banner:** If rainfall probability $> 75\%$ or weather code indicates severe weather, a pulsing alert badge is rendered on top of the affected zone.

## 6. TypeScript Interfaces & Data Mapping
```typescript
export interface PoiItem {
  id: string;
  name: string;
  category: string;
  category_name?: string;
  latitude: number;
  longitude: number;
  zone_id?: string;
}

export interface WeatherData {
  temperature_c: number;
  condition: string;
  rain_probability_pct: number;
  wind_speed_kmh: number;
  humidity_pct: number;
  weather_code: number;
}
```

## 7. Files Allowed & Forbidden to Modify
- **Allowed:** `src/components/map/*`, `src/services/mapService.ts`, `src/services/poiCategoryService.ts`, `src/services/competitorService.ts`
- **Forbidden:** Core user auth models and sales transactions.

## 8. Verification & Acceptance Criteria
- [x] POI clustering renders smoothly with zero UI lag during pan/zoom.
- [x] BBox queries pass correct `minLon,minLat,maxLon,maxLat` values.
- [x] Weather widget correctly displays live temperature and rain conditions.
- [x] `bun run check` exits with 0 errors and 0 warnings.

## 9. Current Status
**STATUS: COMPLETED**

## 10. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Frontend Part 05 Setup | POI clustering, competitor layer, weather widget & services verified |
| 2026-09-03 | TypeScript & Svelte Check | 0 errors, 0 warnings (100% PASS) |
