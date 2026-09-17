import React, { useState, useCallback } from "react";
import L from "leaflet";
import {
  MapContainer,
  MapToolbar,
  MapLayerControl,
  MapLegend,
  MapPanel,
  MapLayerManager,
} from "@/components/mapops";
import { useZonesList } from "@/hooks/queries/useZones";
import { useLiveLocations } from "@/hooks/queries/useRiderOps";
import { useCompetitorSummary } from "@/hooks/queries/useCompetitors";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export function MapOpsPage() {
  const [mapInstance, setMapInstance] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityType, setEntityType] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [layers, setLayers] = useState({
    zones: true,
    spots: true,
    roads: true,
    competitors: true,
    riders: true,
  });

  // Enable automatic realtime WebSocket synchronization
  useRealtimeSync();

  // Fetch real spatial datasets via TanStack Query
  const { data: zonesData = [], refetch: refetchZones } = useZonesList();
  const { data: ridersData = [], refetch: refetchRiders } = useLiveLocations();
  const { data: competitorsData = [], refetch: refetchCompetitors } = useCompetitorSummary();

  const zones = Array.isArray(zonesData) ? zonesData : zonesData?.zones || [];
  const riders = Array.isArray(ridersData) ? ridersData : ridersData?.locations || [];
  const competitors = Array.isArray(competitorsData)
    ? competitorsData
    : competitorsData?.competitors || [];

  const handleToggleLayer = (key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectEntity = useCallback((type, entity) => {
    setEntityType(type);
    setSelectedEntity(entity);
    setPanelOpen(true);
  }, []);

  const handleFitAllZones = useCallback(() => {
    if (!mapInstance || zones.length === 0) return;

    try {
      const bounds = L.latLngBounds();
      let hasValidCoords = false;

      zones.forEach((zone) => {
        const poly = zone.polygon || zone.geom || zone.geometry;
        if (poly && poly.coordinates) {
          const geoLayer = L.geoJSON(poly);
          bounds.extend(geoLayer.getBounds());
          hasValidCoords = true;
        }
      });

      if (hasValidCoords) {
        mapInstance.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch (err) {
      console.warn("Failed to fit bounds:", err);
    }
  }, [mapInstance, zones]);

  const handleRefreshAll = () => {
    refetchZones();
    refetchRiders();
    refetchCompetitors();
  };

  const handlePanelAction = (actionType, entity) => {
    if (actionType === "dss-calculate") {
      alert(`Memicu perhitungan DSS TOPSIS untuk zona: ${entity.name}`);
    } else if (actionType === "contact-rider") {
      alert(`Menghubungi Rider #${entity.rider_name || entity.rider_id}`);
    }
  };

  const layerCounts = {
    zones: zones.length,
    spots: 0,
    roads: 0,
    competitors: competitors.length,
    riders: riders.length,
  };

  return (
    <div className="relative w-full h-[calc(100vh-8.5rem)] rounded-[var(--radius-sm)] border border-[var(--border)] overflow-hidden shadow-xs">
      <MapContainer onMapReady={setMapInstance}>
        <MapToolbar
          map={mapInstance}
          onFitAllZones={handleFitAllZones}
          onRefresh={handleRefreshAll}
        />
        <MapLayerControl
          layers={layers}
          counts={layerCounts}
          onToggleLayer={handleToggleLayer}
        />
        <MapLegend />

        <MapLayerManager
          map={mapInstance}
          zones={zones}
          candidateSpots={[]}
          restrictedRoads={[]}
          competitors={competitors}
          riders={riders}
          visibleLayers={layers}
          onSelectEntity={handleSelectEntity}
        />
      </MapContainer>

      {/* Slide-over Inspection Drawer */}
      <MapPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        entityType={entityType}
        selectedEntity={selectedEntity}
        onAction={handlePanelAction}
      />
    </div>
  );
}
