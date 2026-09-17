<script lang="ts">
  import { 
    AlertTriangle, 
    Wrench, 
    CloudRain, 
    ShieldAlert, 
    CheckCircle2, 
    ChevronRight, 
    X, 
    BellRing,
    Radio
  } from 'lucide-svelte';

  interface AlertItem {
    id: string;
    type: 'DANGER' | 'WARNING' | 'INFO';
    title: string;
    message: string;
    time?: string;
    actionLabel?: string;
    route?: string;
  }

  interface Props {
    onNavigate?: (route: string) => void;
    fleetAlertsCount?: number;
    weatherAlertsCount?: number;
    geofenceBreachCount?: number;
  }

  let { 
    onNavigate, 
    fleetAlertsCount = 0, 
    weatherAlertsCount = 0, 
    geofenceBreachCount = 0 
  }: Props = $props();

  let dismissed = $state(false);

  // Derive dynamic alert list based on real operational states
  let activeAlerts = $derived.by(() => {
    const list: AlertItem[] = [];

    if (geofenceBreachCount > 0) {
      list.push({
        id: 'geofence-breach',
        type: 'DANGER',
        title: 'Pelanggaran Geofence & Batas Jalan',
        message: `${geofenceBreachCount} rider terdeteksi mendekati / melintasi batas jalan protokol terlarang.`,
        actionLabel: 'Pantau di Map Ops',
        route: '/map',
      });
    }

    if (weatherAlertsCount > 0) {
      list.push({
        id: 'weather-risk',
        type: 'WARNING',
        title: 'Peringatan Risiko Cuaca Ekstrim',
        message: `${weatherAlertsCount} zona operasional berpotensi mengalami hujan lebat (>60%). Persiapkan perlindungan armada.`,
        actionLabel: 'Cek Radar Cuaca',
        route: '/map',
      });
    }

    if (fleetAlertsCount > 0) {
      list.push({
        id: 'fleet-maintenance',
        type: 'WARNING',
        title: 'Armada Membutuhkan Perawatan',
        message: `${fleetAlertsCount} unit armada tercatat membutuhkan pemeriksaan/perbaikan fisik di Hub.`,
        actionLabel: 'Kelola Armada',
        route: '/fleet',
      });
    }

    return list;
  });

  const handleAction = (route?: string) => {
    if (route && onNavigate) {
      onNavigate(route);
    }
  };
</script>

{#if !dismissed}
  {#if activeAlerts.length > 0}
    <div class="space-y-2 font-outfit-400">
      {#each activeAlerts as alert (alert.id)}
        <div 
          class="p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-300 shadow-lg
          {alert.type === 'DANGER' 
            ? 'bg-rose-950/20 border-rose-800/40 text-rose-200' 
            : 'bg-amber-950/20 border-amber-800/40 text-amber-200'}"
        >
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5
              {alert.type === 'DANGER' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}"
            >
              {#if alert.id === 'geofence-breach'}
                <ShieldAlert class="w-4 h-4 animate-pulse" />
              {:else if alert.id === 'weather-risk'}
                <CloudRain class="w-4 h-4" />
              {:else}
                <Wrench class="w-4 h-4" />
              {/if}
            </div>

            <div>
              <div class="flex items-center gap-2">
                <h5 class="text-xs sm:text-sm font-outfit-600 text-white leading-tight">
                  {alert.title}
                </h5>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold
                  {alert.type === 'DANGER' ? 'bg-rose-950 text-rose-400 border border-rose-800/50' : 'bg-amber-950 text-amber-400 border border-amber-800/50'}"
                >
                  {alert.type === 'DANGER' ? 'Prioritas Tinggi' : 'Peringatan'}
                </span>
              </div>
              <p class="text-xs text-[#A1A1AA] mt-1 leading-relaxed">
                {alert.message}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {#if alert.actionLabel}
              <button
                type="button"
                onclick={() => handleAction(alert.route)}
                class="px-3 py-1.5 rounded-xl text-xs font-outfit-600 flex items-center gap-1 transition-colors cursor-pointer
                {alert.type === 'DANGER' 
                  ? 'bg-rose-600/30 hover:bg-rose-600/50 text-rose-100 border border-rose-500/40' 
                  : 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-100 border border-amber-500/40'}"
              >
                <span>{alert.actionLabel}</span>
                <ChevronRight class="w-3.5 h-3.5" />
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Clean System Operational State Banner -->
    <div class="px-4 py-2.5 rounded-2xl bg-[#131316] border border-[#24242A] flex items-center justify-between gap-3 text-xs text-[#A1A1AA] font-outfit-400">
      <div class="flex items-center gap-2.5">
        <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
        <span>
          <strong class="text-emerald-400 font-semibold">Perimeter Lapangan Normal:</strong> 0 pelanggaran geofence, status armada prima, dan seluruh parameter cuaca terpantau kondusif.
        </span>
      </div>
      <span class="text-[10px] font-mono text-[#71717A] hidden md:inline">Quick Alert Monitor Active</span>
    </div>
  {/if}
{/if}
