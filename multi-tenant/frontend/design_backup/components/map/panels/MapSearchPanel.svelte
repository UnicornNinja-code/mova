<script lang="ts">
  import { Search, X, MapPin, RefreshCw, ArrowRight } from 'lucide-svelte';

  export interface SearchResultItem {
    id?: string;
    title: string;
    subtitle: string;
    type: 'ZONE' | 'ROAD' | 'POI' | 'GEOCODE';
    badge: string;
    color: string;
    lat: number;
    lng: number;
    rawData?: any;
  }

  export interface PinnedLocation {
    title: string;
    lat: number;
    lng: number;
  }

  interface Props {
    searchQuery: string;
    isSearching: boolean;
    searchResults: SearchResultItem[];
    activePinnedLocation: PinnedLocation | null;
    hubCityName?: string;
    onClose: () => void;
    onSearchInput: (query: string) => void;
    onPerformSearch: () => void;
    onSelectResult: (item: SearchResultItem) => void;
    onClearPin: () => void;
  }

  let {
    searchQuery,
    isSearching,
    searchResults,
    activePinnedLocation,
    hubCityName = 'Operasional',
    onClose,
    onSearchInput,
    onPerformSearch,
    onSelectResult,
    onClearPin,
  }: Props = $props();
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between border-b border-[#24242A] pb-2">
    <div class="flex items-center gap-2">
      <Search class="w-4 h-4 text-[#FF634A]" />
      <h4 class="text-xs font-extrabold text-white">Pencarian Spasial {hubCityName}</h4>
    </div>
    <button onclick={onClose} class="text-[#71717A] hover:text-white cursor-pointer p-0.5" aria-label="Tutup pencarian">
      <X class="w-4 h-4" />
    </button>
  </div>

  <div class="relative flex items-center bg-[#18181D] border border-[#2E2E38] rounded-2xl p-1 focus-within:border-[#FF634A]">
    <Search class="w-3.5 h-3.5 text-[#71717A] ml-2 shrink-0" />
    <input
      type="text"
      value={searchQuery}
      onkeydown={(e) => e.key === 'Enter' && onPerformSearch()}
      oninput={(e) => onSearchInput((e.target as HTMLInputElement).value)}
      placeholder="Cari zona, jalan, POI, alamat..."
      class="w-full px-2 py-1 text-xs bg-transparent border-none focus:outline-none text-white placeholder:text-[#71717A]"
    />
    {#if searchQuery}
      <button onclick={onClearPin} class="p-1 text-[#71717A] hover:text-white cursor-pointer" aria-label="Hapus kata kunci">
        <X class="w-3.5 h-3.5" />
      </button>
    {/if}
    <button
      onclick={onPerformSearch}
      class="p-1.5 bg-[#FF634A] hover:bg-[#FF4D30] text-white rounded-xl cursor-pointer"
      title="Cari"
    >
      {#if isSearching}
        <RefreshCw class="w-3.5 h-3.5 animate-spin" />
      {:else}
        <ArrowRight class="w-3.5 h-3.5" />
      {/if}
    </button>
  </div>

  {#if activePinnedLocation}
    <div class="p-2.5 rounded-2xl bg-[#1C1C22] border border-[#2E2E38] flex items-center justify-between">
      <div class="flex items-center gap-2 min-w-0">
        <MapPin class="w-4 h-4 text-[#FF634A] shrink-0" />
        <div class="min-w-0">
          <span class="text-[10px] text-[#8E8E93] block">Lokasi Tersorot di Peta</span>
          <span class="text-xs font-bold text-white truncate block">{activePinnedLocation.title}</span>
        </div>
      </div>
      <button
        onclick={onClearPin}
        class="px-2 py-1 text-[10px] text-rose-400 bg-rose-950/40 rounded-lg hover:bg-rose-950 cursor-pointer"
      >
        Hapus Pin
      </button>
    </div>
  {/if}

  {#if searchResults.length > 0}
    <div class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      <span class="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block">
        Hasil ({searchResults.length})
      </span>
      {#each searchResults as item}
        <button
          onclick={() => onSelectResult(item)}
          class="w-full p-2 text-left rounded-2xl hover:bg-[#1F1F24] transition-colors flex items-start gap-2.5 cursor-pointer border border-[#24242A] hover:border-[#383846]"
        >
          <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style="background-color: {item.color}20; color: {item.color};">
            {#if item.type === 'ZONE'}
              <i class="ri-shape-line text-xs"></i>
            {:else if item.type === 'ROAD'}
              <i class="ri-road-map-line text-xs"></i>
            {:else if item.type === 'POI'}
              <i class="ri-map-pin-line text-xs"></i>
            {:else}
              <i class="ri-navigation-line text-xs"></i>
            {/if}
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="font-outfit-600 text-xs text-white truncate">{item.title}</span>
              <span class="px-1.5 py-0.2 rounded text-[9px] font-bold" style="background-color: {item.color}20; color: {item.color};">
                {item.badge}
              </span>
            </div>
            <p class="text-[10px] text-[#8E8E93] truncate mt-0.5">{item.subtitle}</p>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
