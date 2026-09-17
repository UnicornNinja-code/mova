<script lang="ts">
  import { X, CheckCircle2, Clock, MapPin, Sparkles, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-svelte';
  import { distributionService } from '../../services/distributionService';

  interface Props {
    open: boolean;
    onClose: () => void;
    currentDutyStatus?: string;
    assignedZoneName?: string;
    sessionCode?: string;
    timeSlot?: string;
    onDutyConfirmed?: () => void;
    onProceedToArmada?: () => void;
  }

  let {
    open = false,
    onClose,
    currentDutyStatus = 'UNCONFIRMED',
    assignedZoneName = '',
    sessionCode = '20260903-PAGI',
    timeSlot = 'PAGI',
    onDutyConfirmed = () => {},
    onProceedToArmada = () => {},
  }: Props = $props();

  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  const handleConfirmDuty = async () => {
    submitting = true;
    errorMsg = null;
    successMsg = null;
    try {
      const res = await distributionService.confirmDuty();
      successMsg = res.message || res.msg || 'Presensi kehadiran berhasil dikonfirmasi!';
      onDutyConfirmed();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal mengonfirmasi presensi tugas.';
    } finally {
      submitting = false;
    }
  };
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm select-none animate-in fade-in duration-200 font-outfit-400">
    <!-- Clickable backdrop scrim -->
    <button
      type="button"
      class="fixed inset-0 w-full h-full bg-black/50 cursor-default focus:outline-none"
      onclick={onClose}
      aria-label="Tutup modal presensi"
    ></button>

    <!-- Modal Content -->
    <div
      class="relative z-10 w-full sm:max-w-md bg-[#131317] border-t sm:border border-[#262632] rounded-t-[32px] sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-8 duration-300"
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-2 border-b border-[#24242E]">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] flex items-center justify-center text-white shadow-md shadow-[#FF634A]/20">
            <Clock class="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 class="text-sm font-outfit-600 font-bold text-white">Presensi Tugas Operasional</h3>
            <p class="text-[11px] text-zinc-400">Shift {timeSlot} • {sessionCode}</p>
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
          <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      {#if successMsg}
        <div class="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      {/if}

      <!-- State: PLOTTED (Assigned to Zone) -->
      {#if currentDutyStatus === 'PLOTTED' || assignedZoneName}
        <div class="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-[#131317] border border-emerald-500/30 space-y-3">
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
              <CheckCircle2 class="w-3 h-3" /> SUDAH DI-PLOT KE ZONA
            </span>
            <span class="text-[10px] text-zinc-400">Siap Bertugas</span>
          </div>

          <div class="space-y-1">
            <span class="text-[11px] text-zinc-400">Zona Penugasan Hari Ini:</span>
            <h4 class="text-base font-outfit-600 font-bold text-white flex items-center gap-1.5 text-emerald-300">
              <MapPin class="w-4 h-4 text-[#FF634A]" />
              {assignedZoneName}
            </h4>
          </div>

          <p class="text-[11px] text-zinc-300">
            Penugasan zona Anda telah disetujui. Langkah selanjutnya adalah melakukan inspeksi dan klaim unit gerobak armada di Hub.
          </p>

          <button
            type="button"
            onclick={() => { onClose(); onProceedToArmada(); }}
            class="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
          >
            <span>Lanjut Klaim Armada Hub</span>
            <ArrowRight class="w-3.5 h-3.5" />
          </button>
        </div>

      <!-- State: WAITING (In Queue for DSS/Supervisor Plotting) -->
      {:else if currentDutyStatus === 'WAITING'}
        <div class="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 to-[#131317] border border-amber-500/30 space-y-3">
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
              <Clock class="w-3 h-3 animate-spin" /> DALAM ANTREAN FIFO
            </span>
            <span class="text-[10px] text-zinc-400">Menunggu Plotting</span>
          </div>

          <p class="text-xs text-zinc-200">
            Presensi Anda telah tercatat! Sistem DSS sedang menghitung alokasi prioritas zona dan menunggu konfirmasi Supervisor.
          </p>

          <div class="p-2.5 rounded-xl bg-[#1A1A22] border border-[#2A2A38] text-[11px] text-zinc-400 flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-[#FF634A] shrink-0" />
            <span>Zona tugas akan muncul secara otomatis saat plotting selesai.</span>
          </div>
        </div>

      <!-- State: UNCONFIRMED (Prompting Duty Confirmation) -->
      {:else}
        <div class="p-4 rounded-2xl bg-[#181820] border border-[#282834] space-y-3">
          <p class="text-xs text-zinc-300">
            Konfirmasi kehadiran apel pagi untuk mendaftarkan nama Anda ke antrean alokasi penugasan zona harian MantaKopi.
          </p>

          <div class="space-y-1.5 text-[11px] text-zinc-400">
            <div class="flex items-center gap-2">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
              <span>Memenuhi kriteria jam operasional shift ({timeSlot})</span>
            </div>
            <div class="flex items-center gap-2">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
              <span>Prioritas alokasi dihitung otomatis via SPK TOPSIS</span>
            </div>
          </div>

          <button
            type="button"
            onclick={handleConfirmDuty}
            disabled={submitting}
            class="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#FF4D30] hover:to-[#FF634A] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-[#FF634A]/25 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>{submitting ? 'Memproses Presensi...' : 'Konfirmasi Hadir Siap Bertugas'}</span>
          </button>
        </div>
      {/if}

      <!-- Close Action -->
      <button
        type="button"
        onclick={onClose}
        class="w-full py-2 text-center text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
      >
        Tutup
      </button>
    </div>
  </div>
{/if}
