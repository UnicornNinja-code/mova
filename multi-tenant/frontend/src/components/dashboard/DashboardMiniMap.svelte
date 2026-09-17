<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mapService, type ZoneFeature, type NearbyRider } from '../../services/mapService';
  import { createBasemapLayer } from '../../lib/mapProviders';

  interface Props {
    onOpenFullMap: () => void;
  }

  let { onOpenFullMap }: Props = $props();

  let mapContainer: HTMLDivElement;
  let mapInstance: any = null;
  let L: any = null;

  let realZones = $state<ZoneFeature[]>([]);
  let activeRiders = $state<NearbyRider[]>([]);
  let protocolRoadsGeoJson = $state<any>(null);
  let tollRoadsGeoJson = $state<any>(null);
  let zoneConfig = $state<any>(null);
  let loading = $state(true);

  function parsePolygonToLatLngs(polygon: any): [number, number][] {
    if (!polygon) return [];
    try {
      const parsed = typeof polygon === 'string' ? JSON.parse(polygon) : polygon;
      const ring = parsed.coordinates?.[0] || parsed.coordinates || [];
      return ring.map((pt: [number, number]) => [pt[1], pt[0]]);
    } catch {
      return [];
    }
  }

  const renderMapLayers = () => {
    if (!mapInstance || !L) return;

    const layerGroup = L.featureGroup();

    // 0. Render Central HUB Location (Golden Radiant Beacon Marker)
    if (zoneConfig) {
      const hubLat = zoneConfig.hub_latitude || -7.397402;
      const hubLng = zoneConfig.hub_longitude || 112.711958;
      const hubName = zoneConfig.hub_city_name || "Sidoarjo";

      const hubIconHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
          <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background: rgba(255, 99, 74, 0.4); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, #FF634A, #FF8573); border: 2px solid #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(255, 99, 74, 0.9);">
            <span style="font-size: 10px; font-weight: bold; color: #09090B;">🏢</span>
          </div>
        </div>
      `;
      const hubCustomIcon = L.divIcon({
        html: hubIconHtml,
        className: 'custom-hub-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([hubLat, hubLng], { icon: hubCustomIcon })
        .bindPopup(`
          <div style="font-family: Outfit, sans-serif; min-width: 140px;">
            <strong style="font-size: 11px; color: #FF634A;">CENTRAL HUB ${hubName.toUpperCase()}</strong><br>
            <span style="font-size: 10px; color: #71717A;">Gudang & Titik Distribusi Utama</span>
          </div>
        `)
        .addTo(layerGroup);
    }

    // 1. Render Protocol Roads (Oranye / Amber Dashed)
    if (protocolRoadsGeoJson?.features) {
      L.geoJSON(protocolRoadsGeoJson, {
        style: {
          color: '#F59E0B',
          weight: 2,
          dashArray: '4, 4',
          opacity: 0.8,
        },
      }).addTo(layerGroup);
    }

    // 2. Render Toll Roads (Merah Terang Solid)
    if (tollRoadsGeoJson?.features) {
      L.geoJSON(tollRoadsGeoJson, {
        style: {
          color: '#EF4444',
          weight: 3.5,
          opacity: 0.9,
        },
      }).addTo(layerGroup);
    }

    // 3. Render Real Database Zones
    realZones.forEach((z) => {
      const latLngs = parsePolygonToLatLngs(z.polygon);
      if (latLngs.length > 2) {
        const poly = L.polygon(latLngs, {
          color: z.status === 'RESTRICTED' ? '#EF4444' : '#FF634A',
          fillColor: z.status === 'RESTRICTED' ? '#EF4444' : '#FF634A',
          fillOpacity: 0.3,
          weight: 2,
        }).bindPopup(`
          <div style="font-family: Outfit, sans-serif;">
            <strong style="font-size: 11px; color: #FF634A;">${z.name}</strong><br>
            <span style="font-size: 10px; color: #71717A;">Kapasitas: ${z.max_capacity} Armada</span>
          </div>
        `);
        poly.addTo(layerGroup);
      }
    });

    // 4. Render Real Riders
    activeRiders.forEach((r) => {
      const isBreach = r.status === 'BREACH';
      const iconHtml = `
        <div style="background-color: ${isBreach ? '#EF4444' : '#10B981'}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #FFFFFF; box-shadow: 0 0 6px ${isBreach ? 'rgba(239,68,68,0.8)' : 'rgba(16,185,129,0.8)'};"></div>
      `;
      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-mini-rider-marker',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      L.marker([r.latitude, r.longitude], { icon: customIcon })
        .bindPopup(`
          <div style="font-family: Outfit, sans-serif;">
            <strong style="font-size: 11px;">${r.name}</strong><br>
            <span style="font-size: 10px; color: #71717A;">Status: ${r.status || 'Active'}</span>
          </div>
        `)
        .addTo(layerGroup);
    });

    layerGroup.addTo(mapInstance);

    const bounds = layerGroup.getBounds();
    if (bounds.isValid()) {
      mapInstance.fitBounds(bounds, { padding: [15, 15] });
    } else {
      const hubLat = zoneConfig?.hub_latitude || -7.2575;
      const hubLng = zoneConfig?.hub_longitude || 112.7521;
      mapInstance.setView([hubLat, hubLng], 13);
    }
  };

  onMount(async () => {
    if (typeof window === 'undefined' || !mapContainer) return;

    try {
      L = (await import('leaflet')).default;

      mapInstance = L.map(mapContainer, {
        zoomControl: false,
        attributionControl: false,
      }).setView([-7.2575, 112.7521], 13);

      const { layer } = createBasemapLayer(L, 'openmaptiles-dark');
      layer.addTo(mapInstance);

      const [zonesData, ridersData, protoRoads, tollRoads, configData] = await Promise.allSettled([
        mapService.getAllZones(),
        mapService.getNearbyRiders(),
        mapService.getProtocolRoads(),
        mapService.getTollRoads(),
        mapService.getZoneConfig(),
      ]);

      if (zonesData.status === 'fulfilled') realZones = zonesData.value;
      if (ridersData.status === 'fulfilled') activeRiders = ridersData.value;
      if (protoRoads.status === 'fulfilled') protocolRoadsGeoJson = protoRoads.value;
      if (tollRoads.status === 'fulfilled') tollRoadsGeoJson = tollRoads.value;
      if (configData.status === 'fulfilled') zoneConfig = configData.value;

      renderMapLayers();
    } catch (err) {
      console.error('💥 Error initializing Mini-Map:', err);
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
    }
  });
</script>

<div class="card-dark p-4 sm:p-5 flex flex-col justify-between h-full font-outfit-400">
  <!-- Header: Title & Fullscreen Button -->
  <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center justify-center">
        <i class="ri-map-pin-2-line text-lg"></i>
      </div>
      <div>
        <h4 class="text-sm font-outfit-600 text-white leading-none">Mini-Map Sebaran Live</h4>
        <p class="text-[11px] text-[#A1A1AA] mt-1 leading-none">
          Poligon zona PostGIS, 885 jalan protokol & 692 jalan tol
        </p>
      </div>
    </div>

    <!-- Full Map Pill Button -->
    <button
      onclick={onOpenFullMap}
      class="pill-btn-white text-xs font-outfit-600"
    >
      <span class="px-3 py-1.5 flex items-center gap-1.5 text-[#09090B]">
        <i class="ri-fullscreen-line text-sm"></i>
        <span>Peta Penuh</span>
      </span>
    </button>
  </div>

  <!-- Map Container with Dark Frame -->
  <div class="relative w-full h-44 sm:h-52 my-3 rounded-2xl overflow-hidden border border-[#24242A]">
    {#if loading}
      <div class="w-full h-full flex items-center justify-center bg-[#131316] text-xs text-[#71717A] animate-pulse">
        Memuat lapisan peta sebaran PostGIS...
      </div>
    {/if}
    <div bind:this={mapContainer} class="w-full h-full"></div>

    <!-- GPS Signal Indicator Badge -->
    <div class="absolute bottom-2.5 left-2.5 z-20 px-2.5 py-1 rounded-full bg-[#131316]/90 backdrop-blur-md border border-[#24242A] text-[10px] font-outfit-600 text-white flex items-center gap-1.5 shadow-lg">
      <span class="w-2 h-2 rounded-full {activeRiders.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}"></span>
      <span>{activeRiders.length} Sinyal GPS Terdeteksi</span>
    </div>
  </div>

  <!-- Footer Info & CTA Link -->
  <div class="pt-2 border-t border-[#24242A] flex items-center justify-between text-xs">
    <span class="text-[#A1A1AA] text-[11px]">
      Total Zona: <strong class="text-white font-outfit-600">{realZones.length} Wilayah PostGIS</strong>
    </span>

    <button
      onclick={onOpenFullMap}
      class="text-[#FF634A] hover:text-[#FF8573] text-[11px] font-outfit-600 flex items-center gap-1 transition-colors cursor-pointer"
    >
      <span>Pusat Komando</span>
      <i class="ri-arrow-right-line"></i>
    </button>
  </div>
</div>
