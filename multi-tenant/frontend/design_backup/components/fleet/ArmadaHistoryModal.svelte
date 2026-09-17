<script lang="ts">
  import { onMount } from 'svelte';
  import { X, History, Bike, User, MapPin, Calendar, Clock } from 'lucide-svelte';
  import { armadaService, type ArmadaItem } from '../../services/armadaService';

  interface Props {
    open: boolean;
    onClose: () => void;
    armada: ArmadaItem | null;
  }

  let { open = false, onClose, armada = null }: Props = $props();

  let loading = $state(false);
  let historyList = $state<any[]>([]);
  let errorMsg = $state<string | null>(null);

  $effect(() => {
    if (open && armada?.id) {
      loadHistory(armada.id);
    }
  });

  const loadHistory = async (armadaId: string | number) => {
    loading = true;
    errorMsg = null;
    try {
      const data = await armadaService.getArmadaHistory(armadaId);
      historyList = data;
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || 'Gagal memuat riwayat penugasan armada.';
    } finally {
      loading = false;
    }
  };
</script>

{#if open && armada}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      aria-label="Tutup riwayat armada"
      class="fixed inset-0 bg-black/75 backdrop-blur-xs border-0 p-0 m-0 cursor-default"
      onclick={onClose}
    ></button>

    <div class="relative w-full max-w-2xl bg-[#131316] border border-[#24242A] rounded-3xl p-6 shadow-2xl z-10 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-blue-950/40 border border-blue-800/40 text-blue-400 flex items-center justify-center font-bold">
            <History class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-outfit-600 text-white">Riwayat Operasional Unit #{armada.code}</h3>
            <p class="text-xs text-[#A1A1AA]">Log penugasan, rider lapangan, dan inspeksi kembali</p>
          </div>
        </div>

        <button
          onclick={onClose}
          class="p-2 rounded-xl text-[#71717A] hover:text-white hover:bg-[#1F1F24] transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- History Content -->
      {#if loading}
        <div class="py-12 text-center text-xs text-[#A1A1AA] space-y-2">
          <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin"></div>
          <div>Memuat histori penugasan...</div>
        </div>
      {:else if errorMsg}
        <div class="p-3 bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs rounded-2xl">
          {errorMsg}
        </div>
      {:else if historyList.length === 0}
        <div class="py-12 text-center text-xs text-zinc-500">
          Belum ada riwayat penugasan operasional untuk unit armada ini.
        </div>
      {:else}
        <div class="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {#each historyList as h}
            <div class="p-3.5 bg-[#18181D] border border-[#26262E] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <div class="flex items-center gap-1.5 font-outfit-600 text-white">
                    <User class="w-3.5 h-3.5 text-[#FF634A]" />
                    <span>{h.rider_name}</span>
                  </div>
                  {#if h.zone_name}
                    <span class="px-2 py-0.2 rounded-md bg-blue-950/40 text-blue-300 border border-blue-800/40 text-[10px]">
                      {h.zone_name}
                    </span>
                  {/if}
                </div>
                <div class="text-[11px] text-zinc-400 flex items-center gap-3">
                  <span class="flex items-center gap-1">
                    <Calendar class="w-3 h-3 text-zinc-500" />
                    {new Date(h.assigned_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span class="flex items-center gap-1">
                    <Clock class="w-3 h-3 text-zinc-500" />
                    Klaim: {new Date(h.claimed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div class="text-right shrink-0">
                {#if h.status === 'IN_USE'}
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-blue-950/40 text-blue-400 border border-blue-800/40">
                    Sedang Bertugas
                  </span>
                {:else if h.status === 'DAMAGED'}
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-rose-950/40 text-rose-400 border border-rose-800/40">
                    Dikembalikan Rusak
                  </span>
                {:else}
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-outfit-600 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                    Selesai (Kondisi Baik)
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <div class="pt-2 border-t border-[#24242A]">
        <button
          type="button"
          onclick={onClose}
          class="w-full py-2.5 rounded-xl bg-[#24242A] hover:bg-[#32323A] text-white text-xs font-outfit-600 font-bold transition-all cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}
