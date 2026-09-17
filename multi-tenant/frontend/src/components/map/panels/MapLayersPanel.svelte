<script lang="ts">
  import { Layers3, X, Sparkles } from 'lucide-svelte';

  interface Props {
    layerHub: boolean;
    layerRiders: boolean;
    layerZones: boolean;
    layerProtocolRoads: boolean;
    layerTollRoads: boolean;
    layerPoi: boolean;
    activeRidersCount: number;
    activeZonesCount: number;
    hubCityName?: string;
    poiFilterCategory: 'ALL' | 'PEAK_ONLY' | 'EDUKASI' | 'KANTOR' | 'PASAR' | 'KULINER' | 'TRANSIT' | 'KESEHATAN' | 'IBADAH';
    onClose: () => void;
    onToggleHub: (val: boolean) => void;
    onToggleRiders: (val: boolean) => void;
    onToggleZones: (val: boolean) => void;
    onToggleProtocolRoads: (val: boolean) => void;
    onToggleTollRoads: (val: boolean) => void;
    onTogglePoi: (val: boolean) => void;
    onChangePoiFilter: (cat: 'ALL' | 'PEAK_ONLY' | 'EDUKASI' | 'KANTOR' | 'PASAR' | 'KULINER' | 'TRANSIT' | 'KESEHATAN' | 'IBADAH') => void;
  }

  let {
    layerHub,
    layerRiders,
    layerZones,
    layerProtocolRoads,
    layerTollRoads,
    layerPoi,
    activeRidersCount,
    activeZonesCount,
    hubCityName = 'Operasional',
    poiFilterCategory,
    onClose,
    onToggleHub,
    onToggleRiders,
    onToggleZones,
    onToggleProtocolRoads,
    onToggleTollRoads,
    onTogglePoi,
    onChangePoiFilter,
  }: Props = $props();
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between border-b border-[#24242A] pb-2">
    <div class="flex items-center gap-2">
      <Layers3 class="w-4 h-4 text-[#FF634A]" />
      <h4 class="text-xs font-extrabold text-white">Filter & Layer Spasial</h4>
    </div>
    <button onclick={onClose} class="text-[#71717A] hover:text-white cursor-pointer p-0.5" aria-label="Tutup panel layer">
      <X class="w-4 h-4" />
    </button>
  </div>

  <div class="space-y-2 text-xs text-[#A1A1AA]">
    <span class="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block">Layer Peta Aktif</span>

    <!-- Central Hub -->
    <label class="flex items-center justify-between p-2 rounded-xl bg-[#18181D] border border-[#24242A] cursor-pointer hover:text-white">
      <span class="flex items-center gap-2">
        <input
          type="checkbox"
          checked={layerHub}
          onchange={(e) => onToggleHub((e.target as HTMLInputElement).checked)}
          class="accent-[#FF634A] rounded cursor-pointer"
        />
        <span class="text-[#FF634A] font-bold">Central HUB ({hubCityName})</span>
      </span>
      <span class="px-2 py-0.5 rounded bg-[#FF634A]/15 text-[#FF634A] text-[10px] font-bold border border-[#FF634A]/40">
        Pusat Ops
      </span>
    </label>

    <!-- Rider Bertugas -->
    <label class="flex items-center justify-between p-2 rounded-xl bg-[#18181D] border border-[#24242A] cursor-pointer hover:text-white">
      <span class="flex items-center gap-2">
        <input
          type="checkbox"
          checked={layerRiders}
          onchange={(e) => onToggleRiders((e.target as HTMLInputElement).checked)}
          class="accent-[#10B981] rounded cursor-pointer"
        />
        <span>Rider Bertugas</span>
      </span>
      <span class="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px] font-bold border border-emerald-800/40">
        {activeRidersCount} Aktif
      </span>
    </label>

    <!-- Zona Operasional -->
    <label class="flex items-center justify-between p-2 rounded-xl bg-[#18181D] border border-[#24242A] cursor-pointer hover:text-white">
      <span class="flex items-center gap-2">
        <input
          type="checkbox"
          checked={layerZones}
          onchange={(e) => onToggleZones((e.target as HTMLInputElement).checked)}
          class="accent-[#3B82F6] rounded cursor-pointer"
        />
        <span>Poligon Zona Operasi</span>
      </span>
      <span class="px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 text-[10px] font-bold border border-blue-800/40">
        {activeZonesCount} Terdaftar
      </span>
    </label>

    <!-- Jalan Protokol -->
    <label class="flex items-center justify-between p-2 rounded-xl bg-[#18181D] border border-[#24242A] cursor-pointer hover:text-white">
      <span class="flex items-center gap-2">
        <input
          type="checkbox"
          checked={layerProtocolRoads}
          onchange={(e) => onToggleProtocolRoads((e.target as HTMLInputElement).checked)}
          class="accent-[#F59E0B] rounded cursor-pointer"
        />
        <span>Jalan Protokol & Arteri Primer</span>
      </span>
      <span class="px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 text-[10px] font-bold border border-amber-800/40">
        Protokol
      </span>
    </label>

    <!-- Jalan Bebas Hambatan / Tol -->
    <label class="flex items-center justify-between p-2 rounded-xl bg-[#18181D] border border-[#24242A] cursor-pointer hover:text-white">
      <span class="flex items-center gap-2">
        <input
          type="checkbox"
          checked={layerTollRoads}
          onchange={(e) => onToggleTollRoads((e.target as HTMLInputElement).checked)}
          class="accent-[#DC2626] rounded cursor-pointer"
        />
        <span>Koridor Tol (Dilarang Berjualan)</span>
      </span>
      <span class="px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 text-[10px] font-bold border border-rose-800/40">
        No-Sell
      </span>
    </label>

    <!-- Marker POI Potensial -->
    <label class="flex items-center justify-between p-2 rounded-xl bg-[#18181D] border border-[#24242A] cursor-pointer hover:text-white">
      <span class="flex items-center gap-2">
        <input
          type="checkbox"
          checked={layerPoi}
          onchange={(e) => onTogglePoi((e.target as HTMLInputElement).checked)}
          class="accent-[#8B5CF6] rounded cursor-pointer"
        />
        <span>Titik POI Potensial (C1/C2/C3)</span>
      </span>
      <span class="px-2 py-0.5 rounded bg-purple-950/60 text-purple-400 text-[10px] font-bold border border-purple-800/40">
        POI Sidoarjo
      </span>
    </label>
  </div>

  <!-- Filter Kategori POI C3 -->
  {#if layerPoi}
    <div class="pt-2 border-t border-[#24242A] space-y-2">
      <span class="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block">Filter Kategori POI</span>
      <div class="grid grid-cols-2 gap-1.5 text-[11px]">
        <button
          onclick={() => onChangePoiFilter('ALL')}
          class="p-1.5 rounded-lg border text-left cursor-pointer transition-all {poiFilterCategory === 'ALL' ? 'bg-[#FF634A]/20 border-[#FF634A] text-white font-bold' : 'bg-[#18181D] border-[#24242A] text-zinc-400 hover:text-white'}"
        >
          Semua POI
        </button>
        <button
          onclick={() => onChangePoiFilter('PEAK_ONLY')}
          class="p-1.5 rounded-lg border text-left cursor-pointer transition-all flex items-center gap-1 {poiFilterCategory === 'PEAK_ONLY' ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold' : 'bg-[#18181D] border-[#24242A] text-zinc-400 hover:text-white'}"
        >
          <Sparkles class="w-3 h-3 text-amber-400" />
          <span>Hanya Ramai C3</span>
        </button>
        {#each (['KULINER', 'KANTOR', 'EDUKASI', 'PASAR', 'TRANSIT', 'KESEHATAN', 'IBADAH'] as const) as catKey}
          <button
            onclick={() => onChangePoiFilter(catKey)}
            class="p-1.5 rounded-lg border text-left cursor-pointer transition-all {poiFilterCategory === catKey ? 'bg-[#FF634A]/20 border-[#FF634A] text-white font-bold' : 'bg-[#18181D] border-[#24242A] text-zinc-400 hover:text-white'}"
          >
            {catKey}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
