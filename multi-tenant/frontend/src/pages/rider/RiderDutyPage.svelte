<script lang="ts">
  import { onMount } from 'svelte';
  import MobileFrame from '../../components/ui/MobileFrame.svelte';
  import { 
    Clock, 
    ArrowLeft, 
    CheckCircle2, 
    MapPin, 
    Sparkles, 
    ShieldCheck, 
    ArrowRight, 
    AlertCircle,
    Users
  } from 'lucide-svelte';
  import { distributionService } from '../../services/distributionService';
  import { riderService, type RiderActiveSession } from '../../services/riderService';
  import { router } from '../../lib/stores/router.svelte';

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let loading = $state(true);
  let submitting = $state(false);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);
  let sessionData = $state<RiderActiveSession | null>(null);

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      router.navigate(path);
    }
  };

  const loadData = async () => {
    loading = true;
    errorMsg = null;
    try {
      const sess = await riderService.getActiveSession();
      sessionData = sess;
    } catch (err: any) {
      console.warn('Gagal memuat sesi tugas rider:', err);
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    loadData();
  });

  const handleConfirmDuty = async () => {
    submitting = true;
    errorMsg = null;
    successMsg = null;
    try {
      const res = await distributionService.confirmDuty();
      successMsg = res.message || res.msg || 'Presensi apel pagi berhasil dicatat!';
      await loadData();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal mengonfirmasi presensi tugas.';
    } finally {
      submitting = false;
    }
  };

  const dutyStatus = $derived(sessionData?.duty?.status || 'UNCONFIRMED');
  const assignedZoneName = $derived(sessionData?.duty?.zone_name || '');
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
      <h2 class="text-xs font-outfit-600 font-bold text-white uppercase tracking-wider">Langkah 1 dari 5</h2>
      <p class="text-[11px] text-zinc-400">Presensi & Plotting Zona</p>
    </div>

    <div class="w-8 h-8 rounded-full bg-[#FF634A]/15 text-[#FF634A] border border-[#FF634A]/30 flex items-center justify-center text-xs font-bold font-mono">
      1
    </div>
  </div>

  <div class="space-y-4 font-outfit-400">
    <!-- Session Information Banner -->
    <div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#1C1C26] to-[#14141A] border border-[#2B2B3C] flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-[#FF634A]/20 text-[#FF634A] flex items-center justify-center">
          <Clock class="w-4 h-4" />
        </div>
        <div>
          <span class="text-[10px] text-zinc-400 block font-mono">SESI SHIFT HARI INI</span>
          <span class="text-xs font-bold text-white">Shift Pagi • Operasional Hub</span>
        </div>
      </div>
      <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
        AKTIF
      </span>
    </div>

    {#if errorMsg}
      <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
        <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
        <span>{errorMsg}</span>
      </div>
    {/if}

    {#if successMsg}
      <div class="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400" />
        <span>{successMsg}</span>
      </div>
    {/if}

    <!-- State 1: Plotted to Zone -->
    {#if dutyStatus === 'ASSIGNED' || dutyStatus === 'ACTIVE' || assignedZoneName}
      <div class="p-4 rounded-3xl bg-gradient-to-br from-emerald-500/15 to-[#131317] border border-emerald-500/30 space-y-3.5 shadow-xl">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
            <CheckCircle2 class="w-3 h-3" /> SUDAH DI-PLOT KE ZONA
          </span>
          <span class="text-[10px] text-zinc-400 font-mono">FIFO Committed</span>
        </div>

        <div class="space-y-1">
          <span class="text-[11px] text-zinc-400">Zona Penugasan Anda:</span>
          <h3 class="text-base font-outfit-600 font-bold text-white flex items-center gap-1.5 text-emerald-300">
            <MapPin class="w-4 h-4 text-[#FF634A]" />
            {assignedZoneName}
          </h3>
        </div>

        <p class="text-xs text-zinc-300 leading-relaxed">
          Penugasan zona telah disetujui Supervisor. Langkah selanjutnya adalah memilih dan mengunci gerobak armada di Hub Surabaya.
        </p>

        <button
          type="button"
          onclick={() => navigateTo('/rider/armada')}
          class="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
        >
          <span>Lanjut ke Langkah 2: Klaim Armada Hub</span>
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>

    <!-- State 2: Waiting in Queue -->
    {:else if dutyStatus === 'QUEUED'}
      <div class="p-4 rounded-3xl bg-gradient-to-br from-amber-500/15 to-[#131317] border border-amber-500/30 space-y-3.5 shadow-xl">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <Clock class="w-3 h-3 animate-spin" /> DALAM ANTREAN FIFO
          </span>
          <span class="text-[10px] text-zinc-400 font-mono">Standby Queue</span>
        </div>

        <div class="space-y-1">
          <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
            <Users class="w-4 h-4 text-amber-400" />
            Menunggu Hasil Evaluasi TOPSIS
          </h3>
          <p class="text-xs text-zinc-300 leading-relaxed">
            Presensi apel pagi Anda telah tercatat. Mesin DSS sedang menghitung alokasi prioritas zona dan menunggu konfirmasi Supervisor.
          </p>
        </div>

        <div class="p-3 rounded-2xl bg-[#181822] border border-[#282836] text-[11px] text-zinc-400 flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-[#FF634A] shrink-0" />
          <span>Halaman akan otomatis menampilkan zona Anda begitu alokasi selesai di-commit.</span>
        </div>
      </div>

    <!-- State 3: Unconfirmed Duty -->
    {:else}
      <div class="p-4 rounded-3xl bg-[#161620] border border-[#272736] space-y-4 shadow-xl">
        <div class="space-y-1">
          <h3 class="text-sm font-bold text-white">Konfirmasi Kehadiran Tugas</h3>
          <p class="text-xs text-zinc-400 leading-relaxed">
            Daftarkan diri Anda ke antrean alokasi penugasan zona harian sebelum batas waktu apel pagi ditutup.
          </p>
        </div>

        <div class="space-y-2 text-xs text-zinc-300">
          <div class="flex items-center gap-2 p-2.5 rounded-xl bg-[#121218] border border-[#22222E]">
            <ShieldCheck class="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Memenuhi standar kriteria jam kehadiran shift</span>
          </div>
          <div class="flex items-center gap-2 p-2.5 rounded-xl bg-[#121218] border border-[#22222E]">
            <ShieldCheck class="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Alokasi zona diproses otomatis via SPK TOPSIS</span>
          </div>
        </div>

        <button
          type="button"
          onclick={handleConfirmDuty}
          disabled={submitting}
          class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#FF4D30] hover:to-[#FF634A] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF634A]/25 cursor-pointer disabled:opacity-50 active:scale-95"
        >
          <CheckCircle2 class="w-4 h-4" />
          <span>{submitting ? 'Mencatat Kehadiran...' : 'Konfirmasi Hadir Siap Bertugas'}</span>
        </button>
      </div>
    {/if}
  </div>
</MobileFrame>
