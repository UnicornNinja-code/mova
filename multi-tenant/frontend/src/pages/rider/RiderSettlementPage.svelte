<script lang="ts">
  import { onMount } from 'svelte';
  import MobileFrame from '../../components/ui/MobileFrame.svelte';
  import { 
    CheckCircle2, 
    ArrowLeft, 
    Banknote, 
    Coffee, 
    AlertTriangle, 
    ShieldCheck, 
    ArrowRight 
  } from 'lucide-svelte';
  import { riderService, type RiderActiveSession } from '../../services/riderService';
  import { authStore } from '../../lib/stores/auth.svelte';
  import { router } from '../../lib/stores/router.svelte';

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let sessionData = $state<RiderActiveSession | null>(null);
  let totalRevenueToday = $state(195000);
  let totalCupsSold = $state(13);

  let returnStatus = $state<'ACTIVE' | 'MAINTENANCE'>('ACTIVE');
  let remainingCups = $state(7);
  let actualCashSubmitted = $state<number>(195000);
  let discrepancyReason = $state('');
  let inspectionNotes = $state('');

  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);
  let isSettled = $state(false);

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      router.navigate(path);
    }
  };

  const loadData = async () => {
    try {
      const sess = await riderService.getActiveSession();
      sessionData = sess;
    } catch (err: any) {
      console.warn('Gagal memuat sesi shift:', err);
    }
  };

  const discrepancyAmount = $derived(
    actualCashSubmitted - totalRevenueToday
  );

  const handleCheckoutSubmit = async (e: SubmitEvent) => {
    e.preventDefault();

    if (discrepancyAmount !== 0 && !discrepancyReason.trim()) {
      errorMsg = 'Terdapat selisih kas fisik. Wajib mengisi alasan selisih kas.';
      return;
    }

    submitting = true;
    errorMsg = null;
    try {
      await riderService.checkoutSession({
        return_status: returnStatus,
        inspection_condition: {
          cleanliness: 'GOOD',
          frame_condition: returnStatus === 'ACTIVE' ? 'GOOD' : 'NEEDS_REPAIR',
        },
        notes: inspectionNotes.trim() || 'Penyelesaian shift sore dan setor kas',
        remaining_cups: remainingCups,
        actual_cash_submitted: actualCashSubmitted,
        discrepancy_amount: discrepancyAmount,
        discrepancy_reason: discrepancyReason.trim(),
      });

      isSettled = true;
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memproses penutupan shift operasional.';
    } finally {
      submitting = false;
    }
  };

  const handleFinishAndLogout = () => {
    authStore.logout();
    navigateTo('/login');
  };

  onMount(() => {
    loadData();
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
      <h2 class="text-xs font-outfit-600 font-bold text-white uppercase tracking-wider">Langkah 5 dari 5</h2>
      <p class="text-[11px] text-zinc-400">Settlement Kas & Setor Gerobak</p>
    </div>

    <div class="w-8 h-8 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xs font-bold font-mono">
      5
    </div>
  </div>

  <div class="space-y-4 font-outfit-400">
    {#if isSettled}
      <!-- Settled Success State -->
      <div class="p-6 rounded-3xl bg-gradient-to-br from-purple-950/50 to-[#131317] border border-purple-500/30 text-center space-y-4 shadow-2xl">
        <div class="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center mx-auto">
          <CheckCircle2 class="w-8 h-8 stroke-[2.2]" />
        </div>

        <div>
          <h3 class="text-lg font-bold text-white">Shift Selesai & Disetor!</h3>
          <p class="text-xs text-zinc-300 mt-1">
            Data penjualan, sisa stok, dan rekonsiliasi kas telah resmi tercatat di database Hub Surabaya. Posisi Anda telah dibersihkan dari radar LBS.
          </p>
        </div>

        <div class="p-3 rounded-2xl bg-black/40 border border-[#242432] space-y-2 text-xs">
          <div class="flex items-center justify-between text-zinc-400">
            <span>Total Terjual:</span>
            <span class="text-white font-bold">{totalCupsSold} Cup</span>
          </div>
          <div class="flex items-center justify-between text-zinc-400">
            <span>Kas Disetor:</span>
            <span class="text-emerald-400 font-bold font-mono">Rp {actualCashSubmitted.toLocaleString('id-ID')}</span>
          </div>
          <div class="flex items-center justify-between text-zinc-400">
            <span>Status Armada:</span>
            <span class="text-white font-bold font-mono">{returnStatus}</span>
          </div>
        </div>

        <button
          type="button"
          onclick={handleFinishAndLogout}
          class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25 cursor-pointer active:scale-95"
        >
          <span>Selesai & Keluar Sesi</span>
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>

    {:else}
      {#if errorMsg}
        <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <form onsubmit={handleCheckoutSubmit} class="space-y-3.5 text-xs">
        <!-- 1. Kondisi Fisik Pengembalian Armada -->
        <div class="p-4 rounded-3xl bg-[#15151E] border border-[#262634] space-y-3 shadow-xl">
          <div class="flex items-center justify-between">
            <span class="text-zinc-200 font-bold flex items-center gap-1.5">
              <ShieldCheck class="w-4 h-4 text-emerald-400" />
              Kondisi Fisik Armada:
            </span>
          </div>

          <!-- Status Kondisi Armada -->
          <div class="flex items-center justify-between pt-1">
            <span class="text-zinc-400 text-[11px]">Pemeriksaan Unit:</span>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onclick={() => (returnStatus = 'ACTIVE')}
                class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  returnStatus === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                Normal / Baik
              </button>
              <button
                type="button"
                onclick={() => (returnStatus = 'MAINTENANCE')}
                class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  returnStatus === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                Normal / Baik
              </button>
              <button
                type="button"
                onclick={() => (returnStatus = 'MAINTENANCE')}
                class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  returnStatus === 'MAINTENANCE'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                Perlu Servis
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Sisa Stok Cup -->
        <div class="p-4 rounded-3xl bg-[#15151E] border border-[#262634] flex items-center justify-between shadow-xl">
          <div class="space-y-0.5">
            <span class="text-zinc-200 font-bold flex items-center gap-1.5">
              <Coffee class="w-4 h-4 text-[#FF634A]" />
              Sisa Cup Kopi di Gerobak:
            </span>
            <p class="text-[10px] text-zinc-500">Stok awal 20 cup - {totalCupsSold} terjual</p>
          </div>

          <div class="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="50"
              bind:value={remainingCups}
              class="w-16 p-1.5 rounded-xl bg-black/40 border border-[#2E2E3C] text-center font-mono font-bold text-white focus:outline-none focus:border-[#FF634A]"
            />
            <span class="text-zinc-400 text-[11px]">Cup</span>
          </div>
        </div>

        <!-- 3. Rekonsiliasi Kas -->
        <div class="p-4 rounded-3xl bg-[#15151E] border border-[#262634] space-y-2.5 shadow-xl">
          <div class="flex items-center justify-between text-xs">
            <span class="text-zinc-400">Total Penjualan Sistem:</span>
            <span class="font-mono font-bold text-white">
              Rp {totalRevenueToday.toLocaleString('id-ID')}
            </span>
          </div>

          <div class="flex items-center justify-between gap-2">
            <label for="actual-cash" class="text-zinc-200 font-bold shrink-0 flex items-center gap-1.5">
              <Banknote class="w-4 h-4 text-emerald-400" />
              Kas Fisik Disetor:
            </label>
            <div class="flex items-center gap-1">
              <span class="text-zinc-500">Rp</span>
              <input
                id="actual-cash"
                type="number"
                bind:value={actualCashSubmitted}
                required
                class="w-28 p-1.5 rounded-xl bg-black/40 border border-[#2E2E3C] text-right font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <!-- Discrepancy Indicator -->
          <div class="flex items-center justify-between pt-1 border-t border-[#242430] text-[11px]">
            <span class="text-zinc-400">Status Selisih:</span>
            {#if discrepancyAmount === 0}
              <span class="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 class="w-3.5 h-3.5" /> Pas (Rp 0)
              </span>
            {:else if discrepancyAmount < 0}
              <span class="text-rose-400 font-bold font-mono">
                Kurang: -Rp {Math.abs(discrepancyAmount).toLocaleString('id-ID')}
              </span>
            {:else}
              <span class="text-sky-400 font-bold font-mono">
                Lebih: +Rp {discrepancyAmount.toLocaleString('id-ID')}
              </span>
            {/if}
          </div>

          {#if discrepancyAmount !== 0}
            <div class="space-y-1 pt-1">
              <label for="discrepancy-reason" class="text-rose-300 font-bold text-[10px] block">
                Alasan Selisih Kas (Wajib diisi):
              </label>
              <input
                id="discrepancy-reason"
                type="text"
                bind:value={discrepancyReason}
                required
                placeholder="Penjelasan selisih kas fisik..."
                class="w-full p-2 rounded-xl bg-black/40 border border-rose-500/40 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          {/if}
        </div>

        <button
          type="submit"
          disabled={submitting}
          class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25 cursor-pointer disabled:opacity-50 active:scale-95"
        >
          <CheckCircle2 class="w-4 h-4" />
          <span>{submitting ? 'Memproses Settlement...' : 'Tutup Shift & Setor Kas'}</span>
        </button>
      </form>
    {/if}
  </div>
</MobileFrame>
