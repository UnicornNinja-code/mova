<script lang="ts">
  import { 
    X, 
    CheckCircle2, 
    Banknote, 
    Coffee, 
    AlertTriangle, 
    ShieldCheck, 
    ArrowRight,
    Sparkles
  } from 'lucide-svelte';
  import { riderService } from '../../services/riderService';

  interface Props {
    open: boolean;
    onClose: () => void;
    totalRevenueToday?: number;
    totalCupsSold?: number;
    onCheckoutSuccess: (result: any) => void;
  }

  let {
    open = false,
    onClose,
    totalRevenueToday = 195000,
    totalCupsSold = 13,
    onCheckoutSuccess,
  }: Props = $props();

  let returnStatus = $state<'ACTIVE' | 'MAINTENANCE'>('ACTIVE');
  let remainingCups = $state(7);
  let actualCashSubmitted = $state<number>(0);
  let discrepancyReason = $state('');
  let inspectionNotes = $state('');

  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);

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
      const res = await riderService.checkoutSession({
        return_status: returnStatus,
        inspection_condition: {
          cleanliness: 'GOOD',
          frame_condition: returnStatus === 'ACTIVE' ? 'GOOD' : 'NEEDS_REPAIR',
        },
        notes: inspectionNotes.trim() || 'Penyelesaian shift operasional sore',
        remaining_cups: remainingCups,
        actual_cash_submitted: actualCashSubmitted,
        discrepancy_amount: discrepancyAmount,
        discrepancy_reason: discrepancyReason.trim(),
      });

      onCheckoutSuccess(res);
      onClose();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menyelesaikan sesi checkout shift.';
    } finally {
      submitting = false;
    }
  };

  $effect(() => {
    if (open) {
      actualCashSubmitted = totalRevenueToday;
    }
  });
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200 font-outfit-400">
    <!-- Backdrop -->
    <button
      type="button"
      class="fixed inset-0 w-full h-full bg-black/50 cursor-default focus:outline-none"
      onclick={onClose}
      aria-label="Tutup modal checkout"
    ></button>

    <div
      class="relative z-10 w-full sm:max-w-lg bg-[#131317] border-t sm:border border-[#262632] rounded-t-[32px] sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-2.5 border-b border-[#24242E]">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-400 flex items-center justify-center text-white font-bold shadow-md shadow-purple-500/20">
            <CheckCircle2 class="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 class="text-sm font-outfit-600 font-bold text-white">Selesai Shift & Settlement Kas</h3>
            <p class="text-[11px] text-zinc-400">Pengembalian armada & rekonsiliasi kas</p>
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

      <form onsubmit={handleCheckoutSubmit} class="space-y-3.5 text-xs">
        <!-- 1. Kondisi Fisik Pengembalian Armada -->
        <div class="p-3.5 rounded-2xl bg-[#181822] border border-[#272736] space-y-3">
          <!-- Status Kondisi Armada -->
          <div class="flex items-center justify-between">
            <span class="text-zinc-300 font-bold">Kondisi Fisik Pengembalian:</span>
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

        <!-- 2. Sisa Stok Cup Fisik -->
        <div class="p-3.5 rounded-2xl bg-[#181822] border border-[#272736] flex items-center justify-between">
          <div class="space-y-0.5">
            <span class="text-zinc-300 font-bold flex items-center gap-1.5">
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
              class="w-16 p-1.5 rounded-lg bg-[#111116] border border-[#2E2E3C] text-center font-mono font-bold text-white focus:outline-none focus:border-[#FF634A]"
            />
            <span class="text-zinc-400 text-[11px]">Cup</span>
          </div>
        </div>

        <!-- 3. Rekonsiliasi Kas & Selisih Fisik -->
        <div class="p-3.5 rounded-2xl bg-[#181822] border border-[#272736] space-y-2.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-zinc-400">Total Penjualan Sistem (Omzet):</span>
            <span class="font-mono font-bold text-white">
              Rp {totalRevenueToday.toLocaleString('id-ID')}
            </span>
          </div>

          <div class="flex items-center justify-between gap-2">
            <label for="actual-cash-input" class="text-zinc-300 font-bold shrink-0 flex items-center gap-1.5">
              <Banknote class="w-4 h-4 text-emerald-400" />
              Kas Fisik yang Disetor:
            </label>
            <div class="flex items-center gap-1">
              <span class="text-zinc-500">Rp</span>
              <input
                id="actual-cash-input"
                type="number"
                bind:value={actualCashSubmitted}
                required
                class="w-28 p-1.5 rounded-lg bg-[#111116] border border-[#2E2E3C] text-right font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <!-- Discrepancy Indicator -->
          <div class="flex items-center justify-between pt-1 border-t border-[#232330] text-[11px]">
            <span class="text-zinc-400">Status Selisih Kas:</span>
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

          <!-- Discrepancy Reason Required if Discrepancy != 0 -->
          {#if discrepancyAmount !== 0}
            <div class="space-y-1 pt-1">
              <label for="discrepancy-reason-input" class="text-rose-300 font-bold text-[10px] block">
                Alasan Selisih Kas (Wajib diisi):
              </label>
              <input
                id="discrepancy-reason-input"
                type="text"
                bind:value={discrepancyReason}
                required
                placeholder="Contoh: Salah kembalian 1x transaksi, kembalian lebih Rp 1.000"
                class="w-full p-2 rounded-lg bg-[#111116] border border-rose-500/40 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          {/if}
        </div>

        <!-- 4. Catatan Checkout -->
        <div class="space-y-1">
          <label for="checkout-notes" class="text-zinc-400 text-[11px]">Catatan Petugas Hub / Rider:</label>
          <input
            id="checkout-notes"
            type="text"
            bind:value={inspectionNotes}
            placeholder="Contoh: Gerobak dalam kondisi bersih dan baterai telah ditancapkan charger"
            class="w-full p-2.5 rounded-xl bg-[#181822] border border-[#272736] text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <!-- Action Buttons -->
        <div class="pt-2 border-t border-[#24242E] flex items-center justify-end gap-2">
          <button
            type="button"
            onclick={onClose}
            class="px-4 py-2.5 rounded-xl bg-[#1E1E28] hover:bg-[#282834] text-zinc-300 text-xs font-bold transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-purple-500/25 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>{submitting ? 'Menyimpan Settlement...' : 'Tutup Shift & Setor Armada'}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
