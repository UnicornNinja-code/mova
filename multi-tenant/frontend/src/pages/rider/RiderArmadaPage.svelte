<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import MobileFrame from '../../components/ui/MobileFrame.svelte';
  import { 
    Bike, 
    ArrowLeft, 
    Clock, 
    CheckSquare, 
    CheckCircle2, 
    AlertTriangle, 
    RefreshCw, 
    ArrowRight 
  } from 'lucide-svelte';
  import { riderService, type HubArmadaItem } from '../../services/riderService';
  import { router } from '../../lib/stores/router.svelte';

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let loading = $state(false);
  let armadas = $state<HubArmadaItem[]>([]);
  let selectedArmada = $state<HubArmadaItem | null>(null);

  // Anti-Throttling Absolute Countdown Timer (180s)
  let isHolding = $state(false);
  let expiresAt = $state(0);
  let now = $state(Date.now());
  let timerInterval: any = null;

  let remainingSeconds = $derived(
    isHolding && expiresAt > 0 ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0
  );

  // 5-Point Physical Checklist
  let checklist = $state({
    brakes: false,
    tires: false,
    cooler: false,
    equipment: false,
    cleanliness: false,
  });
  let notes = $state('');

  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      router.navigate(path);
    }
  };

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

  const startHold = (durationSeconds = 180) => {
    isHolding = true;
    expiresAt = Date.now() + durationSeconds * 1000;
    now = Date.now();

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      now = Date.now();
      if (expiresAt - now <= 0) {
        clearInterval(timerInterval);
        isHolding = false;
        errorMsg = 'Waktu hold 3 menit telah berakhir. Unit armada dilepas kembali.';
      }
    }, 1000);
  };

  const handleHoldArmada = async (armada: HubArmadaItem) => {
    submitting = true;
    errorMsg = null;
    try {
      await riderService.holdArmada(armada.id);
      selectedArmada = armada;
      startHold(180);
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
    checklist.brakes && checklist.tires && checklist.cooler && checklist.equipment && checklist.cleanliness
  );

  const handleConfirmClaim = async () => {
    if (!selectedArmada) return;
    if (!isChecklistComplete) {
      errorMsg = 'Harap lengkapi seluruh poin checklist fisik sebelum klaim.';
      return;
    }

    submitting = true;
    errorMsg = null;
    try {
      await riderService.claimArmada(selectedArmada.id, checklist);
      if (timerInterval) clearInterval(timerInterval);
      isHolding = false;
      successMsg = `Unit ${selectedArmada.code} resmi diklaim (Status: IN_USE)!`;
      setTimeout(() => {
        navigateTo('/rider/checkin');
      }, 1500);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal mengonfirmasi klaim armada.';
    } finally {
      submitting = false;
    }
  };

  onMount(() => {
    loadArmadas();
    const handleVisibility = () => {
      now = Date.now();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });
</script>

<MobileFrame showStatusBar={true} showDynamicIsland={true}>
  <!-- Top Bar -->
  <div class="flex items-center justify-between pb-3 mb-4 border-b border-[#24242E]">
    <button
      type="button"
      onclick={() => navigateTo('/rider')}
      class="w-8 h-8 rounded-full bg-[#1C1C24] border border-[#2B2B38] text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
      title="Kembali ke Dasbor"
    >
      <ArrowLeft class="w-4 h-4" />
    </button>

    <div class="text-center">
      <h2 class="text-xs font-outfit-600 font-bold text-white uppercase tracking-wider">Langkah 2 dari 5</h2>
      <p class="text-[11px] text-zinc-400">Inspeksi & Klaim Armada Hub</p>
    </div>

    <div class="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold font-mono">
      2
    </div>
  </div>

  <div class="space-y-4 font-outfit-400">
    {#if errorMsg}
      <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
        <AlertTriangle class="w-4 h-4 shrink-0 text-rose-400" />
        <span>{errorMsg}</span>
      </div>
    {/if}

    {#if successMsg}
      <div class="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400" />
        <span>{successMsg}</span>
      </div>
    {/if}

    <!-- STEP 2A: HOLD ACTIVE (INSPECTION & CHECKLIST FORM) -->
    {#if isHolding && selectedArmada}
      <div class="space-y-4">
        <!-- Anti-Throttling Live Hold Countdown -->
        <div class="p-4 rounded-3xl bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/40 space-y-2.5 shadow-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Clock class="w-4 h-4 animate-pulse text-amber-400" />
              Kunci Unit Sementara Aktif
            </span>
            <span class="px-2.5 py-0.5 rounded-full bg-amber-500 text-black font-mono font-bold text-xs">
              {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <!-- Progress Bar -->
          <div class="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
            <div
              class="h-full bg-amber-400 transition-all duration-1000"
              style={`width: ${(remainingSeconds / 180) * 100}%`}
            ></div>
          </div>
          <p class="text-[11px] text-zinc-300 leading-tight">
            Unit <span class="text-white font-bold font-mono">{selectedArmada.code}</span> terkunci khusus untuk Anda. Selesaikan checklist fisik berikut sebelum waktu habis.
          </p>
        </div>

        <!-- 6-Point Physical Inspection Checklist -->
        <div class="p-4 rounded-3xl bg-[#15151E] border border-[#262634] space-y-3 shadow-xl">
          <h3 class="text-xs font-bold text-white flex items-center gap-1.5">
            <CheckSquare class="w-4 h-4 text-emerald-400" />
            Checklist Kelayakan Fisik Gerobak
          </h3>

          <div class="space-y-2 text-xs">
            <label class="p-2.5 rounded-xl bg-[#101016] border border-[#242430] flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/40">
              <input type="checkbox" bind:checked={checklist.brakes} class="accent-emerald-500 w-4 h-4 rounded" />
              <span class="text-zinc-200 text-[11px]">Rem Depan & Belakang Pakem & Aman</span>
            </label>

            <label class="p-2.5 rounded-xl bg-[#101016] border border-[#242430] flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/40">
              <input type="checkbox" bind:checked={checklist.tires} class="accent-emerald-500 w-4 h-4 rounded" />
              <span class="text-zinc-200 text-[11px]">Tekanan Angin & Kondisi Roda Prima</span>
            </label>

            <label class="p-2.5 rounded-xl bg-[#101016] border border-[#242430] flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/40">
              <input type="checkbox" bind:checked={checklist.cooler} class="accent-emerald-500 w-4 h-4 rounded" />
              <span class="text-zinc-200 text-[11px]">Box Es / Cooler & Insulasi Dingin Siap</span>
            </label>

            <label class="p-2.5 rounded-xl bg-[#101016] border border-[#242430] flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/40">
              <input type="checkbox" bind:checked={checklist.equipment} class="accent-emerald-500 w-4 h-4 rounded" />
              <span class="text-zinc-200 text-[11px]">Kelengkapan Alat & Termos Kopi Siap</span>
            </label>

            <label class="p-2.5 rounded-xl bg-[#101016] border border-[#242430] flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/40">
              <input type="checkbox" bind:checked={checklist.cleanliness} class="accent-emerald-500 w-4 h-4 rounded" />
              <span class="text-zinc-200 text-[11px]">Kebersihan & Standar Sanitasi Gerobak</span>
            </label>
          </div>

          <div class="pt-2">
            <label for="claim-notes" class="text-[11px] text-zinc-400 block mb-1">Catatan Awal (Opsional):</label>
            <input
              id="claim-notes"
              type="text"
              bind:value={notes}
              placeholder="Kondisi bodi, fungsi lampu, dll."
              class="w-full p-2.5 rounded-xl bg-[#101016] border border-[#282836] text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <!-- Actions -->
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onclick={handleCancelHold}
            disabled={submitting}
            class="py-3 rounded-2xl bg-[#1E1E28] hover:bg-[#282834] text-zinc-300 text-xs font-bold transition-all cursor-pointer"
          >
            Lepas Kunci
          </button>
          <button
            type="button"
            onclick={handleConfirmClaim}
            disabled={submitting || !isChecklistComplete}
            class="py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>Klaim Resmi (IN_USE)</span>
          </button>
        </div>
      </div>

    <!-- STEP 2B: CATALOG FLEET DAFTAR ARMADA DI HUB -->
    {:else}
      <div class="space-y-3">
        <div class="flex items-center justify-between text-xs text-zinc-400">
          <span>Armada Tersedia di Hub Surabaya:</span>
          <button onclick={loadArmadas} class="text-[#FF634A] hover:underline flex items-center gap-1 cursor-pointer">
            <RefreshCw class="w-3 h-3 {loading ? 'animate-spin' : ''}" /> Refresh
          </button>
        </div>

        {#if loading}
          <div class="py-12 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
            <RefreshCw class="w-6 h-6 animate-spin text-emerald-400" />
            <span>Memeriksa ketersediaan unit gerobak...</span>
          </div>
        {:else if armadas.length === 0}
          <div class="p-8 text-center rounded-3xl bg-[#15151E] border border-[#242432] text-xs text-zinc-400">
            Belum ada armada bertipe GEROBAK yang siap diklaim saat ini.
          </div>
        {:else}
          <div class="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {#each armadas as a}
              <div class="p-3.5 rounded-3xl bg-[#15151E] border border-[#242432] hover:border-emerald-500/40 flex items-center justify-between transition-all">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Bike class="w-5 h-5" />
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
                      <span>• {a.status}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onclick={() => handleHoldArmada(a)}
                  disabled={submitting || a.status !== 'AVAILABLE'}
                  class="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500/40 text-emerald-300 hover:text-black font-bold text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  Kunci 3-Min
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</MobileFrame>
