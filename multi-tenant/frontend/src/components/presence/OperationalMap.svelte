<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { presenceStore, type LiveRiderTelemetry } from '../../lib/stores/presenceStore.svelte';
  import { presenceTelemetry } from '../../lib/stores/presenceTelemetry.svelte';
  import { AlertTriangle, MapPin, ZoomIn, ZoomOut, Layers } from 'lucide-svelte';

  let mapContainer: HTMLDivElement;
  let map: L.Map | null = null;
  let zoneLayerGroup: L.FeatureGroup | null = null;
  let riderLayerGroup: L.FeatureGroup | null = null;

  // Invariant Hardening: Persistent marker lookup map for incremental updates
  const markersMap = new Map<string, L.Marker>();

  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT':
        return '#10b981'; // emerald-500
      case 'DEVIATED':
        return '#f59e0b'; // amber-500
      case 'UNASSIGNED':
        return '#3b82f6'; // blue-500
      case 'OUTSIDE':
        return '#a855f7'; // purple-500
      default:
        return '#71717a'; // zinc-500
    }
  };

  const createRiderCustomIcon = (rider: LiveRiderTelemetry) => {
    const color = getMarkerColor(rider.compliance_status);
    const isDeviated = rider.compliance_status === 'DEVIATED';

    const html = `
      <div class="relative flex items-center justify-center cursor-pointer group">
        ${isDeviated ? `<div class="pulse-ring absolute w-8 h-8 rounded-full animate-ping opacity-75" style="background-color: ${color};"></div>` : ''}
        <div class="w-6 h-6 rounded-full border-2 border-zinc-950 flex items-center justify-center text-[10px] font-bold text-zinc-950 shadow-lg transition-transform transform group-hover:scale-125" style="background-color: ${color};">
          ${isDeviated ? '▲' : '●'}
        </div>
        <div class="absolute -top-7 px-2 py-0.5 rounded bg-zinc-900/95 text-[10px] font-semibold text-zinc-100 border border-zinc-700 whitespace-nowrap shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          ${rider.rider_name} (${rider.compliance_status})
        </div>
      </div>
    `;

    return L.divIcon({
      className: 'custom-rider-pin',
      html,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  const renderZones = () => {
    if (!map || !zoneLayerGroup) return;
    zoneLayerGroup.clearLayers();

    presenceStore.zonesGeoJson.forEach((zone: any) => {
      try {
        let geoData = zone.polygon;
        if (typeof geoData === 'string') {
          geoData = JSON.parse(geoData);
        }

        const isFeature = geoData.type === 'Feature' || geoData.type === 'Polygon';
        const geojsonObj = isFeature ? geoData : { type: 'Polygon', coordinates: geoData.coordinates || geoData };

        const polygonLayer = L.geoJSON(geojsonObj, {
          style: {
            color: '#f59e0b',
            weight: 2,
            opacity: 0.8,
            fillColor: '#f59e0b',
            fillOpacity: 0.12,
            dashArray: '4, 4',
          },
        });

        polygonLayer.on('click', () => {
          presenceStore.focusZone(zone.id);
        });

        polygonLayer.bindTooltip(`<b>${zone.name}</b><br><span class="text-xs">Klik untuk ringkasan kepatuhan</span>`, {
          sticky: true,
          className: 'bg-zinc-900 text-zinc-100 border border-zinc-700 text-xs rounded px-2 py-1',
        });

        zoneLayerGroup?.addLayer(polygonLayer);
      } catch (err) {
        console.warn(`[OperationalMap] Failed to render polygon for zone ${zone.id}:`, err);
      }
    });
  };

  /**
   * Performance Hardening: Incremental Marker Update
   * Updates only changed coordinates via marker.setLatLng without rebuilding entire layer tree.
   */
  const updateRidersIncrementally = () => {
    if (!map || !riderLayerGroup) return;

    const currentRiderIds = new Set<string>();

    presenceStore.filteredRiders.forEach((rider) => {
      currentRiderIds.add(rider.rider_id);
      const existingMarker = markersMap.get(rider.rider_id);

      if (existingMarker) {
        // 1. Incremental Position Update
        existingMarker.setLatLng([rider.latitude, rider.longitude]);
        existingMarker.setIcon(createRiderCustomIcon(rider));
      } else {
        // 2. Add New Marker Instance
        const newMarker = L.marker([rider.latitude, rider.longitude], {
          icon: createRiderCustomIcon(rider),
        });

        newMarker.on('click', () => {
          presenceStore.focusRider(rider.rider_id);
        });

        newMarker.bindPopup(`
          <div class="p-2 text-zinc-900 text-xs">
            <div class="font-bold text-sm mb-1">${rider.rider_name}</div>
            <div><b>Status:</b> <span style="color: ${getMarkerColor(rider.compliance_status)}; font-weight: bold;">${rider.compliance_status}</span></div>
            <div><b>Zona Tugas:</b> ${rider.assigned_zone_name || '-'}</div>
            <div><b>Zona Saat Ini:</b> ${rider.actual_zone_name || 'Luar Zona'}</div>
            <div class="mt-2 text-[10px] text-zinc-500">Update: ${new Date(rider.last_ping).toLocaleTimeString()}</div>
          </div>
        `);

        riderLayerGroup?.addLayer(newMarker);
        markersMap.set(rider.rider_id, newMarker);
      }
    });

    // 3. Remove stale / filtered out markers
    for (const [riderId, marker] of markersMap.entries()) {
      if (!currentRiderIds.has(riderId)) {
        riderLayerGroup?.removeLayer(marker);
        markersMap.delete(riderId);
      }
    }

    presenceTelemetry.recordMarkerRender(markersMap.size);
  };

  onMount(() => {
    // Initialize Leaflet Map (Center: Sidoarjo / Surabaya Operational Area)
    map = L.map(mapContainer, {
      center: [-7.4478, 112.7183],
      zoom: 13,
      zoomControl: false,
    });

    // Dark Map Tile Layer (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB &copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    zoneLayerGroup = L.featureGroup().addTo(map);
    riderLayerGroup = L.featureGroup().addTo(map);

    renderZones();
    updateRidersIncrementally();
  });

  onDestroy(() => {
    // Memory Leak Cleanup
    markersMap.clear();
    if (zoneLayerGroup) {
      zoneLayerGroup.clearLayers();
      zoneLayerGroup = null;
    }
    if (riderLayerGroup) {
      riderLayerGroup.clearLayers();
      riderLayerGroup = null;
    }
    if (map) {
      map.remove();
      map = null;
    }
  });

  // Reactive Effect: Re-render zones when zones change
  $effect(() => {
    if (presenceStore.zonesGeoJson.length > 0) {
      renderZones();
    }
  });

  // Reactive Effect: Incrementally mutate markers when telemetry updates
  $effect(() => {
    if (presenceStore.filteredRiders) {
      updateRidersIncrementally();
    }
  });

  // Reactive Effect: Pan & Zoom to Focus Target
  $effect(() => {
    if (map && presenceStore.mapFocusTarget) {
      const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (isReducedMotion) {
        map.setView(
          [presenceStore.mapFocusTarget.latitude, presenceStore.mapFocusTarget.longitude],
          presenceStore.mapFocusTarget.zoom || 16
        );
      } else {
        map.flyTo(
          [presenceStore.mapFocusTarget.latitude, presenceStore.mapFocusTarget.longitude],
          presenceStore.mapFocusTarget.zoom || 16,
          { duration: 1.0 }
        );
      }
    }
  });

  const fitAllDeviations = () => {
    if (!map) return;
    const deviatedRiders = Array.from(presenceStore.liveRiders.values()).filter((r) => r.compliance_status === 'DEVIATED');
    if (deviatedRiders.length > 0) {
      const bounds = L.latLngBounds(deviatedRiders.map((r) => [r.latitude, r.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  };

  const handleZoomIn = () => map?.zoomIn();
  const handleZoomOut = () => map?.zoomOut();
</script>

<style>
  @media (prefers-reduced-motion: reduce) {
    :global(.pulse-ring) {
      animation: none !important;
      opacity: 0.4 !important;
    }
  }
</style>

<div class="relative w-full h-[520px] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-inner">
  <!-- Map Container -->
  <div bind:this={mapContainer} class="w-full h-full"></div>

  <!-- Map Floating Controls & Indicators -->
  <div class="absolute top-3 left-3 z-[400] flex items-center gap-2">
    {#if presenceStore.kpi.deviated > 0}
      <button
        type="button"
        onclick={fitAllDeviations}
        class="bg-amber-500/90 hover:bg-amber-500 text-zinc-950 text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
        aria-label="Fokus ke semua rider yang mengalami deviasi"
      >
        <AlertTriangle class="w-3.5 h-3.5" />
        Fokus {presenceStore.kpi.deviated} Deviasi
      </button>
    {/if}

    <div class="bg-zinc-900/90 border border-zinc-700/80 text-zinc-200 text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2" role="status">
      <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Compliant ({presenceStore.kpi.compliant})
      <span class="w-2 h-2 rounded-full bg-amber-400"></span> Deviated ({presenceStore.kpi.deviated})
      <span class="w-2 h-2 rounded-full bg-blue-400"></span> Unassigned ({presenceStore.kpi.unassigned})
    </div>
  </div>

  <!-- Zoom Controls -->
  <div class="absolute bottom-3 right-3 z-[400] flex flex-col gap-1.5">
    <button
      type="button"
      onclick={handleZoomIn}
      class="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 shadow-md cursor-pointer transition-colors"
      aria-label="Zoom in"
    >
      <ZoomIn class="w-4 h-4" />
    </button>
    <button
      type="button"
      onclick={handleZoomOut}
      class="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 shadow-md cursor-pointer transition-colors"
      aria-label="Zoom out"
    >
      <ZoomOut class="w-4 h-4" />
    </button>
  </div>
</div>
