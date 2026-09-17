<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Map, Layers, CloudSun, Eye, EyeOff } from 'lucide-svelte';
  import { createBasemapLayer } from '../../lib/mapProviders';

  interface Props {
    hubLat?: number;
    hubLng?: number;
    hubName?: string;
    radiusKm?: number;
    basemapId?: string;
    zoomLevel?: number;
    showHubRadius?: boolean;
    showProtocolRoads?: boolean;
    showPoi?: boolean;
    showWeather?: boolean;
  }

  let {
    hubLat = -7.2575,
    hubLng = 112.7521,
    hubName = 'Central Hub',
    radiusKm = 12,
    basemapId = 'openmaptiles-dark',
    zoomLevel = 13,
    showHubRadius = true,
    showProtocolRoads = true,
    showPoi = false,
    showWeather = true,
  }: Props = $props();

  let mapContainer: HTMLDivElement;
  let mapInstance: any = null;
  let currentTileLayer: any = null;
  let hubMarkerLayer: any = null;
  let radiusCircleLayer: any = null;
  let demoPoiLayerGroup: any = null;
  let demoRoadLayerGroup: any = null;
  let isMapReady = $state(false);

  const initMap = () => {
    if (typeof window === 'undefined' || !mapContainer) return;

    const L = (window as any).L;
    if (!L) {
      setTimeout(initMap, 150);
      return;
    }

    const centerLat = hubLat !== 0 && !isNaN(hubLat) ? hubLat : -7.2575;
    const centerLng = hubLng !== 0 && !isNaN(hubLng) ? hubLng : 112.7521;

    mapInstance = L.map(mapContainer, {
      center: [centerLat, centerLng],
      zoom: zoomLevel,
      zoomControl: true,
      attributionControl: false,
    });

    // Initial Tile Layer
    updateBasemap(basemapId);

    // Initial Layers Setup
    updateHubAndRadius();
    updateDemoPois();
    updateDemoRoads();

    isMapReady = true;
    setTimeout(() => {
      mapInstance?.invalidateSize();
    }, 200);
  };

  const updateBasemap = (providerId: string) => {
    if (!mapInstance) return;
    const L = (window as any).L;
    if (!L) return;

    if (currentTileLayer) {
      mapInstance.removeLayer(currentTileLayer);
    }

    const { layer } = createBasemapLayer(L, providerId);
    layer.addTo(mapInstance);
    currentTileLayer = layer;
  };

  const updateHubAndRadius = () => {
    if (!mapInstance) return;
    const L = (window as any).L;
    if (!L) return;

    const valid = hubLat !== 0 && hubLng !== 0 && !isNaN(hubLat) && !isNaN(hubLng);
    if (!valid) return;

    // Hub Pin
    if (hubMarkerLayer) {
      mapInstance.removeLayer(hubMarkerLayer);
      hubMarkerLayer = null;
    }

    const hubIcon = L.divIcon({
      className: 'hub-pref-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] border-2 border-white shadow-lg flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    hubMarkerLayer = L.marker([hubLat, hubLng], { icon: hubIcon }).addTo(mapInstance);

    // Radius Circle
    if (radiusCircleLayer) {
      mapInstance.removeLayer(radiusCircleLayer);
      radiusCircleLayer = null;
    }

    if (showHubRadius) {
      radiusCircleLayer = L.circle([hubLat, hubLng], {
        radius: (radiusKm || 12) * 1000,
        color: '#FF634A',
        weight: 1.5,
        dashArray: '4, 6',
        fillColor: '#FF634A',
        fillOpacity: 0.1,
      }).addTo(mapInstance);
    }
  };

  const updateDemoPois = () => {
    if (!mapInstance) return;
    const L = (window as any).L;
    if (!L) return;

    if (demoPoiLayerGroup) {
      mapInstance.removeLayer(demoPoiLayerGroup);
      demoPoiLayerGroup = null;
    }

    if (showPoi && hubLat !== 0 && hubLng !== 0) {
      demoPoiLayerGroup = L.layerGroup();
      // 4 sample representative contextual POI markers around Hub
      const offsets = [
        { dLat: 0.006, dLng: 0.007, color: '#3B82F6', label: 'Sekolah' },
        { dLat: -0.008, dLng: 0.005, color: '#10B981', label: 'Kuliner' },
        { dLat: 0.005, dLng: -0.009, color: '#8B5CF6', label: 'Kantor' },
        { dLat: -0.005, dLng: -0.006, color: '#F59E0B', label: 'Pasar' },
      ];

      offsets.forEach((o) => {
        const pIcon = L.divIcon({
          className: 'sample-poi-pin',
          html: `<div class="w-3.5 h-3.5 rounded-full border-2 border-white shadow" style="background-color: ${o.color};"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([hubLat + o.dLat, hubLng + o.dLng], { icon: pIcon }).addTo(demoPoiLayerGroup);
      });

      demoPoiLayerGroup.addTo(mapInstance);
    }
  };

  const updateDemoRoads = () => {
    if (!mapInstance) return;
    const L = (window as any).L;
    if (!L) return;

    if (demoRoadLayerGroup) {
      mapInstance.removeLayer(demoRoadLayerGroup);
      demoRoadLayerGroup = null;
    }

    if (showProtocolRoads && hubLat !== 0 && hubLng !== 0) {
      demoRoadLayerGroup = L.layerGroup();
      // Sample polyline showing protocol highway artery passing near hub
      const roadCoords = [
        [hubLat - 0.02, hubLng - 0.015],
        [hubLat - 0.008, hubLng - 0.004],
        [hubLat + 0.005, hubLng + 0.006],
        [hubLat + 0.02, hubLng + 0.018],
      ];
      L.polyline(roadCoords, {
        color: '#EAB308',
        weight: 3.5,
        opacity: 0.8,
        dashArray: '6, 6',
      }).addTo(demoRoadLayerGroup);

      demoRoadLayerGroup.addTo(mapInstance);
    }
  };

  // React to reactive prop updates
  $effect(() => {
    if (isMapReady && basemapId) {
      updateBasemap(basemapId);
    }
  });

  $effect(() => {
    if (isMapReady) {
      updateHubAndRadius();
    }
  });

  $effect(() => {
    if (isMapReady) {
      updateDemoPois();
    }
  });

  $effect(() => {
    if (isMapReady) {
      updateDemoRoads();
    }
  });

  $effect(() => {
    if (isMapReady && mapInstance && zoomLevel) {
      mapInstance.setZoom(zoomLevel);
    }
  });

  onMount(() => {
    initMap();
  });

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });
</script>

<div class="space-y-2">
  <div class="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-[#272730] shadow-inner bg-[#121214]">
    <div bind:this={mapContainer} class="w-full h-full"></div>

    <!-- Active Layers Pill Bar Overlay -->
    <div class="absolute top-3 left-3 bg-[#18181D]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs flex items-center gap-3 z-[400] text-zinc-300">
      <div class="flex items-center gap-1.5 font-outfit-600">
        <Layers class="w-3.5 h-3.5 text-[#FF634A]" />
        <span class="text-white font-mono text-[11px] capitalize">{basemapId.replace('openmaptiles-', '')}</span>
      </div>
      <span class="text-zinc-600">•</span>
      <span class="text-[11px] font-mono text-zinc-400">Zoom: {zoomLevel}x</span>
    </div>

    <!-- Weather Widget Overlay if enabled -->
    {#if showWeather}
      <div class="absolute top-3 right-3 bg-[#18181D]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs flex items-center gap-2 z-[400]">
        <CloudSun class="w-4 h-4 text-amber-400" />
        <span class="text-zinc-300 text-[11px]">29°C Cerah Berawan</span>
      </div>
    {/if}

    <!-- Microcopy footer overlay -->
    <div class="absolute bottom-2.5 left-2.5 right-2.5 bg-[#18181D]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-zinc-300 flex items-center justify-between pointer-events-none z-[400]">
      <span class="text-zinc-400">Pratinjau langsung preferensi tampilan peta operasional</span>
      <span class="font-mono text-[10px] text-zinc-400">
        POI: {showPoi ? 'ON' : 'OFF'} | Jalan: {showProtocolRoads ? 'ON' : 'OFF'}
      </span>
    </div>
  </div>
</div>
