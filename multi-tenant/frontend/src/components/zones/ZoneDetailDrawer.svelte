<script lang="ts">
  import { X, Trash2, AlertTriangle } from 'lucide-svelte';
  import type { ZoneItem } from '../../services/zoneService';

  interface Props {
    show: boolean;
    selectedZone: ZoneItem | null;
    drawnPoints: [number, number][];
    spatialViolationWarning: string | null;
    spatialOverlapWarning: string | null;
    calculateAreaKm2: (pts: [number, number][]) => number;
    onClose: () => void;
    onRemovePoint: (idx: number) => void;
    onResetPoints: () => void;
    onApplyPolygon: () => void;
  }

  let {
    show,
    selectedZone,
    drawnPoints,
    spatialViolationWarning,
    spatialOverlapWarning,
    calculateAreaKm2,
    onClose,
    onRemovePoint,
    onResetPoints,
    onApplyPolygon,
  }: Props = $props();
</script>

{#if show}
  <div class="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[#151519] border-l border-[#2E2E38] shadow-2xl p-5 flex flex-col justify-between text-white animate-slide-left font-outfit-400">
    <div>
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div>
          <span class="text-[10px] font-outfit-600 uppercase text-[#FF634A]">Editor Poligon Geofence</span>
          <h3 class="text-base font-outfit-600 text-white">{selectedZone?.name || 'Zona Operasional'}</h3>
        </div>
        <button 
          onclick={onClose}
          class="text-[#71717A] hover:text-white cursor-pointer p-1"
          aria-label="Tutup Drawer Poligon"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Coordinates List -->
      <div class="mt-3 space-y-2">
        <div class="flex items-center justify-between text-[11px] font-outfit-600 text-[#71717A]">
          <span>Titik Koordinat ({drawnPoints.length} Vertex)</span>
          <span>Luas: {calculateAreaKm2(drawnPoints)} km²</span>
        </div>

        <div class="max-h-80 overflow-y-auto space-y-1 pr-1 divide-y divide-[#1F1F24]">
          {#each drawnPoints as pt, idx}
            <div class="flex items-center justify-between py-1.5 text-xs">
              <span class="font-mono text-zinc-300">P{idx + 1}: {pt[0].toFixed(5)}, {pt[1].toFixed(5)}</span>
              <button
                type="button"
                onclick={() => onRemovePoint(idx)}
                class="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                title="Hapus Titik"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          {/each}
        </div>
      </div>

      {#if spatialViolationWarning}
        <div class="mt-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{spatialViolationWarning}</span>
        </div>
      {/if}

      {#if spatialOverlapWarning}
        <div class="mt-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{spatialOverlapWarning}</span>
        </div>
      {/if}
    </div>

    <div class="pt-4 border-t border-[#24242A] flex items-center justify-between gap-2">
      <button
        type="button"
        onclick={onResetPoints}
        class="px-3 py-1.5 text-xs text-[#A1A1AA] hover:text-white font-outfit-600 cursor-pointer"
      >
        Reset Titik
      </button>
      <button
        type="button"
        onclick={onApplyPolygon}
        class="px-4 py-2 rounded-xl bg-[#FF634A] hover:bg-[#FF4D30] text-xs font-outfit-600 text-white transition-all cursor-pointer"
      >
        Terapkan Perubahan
      </button>
    </div>
  </div>
{/if}
