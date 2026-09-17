<script lang="ts">
  import { 
    Map, 
    Layers, 
    Sliders, 
    Eye, 
    EyeOff, 
    CloudSun, 
    Radio, 
    Compass, 
    ArrowRight, 
    ArrowLeft,
    Check
  } from 'lucide-svelte';
  import { setupStore } from '../../../lib/stores/setupStore.svelte';
  import { getBasemapProviders } from '../../../lib/mapProviders';
  import MapPreferencePreview from '../../../components/map/MapPreferencePreview.svelte';

  interface Props {
    onNext: () => void;
    onPrev: () => void;
  }

  let { onNext, onPrev }: Props = $props();

  const basemaps = getBasemapProviders().filter(
    (b) => ['osm-standard', 'openmaptiles-dark', 'openmaptiles-streets', 'openmaptiles-satellite', 'openmaptiles-outdoor'].includes(b.id)
  );

  const basemapMetadata: Record<string, { label: string; desc: string; previewBg: string }> = {
    'osm-standard': {
      label: 'OpenStreetMap',
      desc: 'Peta standar OSM global presisi (bawaan)',
      previewBg: 'bg-[#1e293b]',
    },
    'openmaptiles-dark': {
      label: 'Dark Matter',
      desc: 'Latar gelap kontras tinggi (OpenMapTiles)',
      previewBg: 'bg-[#18181D]',
    },
    'openmaptiles-streets': {
      label: 'Streets Standard',
      desc: 'Detail nama jalan & bangunan lengkap (OpenMapTiles)',
      previewBg: 'bg-[#1e293b]',
    },
    'openmaptiles-satellite': {
      label: 'Satelit Hybrid',
      desc: 'Citra foto udara bumi & label (OpenMapTiles)',
      previewBg: 'bg-[#0f172a]',
    },
    'openmaptiles-outdoor': {
      label: 'Outdoor & Kontur',
      desc: 'Detail elevasi & jalur aktivitas luar (OpenMapTiles)',
      previewBg: 'bg-[#1c1917]',
    },
  };
</script>

