<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Radio, Info, Layers, Check } from 'lucide-svelte';
  import { createBasemapLayer } from '../../lib/mapProviders';

  interface Props {
    hubLat: number;
    hubLng: number;
    hubName?: string;
    radiusKm: number;
  }

  let {
    hubLat = 0,
    hubLng = 0,
    hubName = 'Central Hub',
    radiusKm = 12,
  }: Props = $props();

  let mapContainer: HTMLDivElement;
  let mapInstance: any = null;
  let currentTileLayer: any = null;
  let hubMarkerInstance: any = null;
  let radiusCircleInstance: any = null;
  let isMapReady = $state(false);

  // Active basemap (Default: OpenStreetMap Standar, matching SystemIdentityStep)
  let activeBasemapId = $state<'osm-standard' | 'openmaptiles-streets' | 'openmaptiles-dark' | 'openmaptiles-satellite'>('osm-standard');
  let isBasemapMenuOpen = $state(false);

  const initMap = () => {
    if (typeof window === 'undefined' || !mapContainer) return;

    const L = (window as any).L;
    if (!L) {
      setTimeout(initMap, 150);
      return;
    }

    const hasValidCoords = hubLat !== 0 && hubLng !== 0 && !isNaN(hubLat) && !isNaN(hubLng);
    const centerLat = hasValidCoords ? hubLat : -7.2575;
    const centerLng = hasValidCoords ? hubLng : 112.7521;

    mapInstance = L.map(mapContainer, {
      center: [centerLat, centerLng],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    // Basemap: Default OpenStreetMap Standar
    const { layer } = createBasemapLayer(L, activeBasemapId);
    currentTileLayer = layer;
    currentTileLayer.addTo(mapInstance);

    if (hasValidCoords) {
      // Hub marker
      const hubIcon = L.divIcon({
        className: 'hub-radius-pin',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] border-2 border-white shadow-xl shadow-[#FF634A]/50 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      hubMarkerInstance = L.marker([hubLat, hubLng], { icon: hubIcon }).addTo(mapInstance);
      hubMarkerInstance.bindTooltip(`<b>${hubName}</b>`, {
        permanent: false,
        direction: 'top',
        className: 'custom-leaflet-tooltip',
      });

      // Operational radius circle
      updateCircle(radiusKm);
    }

    isMapReady = true;
    setTimeout(() => {
      mapInstance?.invalidateSize();
    }, 200);
  };

  /**
   * Switch basemap layer dynamically
   */
  const switchBasemap = (providerId: 'osm-standard' | 'openmaptiles-streets' | 'openmaptiles-dark' | 'openmaptiles-satellite') => {
    if (!mapInstance) return;
    const L = (window as any).L;
    if (!L) return;

    if (currentTileLayer) {
      mapInstance.removeLayer(currentTileLayer);
    }

    activeBasemapId = providerId;
    const { layer } = createBasemapLayer(L, providerId);
    currentTileLayer = layer;
    currentTileLayer.addTo(mapInstance);
    isBasemapMenuOpen = false;
  };

  const updateCircle = (km: number) => {
    if (!mapInstance) return;
    const L = (window as any).L;
    if (!L) return;

    const meters = Math.max(100, (km || 1) * 1000);

    if (radiusCircleInstance) {
      radiusCircleInstance.setRadius(meters);
      radiusCircleInstance.setLatLng([hubLat, hubLng]);
    } else if (hubLat !== 0 && hubLng !== 0) {
      radiusCircleInstance = L.circle([hubLat, hubLng], {
        radius: meters,
        color: '#FF634A',
        weight: 2,
        dashArray: '5, 8',
        fillColor: '#FF634A',
        fillOpacity: 0.12,
      }).addTo(mapInstance);
    }

    if (radiusCircleInstance) {
      const bounds = radiusCircleInstance.getBounds();
      mapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 15, animate: true });
    }
  };

  // Re-run circle update whenever radiusKm changes
  $effect(() => {
    if (isMapReady && radiusKm > 0) {
      updateCircle(radiusKm);
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

    <!-- Map Layer Switcher Floating Button -->
    <div class="absolute top-2.5 right-2.5 z-[400]">
      <div class="relative">
        <button
          type="button"
          onclick={() => (isBasemapMenuOpen = !isBasemapMenuOpen)}
          class="p-2 rounded-xl bg-[#18181D]/90 hover:bg-[#24242A] border border-white/10 text-zinc-300 hover:text-white shadow-lg backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium"
          title="Ganti Layer Peta"
        >
          <Layers class="w-3.5 h-3.5 text-[#FF634A]" />
          <span class="text-[11px] hidden sm:inline">
            {activeBasemapId === 'osm-standard' ? 'OpenStreetMap' : activeBasemapId === 'openmaptiles-dark' ? 'Dark Mode' : 'Satelit'}
          </span>
        </button>

        {#if isBasemapMenuOpen}
          <div class="absolute right-0 top-full mt-1 w-48 bg-[#18181D]/95 border border-[#272730] rounded-xl shadow-2xl backdrop-blur-xl p-1.5 space-y-1 z-[500]">
            <button
              type="button"
              onclick={() => switchBasemap('osm-standard')}
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer {activeBasemapId === 'osm-standard' ? 'bg-[#FF634A]/15 text-[#FF8573]' : 'text-zinc-300 hover:bg-white/5'}"
            >
              <span>OpenStreetMap (Bawaan)</span>
              {#if activeBasemapId === 'osm-standard'}
                <Check class="w-3 h-3 text-[#FF634A]" />
              {/if}
            </button>
            <button
              type="button"
              onclick={() => switchBasemap('openmaptiles-streets')}
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer {activeBasemapId === 'openmaptiles-streets' ? 'bg-[#FF634A]/15 text-[#FF8573]' : 'text-zinc-300 hover:bg-white/5'}"
            >
              <span>Streets (OpenMapTiles)</span>
              {#if activeBasemapId === 'openmaptiles-streets'}
                <Check class="w-3 h-3 text-[#FF634A]" />
              {/if}
            </button>
            <button
              type="button"
              onclick={() => switchBasemap('openmaptiles-dark')}
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer {activeBasemapId === 'openmaptiles-dark' ? 'bg-[#FF634A]/15 text-[#FF8573]' : 'text-zinc-300 hover:bg-white/5'}"
            >
              <span>Dark Matter (OpenMapTiles)</span>
              {#if activeBasemapId === 'openmaptiles-dark'}
                <Check class="w-3 h-3 text-[#FF634A]" />
              {/if}
            </button>
            <button
              type="button"
              onclick={() => switchBasemap('openmaptiles-satellite')}
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer {activeBasemapId === 'openmaptiles-satellite' ? 'bg-[#FF634A]/15 text-[#FF8573]' : 'text-zinc-300 hover:bg-white/5'}"
            >
              <span>Satelit (OpenMapTiles)</span>
              {#if activeBasemapId === 'openmaptiles-satellite'}
                <Check class="w-3 h-3 text-[#FF634A]" />
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Live Radius Badge Overlay -->
    <div class="absolute top-3 left-3 bg-[#18181D]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs flex items-center gap-2 z-[400]">
      <Radio class="w-3.5 h-3.5 text-[#FF634A] animate-pulse" />
      <span class="text-zinc-300">Cakupan Area:</span>
      <span class="font-outfit-700 text-white font-mono">{radiusKm} KM</span>
    </div>

    <!-- Microcopy Hint Overlay -->
    <div class="absolute bottom-2.5 left-2.5 right-2.5 bg-[#18181D]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[11px] text-zinc-300 flex items-center gap-2 pointer-events-none z-[400]">
      <Info class="w-3.5 h-3.5 text-[#FF634A] shrink-0" />
      <span>Radius ini menjadi batas referensi awal analisis dan rekomendasi operasional.</span>
    </div>
  </div>
</div>
