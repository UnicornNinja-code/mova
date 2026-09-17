<script lang="ts">
  import { presenceStore } from '../../lib/stores/presenceStore.svelte';
  import { ShieldAlert, CheckCircle2, Crosshair, AlertOctagon, Clock } from 'lucide-svelte';

  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}d lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
    return `${Math.floor(diff / 3600)}j lalu`;
  };

  const handleAcknowledge = (alertId: string) => {
    presenceStore.acknowledgeAlert(alertId, 'Supervisor Lapangan');
  };

  const handleResolve = (alertId: string) => {
    presenceStore.resolveAlert(alertId, 'Supervisor Lapangan', 'Insiden diselesaikan via koordinasi radio/seluler.');
  };

  const handleFocus = (riderId: string) => {
    presenceStore.focusRider(riderId);
  };
</script>

<div class="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 h-[520px] flex flex-col">
  <!-- Header -->
  <div class="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
    <div class="flex items-center gap-2">
      <ShieldAlert class="w-4 h-4 text-amber-400" />
      <h3 class="text-sm font-bold text-zinc-100">Antrean Alert Deviasi</h3>
    </div>
    <span class="px-2 py-0.5 text-xs font-bold rounded-full {presenceStore.kpi.openAlertsCount > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'}">
      {presenceStore.kpi.openAlertsCount} Aktif
    </span>
  </div>

  <!-- Alert List -->
  <div class="flex-1 overflow-y-auto space-y-3 pr-1">
    {#if presenceStore.activeAlerts.length === 0}
      <div class="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
        <CheckCircle2 class="w-10 h-10 text-emerald-500/60 mb-2" />
        <p class="text-xs font-semibold text-zinc-300">Semua Operasi Sesuai Tugas</p>
        <p class="text-[11px] text-zinc-500 mt-0.5">Tidak ada deviasi batas zona atau pelanggaran rute aktif saat ini.</p>
      </div>
    {:else}
      {#each presenceStore.activeAlerts as alert (alert.alert_id)}
        <div class="p-3.5 rounded-lg border transition-all {alert.status === 'OPEN'
          ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
          : alert.status === 'ACKNOWLEDGED'
          ? 'bg-zinc-800/60 border-zinc-700/80'
          : 'bg-zinc-900/40 border-zinc-800 opacity-60'}">
          
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-zinc-100">{alert.rider_name}</span>
                <span class="px-1.5 py-0.2 text-[10px] font-extrabold rounded {alert.status === 'OPEN' ? 'bg-amber-500 text-zinc-950 animate-pulse' : 'bg-zinc-700 text-zinc-300'}">
                  {alert.status}
                </span>
              </div>
              <p class="text-[11px] text-amber-400/90 font-medium mt-0.5">
                {alert.deviation_type === 'ZONE_DEVIATION' ? '⚠️ Keluar dari Zona Tugas' : '🚨 Deviasi Operasional'}
              </p>
            </div>
            <span class="text-[10px] text-zinc-400 flex items-center gap-1">
              <Clock class="w-3 h-3" />
              {formatTimeAgo(alert.created_at)}
            </span>
          </div>

          <div class="text-[11px] space-y-0.5 text-zinc-300 bg-zinc-950/40 p-2 rounded border border-zinc-800/80 mb-3">
            <div><b>Zona Tugas:</b> {alert.assigned_zone_name || 'Tidak Ada'}</div>
            <div><b>Posisi Saat Ini:</b> {alert.actual_zone_name || 'Di Luar Wilayah Operasi'}</div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onclick={() => handleFocus(alert.rider_id)}
              class="text-xs text-zinc-300 hover:text-zinc-100 flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
            >
              <Crosshair class="w-3 h-3 text-amber-400" />
              Fokus Map
            </button>

            <div class="flex items-center gap-1.5">
              {#if alert.status === 'OPEN'}
                <button
                  type="button"
                  onclick={() => handleAcknowledge(alert.alert_id)}
                  class="text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                >
                  Acknowledge
                </button>
              {:else if alert.status === 'ACKNOWLEDGED'}
                <button
                  type="button"
                  onclick={() => handleResolve(alert.alert_id)}
                  class="text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                >
                  Resolve
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