<div class="space-y-6">
  <!-- Step Header -->
  <div class="border-b border-[#24242A] pb-4">
    <div class="flex items-center gap-2 text-xs font-outfit-600 text-[#FF634A] tracking-wider uppercase">
      <span>Fase 04</span>
      <span>•</span>
      <span>Preferensi Peta</span>
    </div>
    <h2 class="text-xl sm:text-2xl font-outfit-700 text-white mt-1">
      Bagaimana Anda ingin melihat peta operasional MOVA?
    </h2>
    <p class="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
      Sesuaikan tema basemap utama dan layer yang otomatis aktif saat membuka sistem pemantauan.
    </p>
  </div>

  <!-- 1. LIVE MAP PREVIEW PANEL AT THE VERY TOP (EXPANSIVE FULL WIDTH) -->
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Pratinjau Interaktif Real-Time
      </h3>
      <span class="text-[11px] text-[#FF634A] font-mono">
        Tema Aktif: {basemapMetadata[setupStore.mapPreferences.basemapId]?.label || 'OpenStreetMap'}
      </span>
    </div>

    <MapPreferencePreview
      hubLat={setupStore.identity.centralHubLat}
      hubLng={setupStore.identity.centralHubLng}
      hubName={setupStore.identity.centralHubName}
      radiusKm={setupStore.operationalPolicy.operationalRadiusKm}
      basemapId={setupStore.mapPreferences.basemapId}
      zoomLevel={setupStore.mapPreferences.defaultZoom}
      showHubRadius={setupStore.mapPreferences.showHubRadius}
      showProtocolRoads={setupStore.mapPreferences.showProtocolRoads}
      showPoi={setupStore.mapPreferences.showPoi}
      showWeather={setupStore.mapPreferences.showWeather}
    />
  </div>

  <!-- 2. VISUAL BASEMAP THEME SELECTOR CARDS -->
  <div class="space-y-3 pt-2">
    <div class="flex items-center justify-between">
      <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide flex items-center gap-1.5">
        <Map class="w-3.5 h-3.5 text-[#FF634A]" />
        <span>Pilih Tema Basemap Default</span>
      </h3>
      <span class="text-[11px] text-zinc-400">
        Klik kartu untuk langsung mengubah tampilan peta di atas
      </span>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {#each basemaps as b}
        {@const meta = basemapMetadata[b.id] || { label: b.name, desc: '', previewBg: 'bg-[#18181D]' }}
        {@const isSelected = setupStore.mapPreferences.basemapId === b.id}
        <button
          type="button"
          onclick={() => (setupStore.mapPreferences.basemapId = b.id)}
          class="p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer group {isSelected ? 'bg-[#FF634A]/10 border-[#FF634A] shadow-lg shadow-[#FF634A]/15' : 'bg-[#18181D] border-[#272730] hover:border-zinc-600'}"
        >
          <div class="space-y-2">
            <!-- Simulated Tile Color Indicator -->
            <div class="w-full h-10 rounded-xl {meta.previewBg} border border-white/10 flex items-center justify-center relative overflow-hidden">
              <Map class="w-4 h-4 {isSelected ? 'text-[#FF634A]' : 'text-zinc-500 group-hover:text-zinc-400'}" />
              {#if isSelected}
                <div class="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#FF634A] text-white flex items-center justify-center text-[10px]">
                  <Check class="w-3 h-3 stroke-[3]" />
                </div>
              {/if}
            </div>

            <div>
              <p class="text-xs font-outfit-700 {isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}">
                {meta.label}
              </p>
              <p class="text-[10px] text-zinc-400 leading-tight mt-0.5 line-clamp-2">
                {meta.desc}
              </p>
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- 3. STARTUP LAYER CONTROLS & ZOOM SETTINGS (2-COLUMN GRID) -->
  <div class="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
    <!-- Zoom Setting (5 Cols) -->
    <div class="md:col-span-5 space-y-3 bg-[#18181D] border border-[#272730] p-4 rounded-2xl flex flex-col justify-between">
      <div class="space-y-1">
        <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide flex items-center gap-2">
          <Compass class="w-4 h-4 text-[#FF634A]" />
          <span>Level Zoom Awal Startup</span>
        </h3>
        <p class="text-[11px] text-zinc-400">
          Tingkat pembesaran kamera peta saat sistem pertama kali dibuka.
        </p>
      </div>

      <div class="space-y-2 bg-[#121214] p-3.5 rounded-xl border border-[#24242A]">
        <div class="flex items-center justify-between text-xs">
          <span class="text-zinc-300 font-outfit-600">Level Zoom:</span>
          <span class="font-mono text-[#FF634A] font-outfit-700">{setupStore.mapPreferences.defaultZoom}x</span>
        </div>
        <input
          type="range"
          min="11"
          max="16"
          step="1"
          bind:value={setupStore.mapPreferences.defaultZoom}
          class="w-full accent-[#FF634A] cursor-pointer"
        />
        <div class="flex justify-between text-[10px] text-zinc-400">
          <span>11x (Kota)</span>
          <span>13x (Kecamatan)</span>
          <span>16x (Jalan)</span>
        </div>
      </div>
    </div>

    <!-- Layer Toggles (7 Cols) -->
    <div class="md:col-span-7 space-y-3 bg-[#18181D] border border-[#272730] p-4 rounded-2xl">
      <div class="border-b border-[#24242A] pb-2">
        <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide flex items-center gap-2">
          <Layers class="w-4 h-4 text-[#FF634A]" />
          <span>Layer Aktif Saat Membuka Sistem</span>
        </h3>
        <p class="text-[11px] text-zinc-400 mt-0.5">
          Pilih elemen overlay peta yang otomatis tampil saat startup.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <!-- Hub Radius Toggle -->
        <label class="flex items-center justify-between p-2.5 rounded-xl bg-[#121214] border border-[#24242A] hover:border-zinc-700 cursor-pointer transition-all">
          <div class="flex items-center gap-2">
            <Radio class="w-4 h-4 text-[#FF634A] shrink-0" />
            <div>
              <p class="text-xs font-outfit-600 text-white">Radius Hub</p>
              <p class="text-[10px] text-zinc-400">{setupStore.operationalPolicy.operationalRadiusKm} KM</p>
            </div>
          </div>
          <input
            type="checkbox"
            bind:checked={setupStore.mapPreferences.showHubRadius}
            class="w-4 h-4 rounded accent-[#FF634A] cursor-pointer shrink-0"
          />
        </label>

        <!-- Protocol Roads Toggle -->
        <label class="flex items-center justify-between p-2.5 rounded-xl bg-[#121214] border border-[#24242A] hover:border-zinc-700 cursor-pointer transition-all">
          <div class="flex items-center gap-2">
            <Map class="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p class="text-xs font-outfit-600 text-white">Jalan Protokol</p>
              <p class="text-[10px] text-zinc-400">Koridor arteri</p>
            </div>
          </div>
          <input
            type="checkbox"
            bind:checked={setupStore.mapPreferences.showProtocolRoads}
            class="w-4 h-4 rounded accent-[#FF634A] cursor-pointer shrink-0"
          />
        </label>

        <!-- POI Layer Toggle -->
        <label class="flex items-center justify-between p-2.5 rounded-xl bg-[#121214] border border-[#24242A] hover:border-zinc-700 cursor-pointer transition-all">
          <div class="flex items-center gap-2">
            <Layers class="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <p class="text-xs font-outfit-600 text-white">Marker POI</p>
              <p class="text-[10px] text-zinc-400">Titik acuan penting</p>
            </div>
          </div>
          <input
            type="checkbox"
            bind:checked={setupStore.mapPreferences.showPoi}
            class="w-4 h-4 rounded accent-[#FF634A] cursor-pointer shrink-0"
          />
        </label>

        <!-- Weather Overlay Toggle -->
        <label class="flex items-center justify-between p-2.5 rounded-xl bg-[#121214] border border-[#24242A] hover:border-zinc-700 cursor-pointer transition-all">
          <div class="flex items-center gap-2">
            <CloudSun class="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p class="text-xs font-outfit-600 text-white">Cuaca Wilayah</p>
              <p class="text-[10px] text-zinc-400">Open-Meteo</p>
            </div>
          </div>
          <input
            type="checkbox"
            bind:checked={setupStore.mapPreferences.showWeather}
            class="w-4 h-4 rounded accent-[#FF634A] cursor-pointer shrink-0"
          />
        </label>
      </div>
    </div>
  </div>

  <!-- Wizard Navigation Actions -->
  <div class="pt-4 flex items-center justify-between gap-3">
    <button
      type="button"
      onclick={onPrev}
      class="px-5 py-2.5 rounded-xl text-xs font-outfit-600 text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer"
    >
      <ArrowLeft class="w-4 h-4" />
      <span>Kembali</span>
    </button>
    <button
      type="button"
      onclick={onNext}
      class="px-6 py-3 bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] text-white rounded-xl text-xs sm:text-sm font-outfit-700 shadow-lg shadow-[#FF634A]/25 transition-all flex items-center gap-2 cursor-pointer"
    >
      <span>Lanjutkan ke Model DSS</span>
      <ArrowRight class="w-4 h-4" />
    </button>
  </div>
</div>
