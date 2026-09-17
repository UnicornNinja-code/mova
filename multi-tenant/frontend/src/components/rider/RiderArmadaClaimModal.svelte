<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    X, 
    Bike, 
    Clock, 
    CheckSquare, 
    Square, 
    CheckCircle2, 
    AlertTriangle, 
    RefreshCw, 
    ArrowRight,
    ShieldCheck,
    Flame
  } from 'lucide-svelte';
  import { riderService, type HubArmadaItem } from '../../services/riderService';

  interface Props {
    open: boolean;
    onClose: () => void;
    onClaimSuccess: (armada: any) => void;
  }

  let { open = false, onClose, onClaimSuccess }: Props = $props();

  let loading = $state(false);
  let armadas = $state<HubArmadaItem[]>([]);
  let selectedArmada = $state<HubArmadaItem | null>(null);

  // Hold Timer State (180 Seconds / 3 Minutes)
  let isHolding = $state(false);
  let holdSecondsLeft = $state(180);
  let timerInterval: any = null;

  // Physical Checklist State
  let checklist = $state({
    brakes: false,
    tires: false,
    cooler: false,
    stove: false,
    cleanliness: false,
  });
  let notes = $state('');

  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);

  const loadArmadas = async () => {
    loading = true;
    errorMsg = null;
    try {
      const res = await riderService.getHubArmadas();
      armadas = res;
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat katalog armada Hub.';
    } finally {
      loading = false;
    }
  };

  const startHoldTimer = (seconds = 180) => {
    isHolding = true;
    holdSecondsLeft = seconds;
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      holdSecondsLeft -= 1;
      if (holdSecondsLeft <= 0) {
        clearInterval(timerInterval);
        isHolding = false;
        errorMsg = 'Waktu hold 3 menit telah berakhir. Armada kembali tersedia untuk umum.';
      }
    }, 1000);
  };

  const handleHoldArmada = async (armada: HubArmadaItem) => {
    submitting = true;
    errorMsg = null;
    try {
      await riderService.holdArmada(armada.id);
      selectedArmada = armada;
      startHoldTimer(180);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal mengunci unit armada.';
    } finally {
      submitting = false;
    }
  };

  const handleCancelHold = async () => {
    if (!selectedArmada) return;
    submitting = true;
    try {
      await riderService.cancelHoldArmada(selectedArmada.id);
      if (timerInterval) clearInterval(timerInterval);
      isHolding = false;
      selectedArmada = null;
      await loadArmadas();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal membatalkan hold armada.';
    } finally {
      submitting = false;
    }
  };

  const isChecklistComplete = $derived(
    checklist.brakes && checklist.tires && checklist.cooler && checklist.cleanliness
  );

  const handleConfirmClaim = async () => {
    if (!selectedArmada) return;
    if (!isChecklistComplete) {
      errorMsg = 'Harap lengkapi semua poin checklist fisik armada sebelum klaim.';
      return;
    }

    submitting = true;
    errorMsg = null;
    try {
      const res = await riderService.claimArmada(selectedArmada.id, checklist);
      if (timerInterval) clearInterval(timerInterval);
      isHolding = false;
      onClaimSuccess(res.armada || selectedArmada);
      onClose();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal mengonfirmasi klaim armada.';
    } finally {
      submitting = false;
    }
  };

  $effect(() => {
    if (open) {
      loadArmadas();
    } else {
      if (timerInterval) clearInterval(timerInterval);
      isHolding = false;
    }
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200 font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      class="fixed inset-0 w-full h-full bg-black/50 cursor-default focus:outline-none"
      onclick={onClose}
      aria-label="Tutup modal armada"
    ></button>

    <div
      class="relative z-10 w-full sm:max-w-lg bg-[#131317] border-t sm:border border-[#262632] rounded-t-[32px] sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-2.5 border-b border-[#24242E]">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black font-bold shadow-md shadow-emerald-500/20">
            <Bike class="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 class="text-sm font-outfit-600 font-bold text-white">Klaim Unit Armada Hub</h3>
            <p class="text-[11px] text-zinc-400">Inspeksi fisik & reservasi 3-menit</p>
          </div>
        </div>

        <button
          type="button"
          onclick={onClose}
          class="w-7 h-7 rounded-full bg-[#1C1C24] border border-[#2B2B38] text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      {#if errorMsg}
        <div class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <!-- STEP 2: HOLD ACTIVE -> CHECKLIST INSPEKSI FISIK -->
      {#if isHolding && selectedArmada}
        <div class="space-y-4">
          <!-- Hold Countdown Bar -->
          <div class="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/30 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Clock class="w-4 h-4 animate-pulse text-amber-400" />
                Kunci Sementara Aktif
              </span>
              <span class="px-2 py-0.5 rounded-full bg-amber-500 text-black font-mono font-bold text-xs">
                {Math.floor(holdSecondsLeft / 60)}:{(holdSecondsLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <!-- Progress Bar -->
            <div class="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div
                class="h-full bg-amber-400 transition-all duration-1000"
                style={`width: ${(holdSecondsLeft / 180) * 100}%`}
              ></div>
            </div>
            <p class="text-[10px] text-zinc-400">
              Unit <span class="text-white font-bold">{selectedArmada.code}</span> terkunci khusus untuk Anda selama 3 menit. Selesaikan checklist fisik di bawah.
            </p>
          </div>

          <!-- Physical Inspection Checklist Form -->
          <div class="space-y-2.5">
            <h4 class="text-xs font-bold text-white flex items-center gap-1.5">
              <CheckSquare class="w-3.5 h-3.5 text-emerald-400" />
              Checklist Fisik Armada Sebelum Bertugas
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label class="p-2.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38] flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/50">
                <input type="checkbox" bind:checked={checklist.brakes} class="accent-emerald-500 w-4 h-4 rounded" />
                <span class="text-zinc-300 text-[11px]">Rem Depan & Belakang Pakem</span>
              </label>

              <label class="p-2.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38] flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/50">
                <input type="checkbox" bind:checked={checklist.tires} class="accent-emerald-500 w-4 h-4 rounded" />
                <span class="text-zinc-300 text-[11px]">Kondisi Roda & Tekanan Ban</span>
              </label>

              <label class="p-2.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38] flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/50">
                <input type="checkbox" bind:checked={checklist.cooler} class="accent-emerald-500 w-4 h-4 rounded" />
                <span class="text-zinc-300 text-[11px]">Box Es / Cooler & Insulasi Dingin</span>
              </label>

              <label class="p-2.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38] flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/50">
                <input type="checkbox" bind:checked={checklist.stove} class="accent-emerald-500 w-4 h-4 rounded" />
                <span class="text-zinc-300 text-[11px]">Kompor / Water Heater Siap</span>
              </label>

              <label class="p-2.5 rounded-xl bg-[#1A1A22] border border-[#2B2B38] flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/50">
                <input type="checkbox" bind:checked={checklist.cleanliness} class="accent-emerald-500 w-4 h-4 rounded" />
                <span class="text-zinc-300 text-[11px]">Kebersihan Sanitasi Gerobak</span>
              </label>
            </div>
          </div>

          <!-- Notes -->
          <div class="space-y-1">
            <label for="inspection-notes" class="text-[11px] text-zinc-400 font-medium">Catatan Kondisi Awal (Opsional):</label>
            <input
              id="inspection-notes"
              type="text"
              bind:value={notes}
              placeholder="Contoh: Bodi samping ada goresan kecil, fungsi rem sangat baik"
              class="w-full p-2.5 rounded-xl bg-[#1A1A22] border border-[#2E2E3C] text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <!-- Actions -->
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-[#24242E]">
            <button
              type="button"
              onclick={handleCancelHold}
              disabled={submitting}
              class="py-2.5 rounded-xl bg-[#1E1E28] hover:bg-[#282834] text-zinc-300 text-xs font-bold transition-all cursor-pointer"
            >
              Batalkan Kunci
            </button>
            <button
              type="button"
              onclick={handleConfirmClaim}
              disabled={submitting || !isChecklistComplete}
              class="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>{submitting ? 'Mengklaim...' : 'Klaim Unit Resmi'}</span>
            </button>
          </div>
        </div>

      <!-- STEP 1: CATALOG DAFTAR ARMADA DI HUB -->
      {:else}
        <div class="space-y-3">
          <div class="flex items-center justify-between text-xs text-zinc-400">
            <span>Pilih unit armada yang tersedia di Hub:</span>
            <button onclick={loadArmadas} class="text-[#FF634A] hover:underline flex items-center gap-1 cursor-pointer">
              <RefreshCw class="w-3 h-3 {loading ? 'animate-spin' : ''}" /> Refresh
            </button>
          </div>

          {#if loading}
            <div class="py-8 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
              <RefreshCw class="w-5 h-5 animate-spin text-emerald-400" />
              <span>Memeriksa ketersediaan unit armada di Hub...</span>
            </div>
          {:else if armadas.length === 0}
            <div class="p-6 text-center rounded-2xl bg-[#181820] border border-[#282834] text-xs text-zinc-400">
              Belum ada armada bertipe GEROBAK yang siap diklaim di Hub saat ini.
            </div>
          {:else}
            <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
              {#each armadas as a}
                <div class="p-3 rounded-2xl bg-[#181822] border border-[#2A2A38] hover:border-emerald-500/40 flex items-center justify-between transition-all">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Bike class="w-4 h-4" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-bold text-white font-mono">{a.code}</span>
                        <span class="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">{a.type}</span>
                      </div>
                      <div class="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                        <span class="flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 class="w-3 h-3" /> SIAP
                        </span>
                        <span>• Status: {a.status}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onclick={() => handleHoldArmada(a)}
                    disabled={submitting || a.status !== 'AVAILABLE'}
                    class="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500/40 text-emerald-300 hover:text-black font-bold text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    Kunci & Inspeksi
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
