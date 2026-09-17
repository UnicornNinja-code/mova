<script lang="ts">
  import { X, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, User, MapPin, Users } from 'lucide-svelte';
  import type { DistributionPreviewResponse, ProposedAllocation, UnassignedRider } from '../../services/distributionService';

  interface Props {
    open: boolean;
    onClose: () => void;
    previewData: DistributionPreviewResponse | null;
    onConfirm: () => Promise<void>;
    confirming: boolean;
  }

  let { open = false, onClose, previewData = null, onConfirm, confirming = false }: Props = $props();
</script>

{#if open && previewData}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      aria-label="Tutup preview distribusi"
      class="fixed inset-0 bg-black/50 border-0 p-0 m-0 cursor-default"
      onclick={onClose}
    ></button>

    <div class="relative w-full max-w-3xl bg-[#131316] border border-[#2E2E38] rounded-3xl p-6 shadow-2xl z-10 space-y-5 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] flex items-center justify-center font-bold shadow-lg shadow-[#FF634A]/20">
            <Sparkles class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-outfit-600 text-white">Preview & Konfirmasi Auto Plotting</h3>
              {#if previewData.session}
                <span class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800/40">
                  {previewData.session.session_code}
                </span>
              {/if}
            </div>
            <p class="text-xs text-[#A1A1AA]">
              Simulasi alokasi FIFO rider ke rekomendasi ranking zona TOPSIS sebelum commit database
            </p>
          </div>
        </div>

        <button
          onclick={onClose}
          class="p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Summary KPI Row -->
      <div class="grid grid-cols-3 gap-3">
        <div class="p-3 bg-[#18181D] border border-[#24242A] rounded-2xl text-center space-y-0.5">
          <div class="text-[10px] text-zinc-400 uppercase font-semibold">Total Antrean</div>
          <div class="text-xl font-mono font-bold text-white">{previewData.total_riders_in_queue} <span class="text-xs font-normal text-zinc-400">Rider</span></div>
        </div>

        <div class="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl text-center space-y-0.5">
          <div class="text-[10px] text-emerald-400 uppercase font-semibold">Dapat Dialokasikan</div>
          <div class="text-xl font-mono font-bold text-emerald-400">{previewData.allocations_count} <span class="text-xs font-normal text-emerald-400/70">Rider</span></div>
        </div>

        <div class="p-3 bg-amber-950/30 border border-amber-800/40 rounded-2xl text-center space-y-0.5">
          <div class="text-[10px] text-amber-400 uppercase font-semibold">Kelebihan Kuota (Waitlist)</div>
          <div class="text-xl font-mono font-bold text-amber-400">{previewData.unassigned_count} <span class="text-xs font-normal text-amber-400/70">Rider</span></div>
        </div>
      </div>

      <!-- Main Content Scrollable -->
      <div class="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
        <!-- Zone Capacity Breakdown -->
        <div class="space-y-1.5">
          <h4 class="text-xs font-outfit-600 text-zinc-300">Distribusi Kuota per Zona:</h4>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {#each previewData.zone_allocation_summary as zoneSum}
              <div class="p-2.5 bg-[#18181E] border border-[#262630] rounded-xl flex items-center justify-between">
                <div class="min-w-0 pr-1">
                  <div class="font-outfit-600 text-white truncate text-[11px]">#{zoneSum.rank} {zoneSum.zone_name}</div>
                  <div class="text-[10px] text-zinc-500">Kapasitas Maks: {zoneSum.max}</div>
                </div>
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold {zoneSum.count > 0 ? 'bg-[#FF634A]/20 text-[#FF634A] border border-[#FF634A]/30' : 'bg-zinc-800 text-zinc-400'}">
                  +{zoneSum.count}
                </span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Proposed Allocations Table -->
        <div class="space-y-1.5">
          <h4 class="text-xs font-outfit-600 text-zinc-300">Rincian Plotting Rider:</h4>
          {#if previewData.proposed_allocations.length === 0}
            <div class="py-6 text-center text-zinc-500 bg-[#16161A] rounded-2xl border border-[#24242A]">
              Tidak ada rider yang dapat dialokasikan pada sesi ini.
            </div>
          {:else}
            <div class="rounded-2xl border border-[#24242A] overflow-hidden bg-[#16161A]">
              <table class="w-full text-left">
                <thead class="bg-[#1C1C22] text-[#71717A] uppercase text-[9px] font-outfit-600 border-b border-[#24242A]">
                  <tr>
                    <th class="py-2.5 px-3">Rider (FIFO)</th>
                    <th class="py-2.5 px-3">Zona Dituju</th>
                    <th class="py-2.5 px-3 text-center">Rank TOPSIS</th>
                    <th class="py-2.5 px-3">Justifikasi Sistem</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#24242A]">
                  {#each previewData.proposed_allocations as alloc}
                    <tr class="hover:bg-[#1D1D24]">
                      <td class="py-2.5 px-3">
                        <div class="font-outfit-600 text-white">{alloc.rider_name}</div>
                        <div class="text-[10px] text-zinc-500 font-mono">{alloc.rider_email || '-'}</div>
                      </td>
                      <td class="py-2.5 px-3 font-semibold text-zinc-200">
                        <div class="flex items-center gap-1">
                          <MapPin class="w-3 h-3 text-[#FF634A]" />
                          <span>{alloc.zone_name}</span>
                        </div>
                      </td>
                      <td class="py-2.5 px-3 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FF634A]/20 text-[#FF634A] border border-[#FF634A]/30">
                          #{alloc.topsis_rank}
                        </span>
                      </td>
                      <td class="py-2.5 px-3 text-zinc-400 text-[11px]">
                        {alloc.reason}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

        <!-- Unassigned Riders (Waitlist) -->
        {#if previewData.unassigned_riders.length > 0}
          <div class="space-y-1.5 pt-2">
            <h4 class="text-xs font-outfit-600 text-amber-400 flex items-center gap-1.5">
              <AlertTriangle class="w-3.5 h-3.5" />
              <span>Rider Melebihi Kuota (Tetap Menunggu di Antrean):</span>
            </h4>
            <div class="space-y-1.5">
              {#each previewData.unassigned_riders as unassigned}
                <div class="p-2.5 rounded-xl bg-amber-950/20 border border-amber-800/30 flex items-center justify-between text-xs">
                  <div class="font-outfit-600 text-amber-200">{unassigned.rider_name}</div>
                  <div class="text-[10px] text-amber-400/80 italic">{unassigned.reason}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="pt-3 border-t border-[#24242A] flex items-center justify-end gap-3 shrink-0">
        <button
          type="button"
          onclick={onClose}
          class="px-4 py-2.5 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-[#A1A1AA] hover:text-white text-xs font-outfit-600 transition-colors cursor-pointer"
        >
          Batalkan
        </button>

        <button
          type="button"
          onclick={onConfirm}
          disabled={confirming || previewData.allocations_count === 0}
          class="pill-btn-orange text-xs font-outfit-600 cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          <CheckCircle2 class="w-4 h-4" />
          <span>{confirming ? 'Memproses Eksekusi...' : 'Konfirmasi & Commit Distribusi'}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
