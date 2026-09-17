<script lang="ts">
  import { onMount } from 'svelte';
  import { operationalIntelligenceStore } from '../../lib/stores/operationalIntelligenceStore.svelte.js';
  import { 
    Activity, 
    ShieldCheck, 
    AlertTriangle, 
    Truck, 
    Clock, 
    CheckCircle2, 
    X, 
    RefreshCw, 
    Users, 
    BarChart3,
    AlertOctagon,
    Compass
  } from 'lucide-svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let closeBtnEl = $state<HTMLButtonElement | null>(null);

  onMount(() => {
    operationalIntelligenceStore.fetchFleets();
    closeBtnEl?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const p = $derived(operationalIntelligenceStore.presenceMetrics);
  const f = $derived(operationalIntelligenceStore.fleetMetrics);
  const a = $derived(operationalIntelligenceStore.alertMetrics);

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return 'N/A (Data durasi belum tersedia)';
    if (seconds < 60) return `${seconds} detik`;
    const mins = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins} menit`;
  };
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-outfit-400"
  role="dialog"
  aria-modal="true"
  aria-labelledby="ops-intelligence-title"
>
  <!-- Backdrop click -->
  <button
    type="button"
    aria-label="Tutup modal intelejen"
    class="fixed inset-0 bg-transparent border-0 p-0 m-0 cursor-default"
    onclick={onClose}
  ></button>

  <div class="relative w-full max-w-4xl bg-[#131316] border border-[#272730] rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-6 max-h-[90vh] overflow-y-auto">
    <!-- Header -->
    <div class="flex items-center justify-between pb-4 border-b border-[#24242A]">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-zinc-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20">
          <Activity class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 id="ops-intelligence-title" class="text-lg sm:text-xl font-outfit-600 text-white tracking-tight">
              Intelejen Operasional Real-Time (S7-02)
            </h3>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Live Aggregate
            </span>
          </div>
          <p class="text-xs text-zinc-400 mt-0.5">
            Agregasi deterministik kepatuhan geofence, utilisasi armada, dan metrik penanganan alert.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={() => operationalIntelligenceStore.refreshAll()}
          class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Sinkronkan Ulang Intelejen"
        >
          <RefreshCw class="w-4 h-4 {operationalIntelligenceStore.isLoadingFleets ? 'animate-spin' : ''}" />
        </button>

        <button
          bind:this={closeBtnEl}
          type="button"
          onclick={onClose}
          class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- 1. Kepatuhan Kehadiran & Geofence -->
    <div class="p-5 bg-[#18181C] rounded-2xl border border-[#272730] space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 text-emerald-400" />
          <h4 class="text-sm font-outfit-600 text-zinc-100">1. Distribusi Kepatuhan Rider ({p.total} Aktif)</h4>
        </div>
        {#if !p.hasData}
          <span class="text-[11px] text-zinc-500 italic">Data rider belum tersedia</span>
        {/if}
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <!-- Compliant -->
        <div class="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <span class="text-[11px] text-emerald-400 font-semibold block">Patuh (Compliant)</span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-white font-mono">{p.compliantCount}</span>
            <span class="text-[11px] text-emerald-400 font-mono">
              {p.compliantRate !== null ? `(${p.compliantRate.toFixed(1)}%)` : ''}
            </span>
          </div>
          <span class="text-[10px] text-zinc-500 mt-1 block">Sesuai penugasan zona</span>
        </div>

        <!-- Deviated -->
        <div class="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
          <span class="text-[11px] text-rose-400 font-semibold block">Deviasi (Deviated)</span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-white font-mono">{p.deviatedCount}</span>
            <span class="text-[11px] text-rose-400 font-mono">
              {p.deviatedRate !== null ? `(${p.deviatedRate.toFixed(1)}%)` : ''}
            </span>
          </div>
          <span class="text-[10px] text-zinc-500 mt-1 block">Masuk zona bukan haknya</span>
        </div>

        <!-- Outside -->
        <div class="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <span class="text-[11px] text-zinc-300 font-semibold block">Luar Zona (Outside)</span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-white font-mono">{p.outsideCount}</span>
            <span class="text-[11px] text-zinc-400 font-mono">
              {p.outsideRate !== null ? `(${p.outsideRate.toFixed(1)}%)` : ''}
            </span>
          </div>
          <span class="text-[10px] text-zinc-500 mt-1 block">Di luar batas geofence</span>
        </div>

        <!-- Unassigned -->
        <div class="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <span class="text-[11px] text-amber-400 font-semibold block">Tanpa Tugas (Unassigned)</span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-white font-mono">{p.unassignedCount}</span>
            <span class="text-[11px] text-amber-400 font-mono">
              {p.unassignedRate !== null ? `(${p.unassignedRate.toFixed(1)}%)` : ''}
            </span>
          </div>
          <span class="text-[10px] text-zinc-500 mt-1 block">Belum ada target zona</span>
        </div>
      </div>
    </div>

    <!-- 2. Utilisasi & Alokasi Armada -->
    <div class="p-5 bg-[#18181C] rounded-2xl border border-[#272730] space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Truck class="w-4 h-4 text-cyan-400" />
          <h4 class="text-sm font-outfit-600 text-zinc-100">2. Utilisasi Armada ({f.total} Unit Terdaftar)</h4>
        </div>
        {#if operationalIntelligenceStore.isLoadingFleets}
          <span class="text-[11px] text-cyan-400 animate-pulse">Memuat data armada...</span>
        {/if}
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <!-- In Use -->
        <div class="p-3.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
          <span class="text-[11px] text-cyan-400 font-semibold block">Digunakan (IN_USE)</span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-white font-mono">{f.inUseCount}</span>
            <span class="text-[11px] text-cyan-400 font-mono">
              {f.inUseRate !== null ? `(${f.inUseRate.toFixed(1)}%)` : ''}
            </span>
          </div>
          <span class="text-[10px] text-zinc-500 mt-1 block">Sedang bertugas di lapangan</span>
        </div>

        <!-- Active/Available -->
        <div class="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <span class="text-[11px] text-emerald-400 font-semibold block">Tersedia (ACTIVE)</span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-white font-mono">{f.activeCount}</span>
            <span class="text-[11px] text-emerald-400 font-mono">
              {f.activeRate !== null ? `(${f.activeRate.toFixed(1)}%)` : ''}
            </span>
          </div>
          <span class="text-[10px] text-zinc-500 mt-1 block">Siap diklaim rider</span>
        </div>

        <!-- Reserved -->
        <div class="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20">
          <span class="text-[11px] text-purple-400 font-semibold block">Reservasi (RESERVED)</span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-white font-mono">{f.reservedCount}</span>
            <span class="text-[11px] text-purple-400 font-mono">
              {f.reservedRate !== null ? `(${f.reservedRate.toFixed(1)}%)` : ''}
            </span>
          </div>
          <span class="text-[10px] text-zinc-500 mt-1 block">Lock 5 menit berjalan</span>
        </div>

        <!-- Maintenance -->
        <div class="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
          <span class="text-[11px] text-rose-400 font-semibold block">Perbaikan (MAINTENANCE)</span>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-white font-mono">{f.maintenanceCount}</span>
            <span class="text-[11px] text-rose-400 font-mono">
              {f.maintenanceRate !== null ? `(${f.maintenanceRate.toFixed(1)}%)` : ''}
            </span>
          </div>
          <span class="text-[10px] text-zinc-500 mt-1 block">Dalam perawatan unit</span>
        </div>
      </div>
    </div>

    <!-- 3. Lifecycle & Triage Alert -->
    <div class="p-5 bg-[#18181C] rounded-2xl border border-[#272730] space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <AlertOctagon class="w-4 h-4 text-amber-400" />
          <h4 class="text-sm font-outfit-600 text-zinc-100">3. Status Penanganan Alert ({a.total} Total)</h4>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div class="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
          <span class="text-[11px] text-rose-400 font-medium block">Open (Belum Ditangani)</span>
          <span class="text-lg font-bold text-white font-mono mt-0.5 block">{a.openCount}</span>
        </div>
        <div class="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
          <span class="text-[11px] text-cyan-400 font-medium block">Acknowledged (Diproses)</span>
          <span class="text-lg font-bold text-white font-mono mt-0.5 block">{a.acknowledgedCount}</span>
        </div>
        <div class="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
          <span class="text-[11px] text-emerald-400 font-medium block">Resolved (Selesai)</span>
          <span class="text-lg font-bold text-white font-mono mt-0.5 block">{a.resolvedCount}</span>
        </div>
        <div class="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
          <span class="text-[11px] text-blue-400 font-medium block">Auto Recovered</span>
          <span class="text-lg font-bold text-white font-mono mt-0.5 block">{a.autoRecoveredCount}</span>
        </div>
      </div>

      <!-- Resolution Latency Notice -->
      <div class="p-3 rounded-xl bg-[#131316] border border-[#24242A] flex items-center justify-between text-xs">
        <div class="flex items-center gap-2 text-zinc-300">
          <Clock class="w-4 h-4 text-amber-400" />
          <span>Rata-rata Waktu Penyelesaian Alert:</span>
        </div>
        <span class="font-mono font-bold text-zinc-100">
          {formatDuration(a.avgResolutionSeconds)}
        </span>
      </div>
    </div>

    <!-- Footer -->
    <div class="pt-3 border-t border-[#24242A] flex justify-end">
      <button
        type="button"
        onclick={onClose}
        class="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-outfit-600 transition-colors cursor-pointer"
      >
        Tutup Tampilan Intelejen
      </button>
    </div>
  </div>
</div>
