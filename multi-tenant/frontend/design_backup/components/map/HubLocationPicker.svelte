<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Search, MapPin, Navigation, Loader2 } from 'lucide-svelte';
  import { createBasemapLayer } from '../../lib/mapProviders';
  import { mapService, type GeocodeResult } from '../../services/mapService';

  interface Props {
    lat: number;
    lng: number;
    address?: string;
    onLocationChange?: (coords: { lat: number; lng: number; displayName?: string }) => void;
  }

  let {
    lat = $bindable(0),
    lng = $bindable(0),
    address = '',
    onLocationChange,
  }: Props = $props();

  let mapContainer: HTMLDivElement;
  let mapInstance: any = null;
  let markerInstance: any = null;
  let isMapReady = $state(false);

  // Search state
  let searchQuery = $state('');
  let isSearching = $state(false);
  let searchResults = $state<GeocodeResult[]>([]);
  let isSearchDropdownOpen = $state(false);
  let searchDebounceTimer: any = null;
  let isLocatingUser = $state(false);
  let locationError = $state<string | null>(null);

  // Default fallback center: Indonesia (Jakarta / Central Java area) if coordinates not yet picked
  const DEFAULT_FALLBACK_LAT = -7.2575;
  const DEFAULT_FALLBACK_LNG = 112.7521;
  const DEFAULT_ZOOM = 13;

  const initMap = async () => {
    if (typeof window === 'undefined' || !mapContainer) return;

    const L = (window as any).L;
    if (!L) {
      // Dynamic load Leaflet script if not present
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.crossOrigin = '';
      script.onload = () => initMap();
      document.head.appendChild(script);
      return;
    }

    // Determine initial center
    const hasValidCoords = lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);
    const centerLat = hasValidCoords ? lat : DEFAULT_FALLBACK_LAT;
    const centerLng = hasValidCoords ? lng : DEFAULT_FALLBACK_LNG;
    const zoomLevel = hasValidCoords ? 14 : 11;

    mapInstance = L.map(mapContainer, {
      center: [centerLat, centerLng],
      zoom: zoomLevel,
      zoomControl: true,
      attributionControl: false,
    });

    // Basemap: OpenMapTiles Dark Matter as Single Source of Truth
    const { layer } = createBasemapLayer(L, 'openmaptiles-dark');
    layer.addTo(mapInstance);

    // Custom Hub Marker Pin
    const createHubIcon = () =>
      L.divIcon({
        className: 'hub-custom-pin',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 rounded-full bg-[#FF634A]/25 animate-ping"></div>
            <div class="relative w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] border-2 border-white shadow-xl shadow-[#FF634A]/50 flex items-center justify-center text-white cursor-grab active:cursor-grabbing">
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

    if (hasValidCoords) {
      markerInstance = L.marker([lat, lng], {
        icon: createHubIcon(),
        draggable: true,
      }).addTo(mapInstance);

      markerInstance.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        updateCoordinates(pos.lat, pos.lng);
      });
    }

    // Map Click: place/move marker
    mapInstance.on('click', (e: any) => {
      const { lat: clickedLat, lng: clickedLng } = e.latlng;
      if (!markerInstance) {
        markerInstance = L.marker([clickedLat, clickedLng], {
          icon: createHubIcon(),
          draggable: true,
        }).addTo(mapInstance);

        markerInstance.on('dragend', (ev: any) => {
          const pos = ev.target.getLatLng();
          updateCoordinates(pos.lat, pos.lng);
        });
      } else {
        markerInstance.setLatLng([clickedLat, clickedLng]);
      }
      updateCoordinates(clickedLat, clickedLng);
    });

    isMapReady = true;
    setTimeout(() => {
      mapInstance?.invalidateSize();
    }, 200);
  };

  const updateCoordinates = (newLat: number, newLng: number, displayName?: string) => {
    lat = parseFloat(newLat.toFixed(6));
    lng = parseFloat(newLng.toFixed(6));
    locationError = null;

    if (onLocationChange) {
      onLocationChange({ lat, lng, displayName });
    }
  };

  const handleSearchInput = () => {
    locationError = null;
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (!searchQuery || searchQuery.trim().length < 2) {
      searchResults = [];
      isSearchDropdownOpen = false;
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      isSearching = true;
      try {
        searchResults = await mapService.searchLocation(searchQuery);
        isSearchDropdownOpen = searchResults.length > 0;
      } catch {
        searchResults = [];
      } finally {
        isSearching = false;
      }
    }, 400);
  };

  const selectSearchResult = (item: GeocodeResult) => {
    const itemLat = parseFloat(item.lat);
    const itemLng = parseFloat(item.lon);
    if (isNaN(itemLat) || isNaN(itemLng)) return;

    searchQuery = item.display_name.split(',')[0];
    isSearchDropdownOpen = false;

    if (mapInstance) {
      mapInstance.flyTo([itemLat, itemLng], 15, { duration: 1.2 });
      if (!markerInstance) {
        const L = (window as any).L;
        const createHubIcon = () =>
          L.divIcon({
            className: 'hub-custom-pin',
            html: `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-8 h-8 rounded-full bg-[#FF634A]/25 animate-ping"></div>
                <div class="relative w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] border-2 border-white shadow-xl shadow-[#FF634A]/50 flex items-center justify-center text-white cursor-grab">
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

        markerInstance = L.marker([itemLat, itemLng], {
          icon: createHubIcon(),
          draggable: true,
        }).addTo(mapInstance);

        markerInstance.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          updateCoordinates(pos.lat, pos.lng);
        });
      } else {
        markerInstance.setLatLng([itemLat, itemLng]);
      }
    }

    updateCoordinates(itemLat, itemLng, item.display_name);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      locationError = 'Browser Anda tidak mendukung layanan geolokasi.';
      return;
    }

    isLocatingUser = true;
    locationError = null;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        isLocatingUser = false;

        if (mapInstance) {
          mapInstance.flyTo([userLat, userLng], 15, { duration: 1.2 });
          if (markerInstance) {
            markerInstance.setLatLng([userLat, userLng]);
          } else {
            const L = (window as any).L;
            markerInstance = L.marker([userLat, userLng], {
              draggable: true,
            }).addTo(mapInstance);
          }
        }
        updateCoordinates(userLat, userLng);
      },
      (err) => {
        isLocatingUser = false;
        locationError = 'Gagal mengambil lokasi perangkat: ' + err.message;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  onMount(() => {
    initMap();
  });

  onDestroy(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });
</script>

<div class="space-y-3">
  <!-- Search Bar & Geolocate Action -->
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
    <!-- Location Search Autocomplete -->
    <div class="relative flex-1">
      <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
      <input
        type="text"
        bind:value={searchQuery}
        oninput={handleSearchInput}
        placeholder="Cari nama jalan, kelurahan, atau tengara kota..."
        class="w-full pl-10 pr-10 py-2.5 bg-[#18181D] border border-[#272730] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all"
      />
      {#if isSearching}
        <div class="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 class="w-3.5 h-3.5 text-zinc-400 animate-spin" />
        </div>
      {/if}

      <!-- Search Suggestions Dropdown -->
      {#if isSearchDropdownOpen && searchResults.length > 0}
        <div class="absolute left-0 right-0 top-full mt-1.5 bg-[#18181D] border border-[#272730] rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-[#272730]/50 backdrop-blur-xl">
          {#each searchResults as item}
            <button
              type="button"
              onclick={() => selectSearchResult(item)}
              class="w-full text-left px-3.5 py-2.5 hover:bg-[#24242A] transition-colors flex items-start gap-2.5 group cursor-pointer"
            >
              <MapPin class="w-4 h-4 text-[#FF634A] shrink-0 mt-0.5" />
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                  {item.display_name.split(',')[0]}
                </p>
                <p class="text-[10px] text-zinc-400 truncate">
                  {item.display_name}
                </p>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Geolocation Button -->
    <button
      type="button"
      onclick={handleUseCurrentLocation}
      disabled={isLocatingUser}
      class="px-3.5 py-2.5 bg-[#18181D] hover:bg-[#24242A] border border-[#272730] hover:border-zinc-600 rounded-xl text-xs font-outfit-600 text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
    >
      {#if isLocatingUser}
        <Loader2 class="w-3.5 h-3.5 text-[#FF634A] animate-spin" />
        <span>Mendeteksi...</span>
      {:else}
        <Navigation class="w-3.5 h-3.5 text-[#FF634A]" />
        <span>Gunakan Lokasi Saya</span>
      {/if}
    </button>
  </div>

  {#if locationError}
    <p class="text-[11px] text-rose-400 pl-1">{locationError}</p>
  {/if}

  <!-- Interactive Leaflet Map Container -->
  <div class="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-[#272730] shadow-inner bg-[#121214]">
    <div bind:this={mapContainer} class="w-full h-full"></div>

    <!-- Interactive Hint Overlay -->
    <div class="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto bg-[#18181D]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-zinc-300 flex items-center gap-2 pointer-events-none z-[400]">
      <MapPin class="w-3.5 h-3.5 text-[#FF634A] shrink-0" />
      <span>Klik peta atau seret marker untuk menyesuaikan lokasi tepat Central Hub</span>
    </div>
  </div>

  <!-- Readonly Coordinate Badges -->
  <div class="flex items-center justify-between px-3 py-2 bg-[#18181D] border border-[#272730] rounded-xl text-xs">
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full {lat !== 0 && lng !== 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}"></span>
      <span class="text-[11px] text-zinc-400">Koordinat Terpilih:</span>
    </div>
    {#if lat !== 0 && lng !== 0}
      <span class="font-mono text-[11px] text-zinc-200 tracking-tight">
        {lat.toFixed(6)}, {lng.toFixed(6)}
      </span>
    {:else}
      <span class="text-[11px] text-amber-300/80 italic">
        Belum ditentukan (klik peta atau gunakan pencarian)
      </span>
    {/if}
  </div>
</div>
