<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Search, MapPin, Navigation, Loader2, Layers, Check, Globe, RotateCcw, Trash2, X } from 'lucide-svelte';
  import { createBasemapLayer } from '../../lib/mapProviders';
  import { mapService, type GeocodeResult } from '../../services/mapService';

  interface Props {
    lat: number;
    lng: number;
    address?: string;
    onLocationChange?: (info: { lat: number; lng: number; displayName: string; city?: string; timezone?: string }) => void;
    onClear?: () => void;
  }

  let {
    lat = $bindable(0),
    lng = $bindable(0),
    address = $bindable(''),
    onLocationChange,
    onClear,
  }: Props = $props();

  let mapContainer: HTMLDivElement;
  let mapInstance: any = null;
  let currentTileLayer: any = null;
  let markerInstance: any = null;
  let isMapReady = $state(false);

  // Active basemap (Default: OpenStreetMap Standar)
  let activeBasemapId = $state<'osm-standard' | 'openmaptiles-streets' | 'openmaptiles-dark' | 'openmaptiles-satellite'>('osm-standard');
  let isBasemapMenuOpen = $state(false);

  // Search & Geocoding state
  let searchQuery = $state('');
  let isSearching = $state(false);
  let searchResults = $state<GeocodeResult[]>([]);
  let isSearchDropdownOpen = $state(false);
  let searchDebounceTimer: any = null;
  let isLocatingUser = $state(false);
  let isReverseGeocoding = $state(false);
  let locationError = $state<string | null>(null);

  // Default fallback center: Indonesia (Surabaya / Java area)
  const DEFAULT_FALLBACK_LAT = -7.2575;
  const DEFAULT_FALLBACK_LNG = 112.7521;
  const DEFAULT_ZOOM = 13;

  /**
   * Helper: Determine Indonesian timezone by longitude coordinate
   */
  export const determineTimezoneByLng = (longitude: number): string => {
    if (longitude < 115) return 'Asia/Jakarta'; // WIB (UTC+7)
    if (longitude >= 115 && longitude <= 125) return 'Asia/Makassar'; // WITA (UTC+8)
    return 'Asia/Jayapura'; // WIT (UTC+9)
  };

  const createHubIcon = (L: any) =>
    L.divIcon({
      className: 'hub-custom-pin',
      html: `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <div class="absolute w-10 h-10 rounded-full bg-[#FF634A]/30 animate-ping"></div>
          <div class="relative w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] border-2 border-white shadow-2xl shadow-[#FF634A]/60 flex items-center justify-center text-white cursor-grab active:cursor-grabbing hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

  const initMap = async () => {
    if (typeof window === 'undefined' || !mapContainer) return;

    const L = (window as any).L;
    if (!L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.crossOrigin = '';
      script.onload = () => initMap();
      document.head.appendChild(script);
      return;
    }

    // Determine initial coordinates
    const hasValidCoords = lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);
    const centerLat = hasValidCoords ? lat : DEFAULT_FALLBACK_LAT;
    const centerLng = hasValidCoords ? lng : DEFAULT_FALLBACK_LNG;
    const zoomLevel = hasValidCoords ? 15 : 12;

    mapInstance = L.map(mapContainer, {
      center: [centerLat, centerLng],
      zoom: zoomLevel,
      zoomControl: true,
      attributionControl: true,
    });

    // Basemap: Default bawaan OpenStreetMap
    const { layer } = createBasemapLayer(L, activeBasemapId);
    currentTileLayer = layer;
    currentTileLayer.addTo(mapInstance);

    if (hasValidCoords) {
      markerInstance = L.marker([lat, lng], {
        icon: createHubIcon(L),
        draggable: true,
      }).addTo(mapInstance);

      markerInstance.on('dragend', async (e: any) => {
        const pos = e.target.getLatLng();
        await handleCoordinatesUpdated(pos.lat, pos.lng, true);
      });
    }

    // Click map to reposition marker & reverse geocode
    mapInstance.on('click', async (e: any) => {
      const { lat: clickedLat, lng: clickedLng } = e.latlng;
      if (!markerInstance) {
        markerInstance = L.marker([clickedLat, clickedLng], {
          icon: createHubIcon(L),
          draggable: true,
        }).addTo(mapInstance);

        markerInstance.on('dragend', async (ev: any) => {
          const pos = ev.target.getLatLng();
          await handleCoordinatesUpdated(pos.lat, pos.lng, true);
        });
      } else {
        markerInstance.setLatLng([clickedLat, clickedLng]);
      }
      await handleCoordinatesUpdated(clickedLat, clickedLng, true);
    });

    isMapReady = true;
    setTimeout(() => {
      mapInstance?.invalidateSize();
    }, 250);
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

  /**
   * Central coordinates & address update pipeline (Two-Way Sync)
   */
  export const handleCoordinatesUpdated = async (
    newLat: number,
    newLng: number,
    triggerReverseGeocode = false,
    presetDisplayName?: string,
    presetCity?: string
  ) => {
    lat = parseFloat(newLat.toFixed(6));
    lng = parseFloat(newLng.toFixed(6));
    locationError = null;

    const detectedTimezone = determineTimezoneByLng(lng);
    let resolvedAddress = presetDisplayName || address;
    let resolvedCity = presetCity || '';

    if (triggerReverseGeocode) {
      isReverseGeocoding = true;
      try {
        const geoInfo = await mapService.reverseGeocode(lat, lng);
        if (geoInfo) {
          resolvedAddress = geoInfo.displayName;
          resolvedCity = geoInfo.city || '';
          address = resolvedAddress;
          searchQuery = resolvedAddress.split(',')[0];
        }
      } catch (err) {
        console.warn('Gagal reverse geocode koordinat:', err);
      } finally {
        isReverseGeocoding = false;
      }
    }

    if (onLocationChange) {
      onLocationChange({
        lat,
        lng,
        displayName: resolvedAddress,
        city: resolvedCity,
        timezone: detectedTimezone,
      });
    }
  };

  /**
   * Fly to coordinates programmatically from address field or search
   */
  export const flyToLocation = (targetLat: number, targetLng: number, targetAddress?: string, targetCity?: string) => {
    if (!mapInstance) return;
    const L = (window as any).L;

    mapInstance.flyTo([targetLat, targetLng], 16, { duration: 1.2 });

    if (!markerInstance) {
      markerInstance = L.marker([targetLat, targetLng], {
        icon: createHubIcon(L),
        draggable: true,
      }).addTo(mapInstance);

      markerInstance.on('dragend', async (e: any) => {
        const pos = e.target.getLatLng();
        await handleCoordinatesUpdated(pos.lat, pos.lng, true);
      });
    } else {
      markerInstance.setLatLng([targetLat, targetLng]);
    }

    handleCoordinatesUpdated(targetLat, targetLng, false, targetAddress, targetCity);
  };

  /**
   * Clear marker, coordinates, search query and reset map view
   */
  export const clearLocation = () => {
    if (markerInstance && mapInstance) {
      mapInstance.removeLayer(markerInstance);
      markerInstance = null;
    }
    lat = 0;
    lng = 0;
    address = '';
    searchQuery = '';
    searchResults = [];
    isSearchDropdownOpen = false;
    locationError = null;

    if (mapInstance) {
      mapInstance.flyTo([DEFAULT_FALLBACK_LAT, DEFAULT_FALLBACK_LNG], 12, { duration: 1.0 });
    }

    if (onLocationChange) {
      onLocationChange({
        lat: 0,
        lng: 0,
        displayName: '',
        city: '',
        timezone: 'Asia/Jakarta',
      });
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
    }, 350);
  };

  const selectSearchResult = (item: GeocodeResult) => {
    const itemLat = parseFloat(item.lat);
    const itemLng = parseFloat(item.lon);
    if (isNaN(itemLat) || isNaN(itemLng)) return;

    searchQuery = item.display_name.split(',')[0];
    address = item.display_name;
    isSearchDropdownOpen = false;

    // Extract city if not directly attached
    let extractedCity = item.city || '';
    if (!extractedCity) {
      const parts = item.display_name.split(',').map((s) => s.trim());
      for (const p of parts) {
        const clean = p.replace(/^(Kota|Kabupaten|Kab\.|Kota Administrasi)\s+/i, '').trim();
        if (clean && !clean.match(/^\d+$/) && clean.length > 2) {
          if (
            ['Surabaya', 'Sidoarjo', 'Malang', 'Pasuruan', 'Gresik', 'Mojokerto', 'Jakarta', 'Bandung', 'Semarang', 'Yogyakarta', 'Denpasar', 'Medan', 'Makassar', 'Bekasi', 'Tangerang', 'Depok', 'Bogor'].some(
              (c) => c.toLowerCase() === clean.toLowerCase()
            )
          ) {
            extractedCity = clean;
            break;
          }
        }
      }
    }

    flyToLocation(itemLat, itemLng, item.display_name, extractedCity);

    if (onLocationChange) {
      onLocationChange({
        lat: itemLat,
        lng: itemLng,
        displayName: item.display_name,
        city: extractedCity,
        timezone: determineTimezoneByLng(itemLng),
      });
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      locationError = 'Browser Anda tidak mendukung layanan deteksi geolokasi.';
      return;
    }

    isLocatingUser = true;
    locationError = null;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        isLocatingUser = false;

        flyToLocation(userLat, userLng);
        await handleCoordinatesUpdated(userLat, userLng, true);
      },
      (err) => {
        isLocatingUser = false;
        locationError = 'Gagal mengakses GPS: ' + (err.message || 'Izin lokasi ditolak');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
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

<div class="space-y-3 relative z-30">
  <!-- Search Bar, Limitation Badge & Geolocate Action Bar -->
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 relative z-50">
    
    <!-- Location Search Autocomplete (High Stacking Context z-[1000]) -->
    <div class="relative flex-1 z-[1000]">
      <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
      <input
        type="text"
        bind:value={searchQuery}
        oninput={handleSearchInput}
        placeholder="Cari jalan, tempat, atau kelurahan di Indonesia..."
        class="w-full pl-10 pr-16 py-3 bg-[#18181D] border border-[#272730] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]/60 focus:ring-2 focus:ring-[#FF634A]/20 transition-all shadow-lg"
      />
      
      <!-- Right Action Icons (Clear / Loader) -->
      <div class="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {#if searchQuery}
          <button
            type="button"
            onclick={() => { searchQuery = ''; searchResults = []; isSearchDropdownOpen = false; }}
            class="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Hapus kata kunci"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        {/if}
        {#if isSearching}
          <Loader2 class="w-4 h-4 text-[#FF634A] animate-spin" />
        {/if}
      </div>

      <!-- Search Suggestions Dropdown with Super High Z-Index above Map -->
      {#if isSearchDropdownOpen && searchResults.length > 0}
        <div class="absolute left-0 right-0 top-full mt-1.5 bg-[#18181D] border border-white/10 rounded-2xl shadow-2xl z-[2000] max-h-60 overflow-y-auto divide-y divide-[#272730] backdrop-blur-2xl ring-1 ring-black/50">
          <div class="px-3 py-1.5 bg-[#121214] border-b border-white/5 flex items-center justify-between text-[10px] text-zinc-400">
            <span class="flex items-center gap-1 font-mono">
              <Globe class="w-3 h-3 text-[#FF634A]" /> Hasil Pencarian Indonesia
            </span>
            <span class="text-[9px] text-zinc-500">Pilih lokasi acuan</span>
          </div>
          {#each searchResults as item}
            <button
              type="button"
              onclick={() => selectSearchResult(item)}
              class="w-full text-left px-3.5 py-2.5 hover:bg-[#24242A] transition-colors flex items-start gap-2.5 group cursor-pointer"
            >
              <MapPin class="w-4 h-4 text-[#FF634A] shrink-0 mt-0.5" />
              <div class="min-w-0 flex-1">
                <p class="text-xs sm:text-sm font-medium text-zinc-200 group-hover:text-white truncate">
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

    <!-- Geolocation Action Button -->
    <button
      type="button"
      onclick={handleUseCurrentLocation}
      disabled={isLocatingUser}
      class="px-4 py-3 bg-[#18181D] hover:bg-[#24242A] border border-[#272730] hover:border-zinc-600 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50 shadow-lg"
    >
      {#if isLocatingUser}
        <Loader2 class="w-4 h-4 text-[#FF634A] animate-spin" />
        <span>Mendeteksi Lokasi...</span>
      {:else}
        <Navigation class="w-4 h-4 text-[#FF634A]" />
        <span>Gunakan Lokasi Saya</span>
      {/if}
    </button>
  </div>

  <!-- Regional Limitation Notice & Pin Status Badge -->
  <div class="flex items-center justify-between px-1 text-[11px] text-zinc-400">
    <div class="flex items-center gap-1.5">
      <span class="inline-block w-2 h-2 rounded-full bg-[#FF634A]"></span>
      <span>Cakupan pencarian dibatasi wilayah <strong>Indonesia (ID)</strong></span>
    </div>
    <span class="text-[10px] text-zinc-500 font-mono hidden sm:inline">Peta OSM Standar</span>
  </div>

  {#if locationError}
    <div class="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-300">
      <span class="text-rose-400">•</span>
      <span>{locationError}</span>
    </div>
  {/if}

  <!-- Interactive Leaflet Map Container -->
  <div class="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-[#272730] shadow-inner bg-[#121214] z-10">
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

    <!-- Live Status / Hint Overlay -->
    <div class="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto bg-[#18181D]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-zinc-300 flex items-center gap-2 pointer-events-none z-[400]">
      {#if isReverseGeocoding}
        <Loader2 class="w-3.5 h-3.5 text-[#FF634A] animate-spin shrink-0" />
        <span>Mengidentifikasi detail alamat titik peta...</span>
      {:else}
        <MapPin class="w-3.5 h-3.5 text-[#FF634A] shrink-0" />
        <span>Klik peta atau geser marker untuk menyesuaikan lokasi tepat</span>
      {/if}
    </div>
  </div>

  <!-- Realtime Coordinate & Sync Badge Bar with Clear Button inside -->
  <div class="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-[#18181D] border border-[#272730] rounded-xl text-xs">
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full {lat !== 0 && lng !== 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}"></span>
      <span class="text-[11px] text-zinc-400">Koordinat Terpilih:</span>
      {#if lat !== 0 && lng !== 0}
        <span class="font-mono text-[11px] text-zinc-200 tracking-tight font-medium">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </span>
      {:else}
        <span class="text-[11px] text-amber-300/80 italic">
          Belum ditentukan (klik peta atau gunakan pencarian)
        </span>
      {/if}
    </div>

    {#if (lat !== 0 && lng !== 0) || address}
      <button
        type="button"
        onclick={() => {
          if (onClear) {
            onClear();
          } else {
            clearLocation();
          }
        }}
        class="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ml-auto"
        title="Bersihkan pin peta dan seluruh kolom input lokasi"
      >
        <RotateCcw class="w-3.5 h-3.5 text-rose-400" />
        <span>Clear Pin & Lokasi</span>
      </button>
    {/if}
  </div>
</div>
