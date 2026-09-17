<script lang="ts">
  import { Radio, X, Navigation, ShieldCheck, ShieldAlert } from 'lucide-svelte';
  import type { NearbyRider } from '../../../services/mapService';

  interface Props {
    activeRiders: NearbyRider[];
    onClose: () => void;
    onSelectRider: (rider: NearbyRider) => void;
    onOpenBroadcast: () => void;
  }

  let {
    activeRiders,
    onClose,
    onSelectRider,
    onOpenBroadcast,
  }: Props = $props();
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between border-b border-[#24242A] pb-2">
    <div class="flex items-center gap-2">
      <Radio class="w-4 h-4 text-emerald-400" />
      <div>
        <h4 class="text-xs font-extrabold text-white">Rider Bertugas Lapangan</h4>
        <span class="text-[10px] text-emerald-400 font-mono font-bold">{activeRiders.length} Terkoneksi Real-Time</span>
      </div>
    </div>
    <button onclick={onClose} class="text-[#71717A] hover:text-white cursor-pointer p-0.5" aria-label="Tutup panel rider">
      <X class="w-4 h-4" />
    </button>
  </div>

  <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
    {#if activeRiders.length === 0}
      <div class="p-4 text-center text-zinc-500 text-xs bg-[#18181D] rounded-2xl border border-[#24242A]">
        Belum ada rider yang terdeteksi aktif bertugas saat ini.
      </div>
    {:else}
      {#each activeRiders as rider}
        <button
          onclick={() => onSelectRider(rider)}
          class="w-full p-2.5 rounded-2xl bg-[#18181D] border border-[#24242A] hover:border-[#FF634A]/50 hover:bg-[#1E1E24] text-left transition-all cursor-pointer flex items-center justify-between gap-2"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="font-outfit-700 text-xs text-white truncate">{rider.name}</span>
              {#if rider.plateNumber}
                <span class="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono text-[9px]">
                  {rider.plateNumber}
                </span>
              {/if}
            </div>

            <div class="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
              <span class="truncate">{rider.zoneName || 'Zona Bebas'}</span>
              <span>•</span>
              <span class="text-zinc-500 font-mono">{rider.vehicleType || 'GEROBAK'}</span>
            </div>
          </div>

          <div class="shrink-0 text-right">
            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono {rider.status === 'BREACH' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}">
              {rider.status || 'ONLINE'}
            </span>
          </div>
        </button>
      {/each}
    {/if}
  </div>

  <!-- Broadcast Action Button -->
  <button
    onclick={onOpenBroadcast}
    class="w-full py-2 bg-[#FF634A] hover:bg-[#FF4D30] text-white rounded-xl text-xs font-outfit-600 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-[#FF634A]/20"
  >
    <i class="ri-broadcast-line text-sm"></i>
    <span>Kirim Broadcast ke Semua Rider</span>
  </button>
</div>
