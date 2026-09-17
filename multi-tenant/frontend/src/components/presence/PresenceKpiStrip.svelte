<script lang="ts">
  import { presenceStore } from '../../lib/stores/presenceStore.svelte';
  import { CheckCircle2, AlertTriangle, HelpCircle, MapPinOff, ShieldAlert } from 'lucide-svelte';

  const setFilter = (status: string) => {
    if (presenceStore.activeStatusFilter === status) {
      presenceStore.setStatusFilter('ALL');
    } else {
      presenceStore.setStatusFilter(status);
    }
  };
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <!-- 1. Compliant Card -->
  <button
    type="button"
    onclick={() => setFilter('COMPLIANT')}
    class="p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer {presenceStore.activeStatusFilter === 'COMPLIANT'
      ? 'bg-emerald-500/10 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/90'}"
  >
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
        <CheckCircle2 class="w-4 h-4" />
        Sesuai Tugas (Compliant)
      </span>
      <span class="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-300">
        {presenceStore.kpi.total > 0 ? Math.round((presenceStore.kpi.compliant / presenceStore.kpi.total) * 100) : 0}%
      </span>
    </div>
    <div class="text-3xl font-extrabold text-zinc-100">{presenceStore.kpi.compliant}</div>
    <p class="text-xs text-zinc-400 mt-1">Rider berada di dalam polygon zona tugasnya</p>
  </button>

  <!-- 2. Deviated Card -->
  <button
    type="button"
    onclick={() => setFilter('DEVIATED')}
    class="p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden {presenceStore.activeStatusFilter === 'DEVIATED'
      ? 'bg-amber-500/10 border-amber-500 shadow-md ring-2 ring-amber-500/30'
      : presenceStore.kpi.deviated > 0
      ? 'bg-zinc-900/60 border-amber-500/40 hover:bg-zinc-900/90'
      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/90'}"
  >
    {#if presenceStore.kpi.deviated > 0}
      <div class="absolute top-0 right-0 w-2 h-2 rounded-bl bg-amber-500 animate-ping"></div>
    {/if}
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
        <AlertTriangle class="w-4 h-4" />
        Deviasi (Deviated)
      </span>
      {#if presenceStore.kpi.openAlertsCount > 0}
        <span class="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 flex items-center gap-1">
          <ShieldAlert class="w-3 h-3" />
          {presenceStore.kpi.openAlertsCount} Alert
        </span>
      {/if}
    </div>
    <div class="text-3xl font-extrabold {presenceStore.kpi.deviated > 0 ? 'text-amber-400' : 'text-zinc-100'}">
      {presenceStore.kpi.deviated}
    </div>
    <p class="text-xs text-zinc-400 mt-1">Berada di luar zona yang ditugaskan</p>
  </button>

  <!-- 3. Unassigned Card -->
  <button
    type="button"
    onclick={() => setFilter('UNASSIGNED')}
    class="p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer {presenceStore.activeStatusFilter === 'UNASSIGNED'
      ? 'bg-blue-500/10 border-blue-500 shadow-md ring-2 ring-blue-500/30'
      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/90'}"
  >
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
        <HelpCircle class="w-4 h-4" />
        Belum Ditugaskan
      </span>
      <span class="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500/20 text-blue-300">
        Standby
      </span>
    </div>
    <div class="text-3xl font-extrabold text-zinc-100">{presenceStore.kpi.unassigned}</div>
    <p class="text-xs text-zinc-400 mt-1">Di dalam zona tanpa jadwal penugasan resmi</p>
  </button>

  <!-- 4. Outside Zone Card -->
  <button
    type="button"
    onclick={() => setFilter('OUTSIDE')}
    class="p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer {presenceStore.activeStatusFilter === 'OUTSIDE'
      ? 'bg-purple-500/10 border-purple-500 shadow-md ring-2 ring-purple-500/30'
      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/90'}"
  >
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
        <MapPinOff class="w-4 h-4" />
        Di Luar Zona
      </span>
      <span class="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-500/20 text-purple-300">
        Transit
      </span>
    </div>
    <div class="text-3xl font-extrabold text-zinc-100">{presenceStore.kpi.outside}</div>
    <p class="text-xs text-zinc-400 mt-1">Posisi berada di luar seluruh polygon operasional</p>
  </button>
</div>
