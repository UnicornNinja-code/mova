import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  createPulsingRiderIcon,
  createSpotIcon,
  createCompetitorIcon,
} from "./MapContainer";
import { createSafePopupContent } from "@/lib/security/safePopup";

/**
 * MapLayerManager
 * Manages rendering, updating, and cleanup of the 5 spatial Leaflet operational layers.
 */
export function MapLayerManager({
  map,
  zones = [],
  candidateSpots = [],
  restrictedRoads = [],
  competitors = [],
  riders = [],
  visibleLayers = {
    zones: true,
    spots: true,
    roads: true,
    competitors: true,
    riders: true,
  },
  onSelectEntity,
}) {
  const layerGroupsRef = useRef({
    zones: L.layerGroup(),
    spots: L.layerGroup(),
    roads: L.layerGroup(),
    competitors: L.layerGroup(),
    riders: L.layerGroup(),
  });

  // Attach layer groups to map once
  useEffect(() => {
    if (!map) return;

    Object.values(layerGroupsRef.current).forEach((group) => {
      group.addTo(map);
    });

    return () => {
      Object.values(layerGroupsRef.current).forEach((group) => {
        group.clearLayers();
        group.remove();
      });
    };
  }, [map]);

  // 1. Render Zones Layer (Polygons)
  useEffect(() => {
    const group = layerGroupsRef.current.zones;
    group.clearLayers();

    if (!visibleLayers.zones || !map) return;

    zones.forEach((zone) => {
      if (!zone.polygon && !zone.geom && !zone.geometry) return;

      const polygonGeoJSON = zone.polygon || zone.geom || zone.geometry;

      try {
        const geoJsonLayer = L.geoJSON(polygonGeoJSON, {
          style: {
            color: zone.status === "ACTIVE" ? "#3B82F6" : "#9CA3AF",
            weight: 2,
            opacity: 0.8,
            fillColor: zone.status === "ACTIVE" ? "#3B82F6" : "#9CA3AF",
            fillOpacity: 0.15,
          },
          onEachFeature: (feature, layer) => {
            layer.on({
              mouseover: () => {
                layer.setStyle({ fillOpacity: 0.35, weight: 3 });
              },
              mouseout: () => {
                layer.setStyle({ fillOpacity: 0.15, weight: 2 });
              },
              click: () => {
                if (onSelectEntity) onSelectEntity("zone", zone);
              },
            });

            // Safe Popup
            const popupEl = createSafePopupContent({
              title: zone.name,
              subtitle: `Kode: ${zone.code || zone.id}`,
              statusBadge: zone.status || "ACTIVE",
              fields: [
                { label: "Target Rider", value: zone.target_riders || zone.quota || "-" },
                { label: "Revenue Target", value: zone.revenue_target ? `Rp ${zone.revenue_target.toLocaleString("id-ID")}` : "-" },
              ],
              actions: [
                {
                  label: "Inspeksi Zona",
                  onClick: () => {
                    if (onSelectEntity) onSelectEntity("zone", zone);
                  },
                },
              ],
            });

            layer.bindPopup(popupEl);
          },
        });

        geoJsonLayer.addTo(group);
      } catch (err) {
        console.warn("Failed to render zone polygon:", zone.name, err);
      }
    });
  }, [map, zones, visibleLayers.zones, onSelectEntity]);

  // 2. Render Candidate Spots Layer (TOPSIS Pins)
  useEffect(() => {
    const group = layerGroupsRef.current.spots;
    group.clearLayers();

    if (!visibleLayers.spots || !map) return;

    candidateSpots.forEach((spot, idx) => {
      const lat = Number(spot.latitude);
      const lng = Number(spot.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const rank = spot.rank || idx + 1;
      const score = spot.topsis_score ? Number(spot.topsis_score).toFixed(2) : null;
      const marker = L.marker([lat, lng], {
        icon: createSpotIcon(rank, score),
      });

      const popupEl = createSafePopupContent({
        title: spot.name || `Titik Potensial #${rank}`,
        subtitle: `Skor TOPSIS: ${score || "-"}`,
        statusBadge: `Rank #${rank}`,
        fields: [
          { label: "Kepadatan POI", value: spot.poi_density || "-" },
          { label: "Aksesibilitas", value: spot.accessibility_score || "-" },
        ],
        actions: [
          {
            label: "Detail Spot",
            onClick: () => {
              if (onSelectEntity) onSelectEntity("spot", spot);
            },
          },
        ],
      });

      marker.bindPopup(popupEl);
      marker.on("click", () => {
        if (onSelectEntity) onSelectEntity("spot", spot);
      });

      marker.addTo(group);
    });
  }, [map, candidateSpots, visibleLayers.spots, onSelectEntity]);

  // 3. Render Restricted Roads Layer (Protocol & Toll Lines)
  useEffect(() => {
    const group = layerGroupsRef.current.roads;
    group.clearLayers();

    if (!visibleLayers.roads || !map) return;

    restrictedRoads.forEach((road) => {
      if (!road.coordinates || !Array.isArray(road.coordinates)) return;

      try {
        const polyline = L.polyline(road.coordinates, {
          color: "#EF4444",
          weight: 3,
          dashArray: "6, 8",
          opacity: 0.8,
        });

        const popupEl = createSafePopupContent({
          title: road.name || "Jalan Terlarang",
          subtitle: road.type || "Jalan Protokol",
          statusBadge: "RESTRICTED",
          fields: [{ label: "Aturan", value: "Dilarang berjualan keliling" }],
        });

        polyline.bindPopup(popupEl);
        polyline.addTo(group);
      } catch (err) {
        console.warn("Failed to render restricted road polyline:", road.name, err);
      }
    });
  }, [map, restrictedRoads, visibleLayers.roads]);

  // 4. Render Competitors Layer
  useEffect(() => {
    const group = layerGroupsRef.current.competitors;
    group.clearLayers();

    if (!visibleLayers.competitors || !map) return;

    competitors.forEach((comp) => {
      const lat = Number(comp.latitude);
      const lng = Number(comp.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const marker = L.marker([lat, lng], {
        icon: createCompetitorIcon(comp.brand_name || "Kompetitor"),
      });

      const popupEl = createSafePopupContent({
        title: comp.brand_name || "Kompetitor",
        subtitle: `Status: ${comp.status || "CONFIRMED"}`,
        statusBadge: comp.price_range || "NORMAL",
        fields: [
          { label: "Kategori", value: comp.category || "Coffee Shop" },
          { label: "Radius Pengaruh", value: "200m" },
        ],
        actions: [
          {
            label: "Detail Survey",
            onClick: () => {
              if (onSelectEntity) onSelectEntity("competitor", comp);
            },
          },
        ],
      });

      marker.bindPopup(popupEl);
      marker.on("click", () => {
        if (onSelectEntity) onSelectEntity("competitor", comp);
      });

      marker.addTo(group);
    });
  }, [map, competitors, visibleLayers.competitors, onSelectEntity]);

  // 5. Render Rider Live Telemetry Layer
  useEffect(() => {
    const group = layerGroupsRef.current.riders;
    group.clearLayers();

    if (!visibleLayers.riders || !map) return;

    riders.forEach((rider) => {
      const lat = Number(rider.latitude || rider.lat);
      const lng = Number(rider.longitude || rider.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const status = rider.compliance_status || rider.status || "COMPLIANT";
      const marker = L.marker([lat, lng], {
        icon: createPulsingRiderIcon(status),
      });

      const popupEl = createSafePopupContent({
        title: rider.rider_name || rider.name || `Rider #${rider.rider_id || rider.id}`,
        subtitle: `Armada: ${rider.armada_code || rider.armada_id || "-"}`,
        statusBadge: status,
        fields: [
          { label: "Zona Tugas", value: rider.zone_name || rider.zone_id || "-" },
          { label: "Kecepatan", value: `${rider.speed || 0} km/h` },
          { label: "Penjualan Shift", value: `${rider.sales_count || 0} cup` },
        ],
        actions: [
          {
            label: "Pantau Rider",
            onClick: () => {
              if (onSelectEntity) onSelectEntity("rider", rider);
            },
          },
        ],
      });

      marker.bindPopup(popupEl);
      marker.on("click", () => {
        if (onSelectEntity) onSelectEntity("rider", rider);
      });

      marker.addTo(group);
    });
  }, [map, riders, visibleLayers.riders, onSelectEntity]);

  return null;
}
