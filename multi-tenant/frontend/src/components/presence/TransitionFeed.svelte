<script lang="ts">
  import { presenceStore } from '../../lib/stores/presenceStore.svelte';
  import { Activity, ArrowRightCircle, ArrowLeftCircle, CheckCircle, AlertCircle } from 'lucide-svelte';

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'ENTER':
        return ArrowRightCircle;
      case 'EXIT':
        return ArrowLeftCircle;
      case 'DEVIATED':
        return AlertCircle;
      default:
        return CheckCircle;
    }
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'ENTER':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'EXIT':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'DEVIATED':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };
</script>

<div class="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
  <div class="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
    <div class="flex items-center gap-2">
      <Activity class="w-4 h-4 text-emerald-400" />
      <h3 class="text-sm font-bold text-zinc-100">Live Activity Feed (Geofence Transitions)</h3>
    </div>
    <span class="text-xs text-zinc-400">
      {presenceStore.recentTransitions.length} Event Terakhir
    </span>
  </div>

  <div class="max-h-64 overflow-y-auto space-y-2 pr-1">
    {#if presenceStore.recentTransitions.length === 0}
      <div class="p-6 text-center text-xs text-zinc-500">
        Menunggu event transisi geofence pertama dari telemetry GPS...
      </div>
    {:else}
      {#each presenceStore.recentTransitions as item (item.id)}
        {@const Icon = getEventIcon(item.event_type)}
        <div class="p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2.5">
            <Icon class="w-4 h-4 {item.event_type === 'ENTER' ? 'text-emerald-400' : item.event_type === 'EXIT' ? 'text-rose-400' : 'text-amber-400'}" />
            <div>
              <div class="font-bold text-zinc-200">{item.rider_name}</div>
              <div class="text-[11px] text-zinc-400 mt-0.5">
                {#if item.event_type === 'ENTER'}
                  Masuk ke <b>{item.actual_zone_name || 'Zona Operasi'}</b>
                {:else if item.event_type === 'EXIT'}
                  Keluar dari <b>{item.actual_zone_name || 'Zona Operasi'}</b>
                {:else}
                  Posisi di <b>{item.actual_zone_name || 'Luar Wilayah'}</b>
                {/if}
              </div>
            </div>
          </div>

          <div class="flex flex-col items-end gap-1">
            <span class="px-2 py-0.5 text-[10px] font-bold rounded border {getEventBadgeClass(item.event_type)}">
              {item.event_type}
            </span>
            <span class="text-[10px] text-zinc-500">
              {new Date(item.captured_at).toLocaleTimeString()}
            </span>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
