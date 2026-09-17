<script lang="ts">
  import { Search, Layers3, Radio, Cloud } from 'lucide-svelte';

  export type ActivePanelType = 'search' | 'layers' | 'riders' | 'weather' | 'legend' | 'basemap' | null;

  interface Props {
    activePanel: ActivePanelType;
    activeRidersCount: number;
    onTogglePanel: (panel: ActivePanelType) => void;
  }

  let {
    activePanel,
    activeRidersCount,
    onTogglePanel,
  }: Props = $props();
</script>

<div class="bg-[#131316]/95 backdrop-blur-xl border border-[#2E2E38] rounded-3xl shadow-2xl p-1.5 flex flex-col items-center gap-1.5 text-white shrink-0">
  <!-- 1. Pencarian Spasial -->
  <button
    onclick={() => onTogglePanel('search')}
    class="relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer
    {activePanel === 'search' 
      ? 'bg-[#FF634A] text-white shadow-lg shadow-orange-950/50' 
      : 'text-[#A1A1AA] hover:text-white hover:bg-[#1F1F24]'}"
    title="Pencarian Alamat, POI, & Zona"
  >
    <Search class="w-4 h-4" />
  </button>

  <!-- 2. Filter & Layer Spasial -->
  <button
    onclick={() => onTogglePanel('layers')}
    class="relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer
    {activePanel === 'layers' 
      ? 'bg-[#FF634A] text-white shadow-lg shadow-orange-950/50' 
      : 'text-[#A1A1AA] hover:text-white hover:bg-[#1F1F24]'}"
    title="Filter & Layer Spasial"
  >
    <Layers3 class="w-4 h-4" />
  </button>

  <!-- 3. Panel Rider Bertugas -->
  <button
    onclick={() => onTogglePanel('riders')}
    class="relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer
    {activePanel === 'riders' 
      ? 'bg-[#FF634A] text-white shadow-lg shadow-orange-950/50' 
      : 'text-[#A1A1AA] hover:text-white hover:bg-[#1F1F24]'}"
    title="Daftar Rider Bertugas"
  >
    <Radio class="w-4 h-4" />
    {#if activeRidersCount > 0}
      <span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs">
        {activeRidersCount}
      </span>
    {/if}
  </button>

  <!-- 4. Cuaca Hub -->
  <button
    onclick={() => onTogglePanel('weather')}
    class="relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer
    {activePanel === 'weather' 
      ? 'bg-[#FF634A] text-white shadow-lg shadow-orange-950/50' 
      : 'text-[#A1A1AA] hover:text-white hover:bg-[#1F1F24]'}"
    title="Informasi Cuaca Hub Operasional"
  >
    <Cloud class="w-4 h-4 text-sky-400" />
  </button>

  <!-- 5. Legenda Simbol & POI -->
  <button
    onclick={() => onTogglePanel('legend')}
    class="relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer
    {activePanel === 'legend' 
      ? 'bg-[#FF634A] text-white shadow-lg shadow-orange-950/50' 
      : 'text-[#A1A1AA] hover:text-white hover:bg-[#1F1F24]'}"
    title="Legenda Simbol & Warna POI"
  >
    <i class="ri-information-line text-lg"></i>
  </button>

  <!-- 6. Gaya Peta (Basemap) -->
  <button
    onclick={() => onTogglePanel('basemap')}
    class="relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer
    {activePanel === 'basemap' 
      ? 'bg-[#FF634A] text-white shadow-lg shadow-orange-950/50' 
      : 'text-[#A1A1AA] hover:text-white hover:bg-[#1F1F24]'}"
    title="Gaya Peta (Basemap Theme)"
  >
    <i class="ri-earth-line text-lg"></i>
  </button>
</div>
