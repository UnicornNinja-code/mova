<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { presenceStore } from '../../lib/stores/presenceStore.svelte';
  import PresenceKpiStrip from '../../components/presence/PresenceKpiStrip.svelte';
  import PresenceFilterBar from '../../components/presence/PresenceFilterBar.svelte';
  import OperationalMap from '../../components/presence/OperationalMap.svelte';
  import DeviationAlertPanel from '../../components/presence/DeviationAlertPanel.svelte';
  import TransitionFeed from '../../components/presence/TransitionFeed.svelte';
  import RiderPresenceGrid from '../../components/presence/RiderPresenceGrid.svelte';
  import RiderDetailDrawer from '../../components/presence/drawers/RiderDetailDrawer.svelte';
  import ZoneComplianceDrawer from '../../components/presence/drawers/ZoneComplianceDrawer.svelte';
  import OperationalIntelligenceModal from '../../components/presence/OperationalIntelligenceModal.svelte';
  import ErrorBoundary from '../../components/ui/ErrorBoundary.svelte';
  import { Radio, RefreshCw, BarChart3, Activity } from 'lucide-svelte';

  interface Props {
    onNavigate?: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let selectedRiderId = $state<string | null>(null);
  let selectedZoneId = $state<string | null>(null);
  let showIntelligenceModal = $state(false);

  onMount(() => {
    presenceStore.init();
  });

  onDestroy(() => {
    presenceStore.destroy();
  });

  const handleSelectRider = (riderId: string) => {
    selectedRiderId = riderId;
  };

  const handleRefresh = async () => {
    await presenceStore.resyncAuthoritativeSnapshot();
  };
</script>

<div class="p-6 max-w-[1600px] mx-auto space-y-6">
  <!-- Top Navigation & Header -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
        <h1 class="text-xl font-extrabold text-zinc-100 tracking-tight">
          Pusat Pengawasan Kehadiran & Geofence (Live LBS Ops)
        </h1>
      </div>
      <p class="text-xs text-zinc-400 mt-1">
        Pemantauan spasial PostGIS real-time, deteksi pelanggaran batas zona, dan triage alert kepatuhan operasional.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onclick={() => (showIntelligenceModal = true)}
        class="px-3.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <Activity class="w-3.5 h-3.5 text-amber-400" />
        Intelejen Operasional (S7-02)
      </button>

      <button
        type="button"
        onclick={handleRefresh}
        class="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <RefreshCw class="w-3.5 h-3.5 {presenceStore.isLoading ? 'animate-spin' : ''}" />
        Sinkronkan Ulang
      </button>

      <div class="text-[11px] text-zinc-500">
        Sinkron: {new Date(presenceStore.lastSyncTimestamp).toLocaleTimeString()}
      </div>
    </div>
  </div>


  <!-- 1. Operational KPI Strip -->
  <ErrorBoundary componentName="KPI Strip">
    <PresenceKpiStrip />
  </ErrorBoundary>

  <!-- 2. Global Filter Bar -->
  <ErrorBoundary componentName="Filter Bar">
    <PresenceFilterBar />
  </ErrorBoundary>

  <!-- 3. Split Command Center: Map (Left) + Deviation Alert Panel (Right) -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2">
      <ErrorBoundary componentName="Peta Spasial Operasional">
        <OperationalMap />
      </ErrorBoundary>
    </div>
    <div class="lg:col-span-1">
      <ErrorBoundary componentName="Panel Alert Deviasi">
        <DeviationAlertPanel />
      </ErrorBoundary>
    </div>
  </div>

  <!-- 4. Real-time Transition Feed -->
  <ErrorBoundary componentName="Feed Transisi Kehadiran">
    <TransitionFeed />
  </ErrorBoundary>

  <!-- 5. Active Rider Data Grid -->
  <ErrorBoundary componentName="Tabel Kehadiran Rider">
    <RiderPresenceGrid onSelectRider={handleSelectRider} />
  </ErrorBoundary>

  <!-- Drawers for Detailed Investigation -->
  {#if selectedRiderId}
    <ErrorBoundary componentName="Drawer Detail Rider">
      <RiderDetailDrawer riderId={selectedRiderId} onClose={() => (selectedRiderId = null)} />
    </ErrorBoundary>
  {/if}

  {#if presenceStore.selectedZoneId}
    <ErrorBoundary componentName="Drawer Kepatuhan Zona">
      <ZoneComplianceDrawer zoneId={presenceStore.selectedZoneId} onClose={() => (presenceStore.selectedZoneId = null)} />
    </ErrorBoundary>
  {/if}

  <!-- Operational Intelligence S7-02 Modal -->
  {#if showIntelligenceModal}
    <ErrorBoundary componentName="Modal Intelejen Operasional">
      <OperationalIntelligenceModal onClose={() => (showIntelligenceModal = false)} />
    </ErrorBoundary>
  {/if}
</div>


