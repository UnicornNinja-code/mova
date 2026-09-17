<script lang="ts">
  import { X, Check } from 'lucide-svelte';
  import type { BasemapProvider } from '../../../lib/mapProviders';

  interface Props {
    basemapProviders: BasemapProvider[];
    selectedBasemapId: string;
    onClose: () => void;
    onSelectBasemap: (id: string) => void;
  }

  let {
    basemapProviders,
    selectedBasemapId,
    onClose,
    onSelectBasemap,
  }: Props = $props();
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between border-b border-[#24242A] pb-2">
    <div class="flex items-center gap-1.5 text-white font-extrabold text-xs">
      <i class="ri-earth-line text-[#FF634A]"></i>
      <span>Pilih Gaya Basemap</span>
    </div>
    <button onclick={onClose} class="text-[#71717A] hover:text-white cursor-pointer p-0.5" aria-label="Tutup pemilih basemap">
      <X class="w-4 h-4" />
    </button>
  </div>

  <div class="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
    {#each basemapProviders as provider}
      {@const isSelected = selectedBasemapId === provider.id}
      <button
        onclick={() => onSelectBasemap(provider.id)}
        class="relative p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 {isSelected
          ? 'bg-[#FF634A]/10 border-[#FF634A] shadow-md shadow-[#FF634A]/10'
          : 'bg-[#18181D] border-[#2E2E38] hover:border-zinc-500'}"
      >
        <div>
          <span class="font-outfit-700 text-xs text-white block leading-tight">{provider.name}</span>
          <span class="text-[10px] text-zinc-400 font-mono block mt-0.5">{provider.id}</span>
        </div>

        <div class="flex items-center justify-between mt-2">
          <span class="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-[#24242A] text-zinc-400">
            TILES
          </span>
          {#if isSelected}
            <div class="w-4 h-4 rounded-full bg-[#FF634A] flex items-center justify-center text-white text-[10px]">
              <Check class="w-2.5 h-2.5 stroke-[3]" />
            </div>
          {/if}
        </div>
      </button>
    {/each}
  </div>
</div>
