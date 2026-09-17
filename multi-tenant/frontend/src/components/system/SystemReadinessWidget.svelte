<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    ShieldCheck, 
    AlertTriangle, 
    ArrowRight, 
    Building2, 
    MapPin, 
    Sparkles, 
    Users, 
    Bike, 
    Settings, 
    RefreshCw,
    CheckCircle2
  } from 'lucide-svelte';
  import { systemReadinessService, type SystemReadinessReport, type ReadinessItem } from '../../services/systemReadinessService';
  import SystemSettingsModal from './SystemSettingsModal.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let loading = $state(true);
  let report = $state<SystemReadinessReport | null>(null);
  let errorMsg = $state<string | null>(null);

  let settingsModalOpen = $state(false);

  export const loadReadiness = async () => {
    loading = true;
    errorMsg = null;
    try {
      report = await systemReadinessService.getReadiness();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat status kesiapan sistem.';
    } finally {
      loading = false;
    }
  };

  const handleActionClick = (item: ReadinessItem) => {
    if (item.id === 'CENTRAL_HUB' || item.id === 'OPERATIONAL_COVERAGE') {
      settingsModalOpen = true;
    } else {
      onNavigate(item.route);
    }
  };

  onMount(() => {
    loadReadiness();
  });
</script>

<div class="p-5 sm:p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5 font-outfit-400">
  <!-- Widget Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#24242A]">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-bold
      {report?.overall_status === 'READY' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : 'bg-amber-950/40 text-amber-400 border border-amber-800/40'}">
        {#if report?.overall_status === 'READY'}
          <ShieldCheck class="w-5 h-5" />
        {:else}
          <AlertTriangle class="w-5 h-5" />
        {/if}
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-base font-outfit-600 text-white">Status Kesiapan Fondasi Operasional</h3>
          {#if report}
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold
            {report.overall_status === 'READY' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-amber-950 text-amber-400 border border-amber-800/40'}">
              {report.overall_status === 'READY' ? 'SISTEM SIAP OPERASI' : 'PERLU KONFIGURASI'}
            </span>
          {/if}
        </div>
        <p class="text-xs text-[#A1A1AA]">
          Prasyarat fondasi Central Hub, Wilayah, Zona Spasial, DSS Bobot & User Provisioning
        </p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <button
        onclick={() => (settingsModalOpen = true)}
        class="px-3 py-1.5 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-xs text-white font-outfit-600 flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2E2E38]"
      >
        <Settings class="w-3.5 h-3.5 text-[#FF634A]" />
        <span>Atur Hub & Radius</span>
      </button>

      <button
        onclick={loadReadiness}
        class="p-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-zinc-400 hover:text-white transition-colors cursor-pointer"
        title="Refresh Status"
      >
        <RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
      </button>
    </div>
  </div>

  <!-- Progress Bar Gauge -->
  {#if report}
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-xs">
        <span class="text-zinc-400">Tingkat Kesiapan Sistem:</span>
        <span class="font-mono font-bold text-white">{report.readiness_percentage}%</span>
      </div>
      <div class="w-full h-2.5 rounded-full bg-[#1F1F26] overflow-hidden">
        <div 
          class="h-full rounded-full transition-all duration-500 {report.readiness_percentage === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#FF634A] to-amber-400'}"
          style="width: {report.readiness_percentage}%"
        ></div>
      </div>
    </div>
  {/if}

  <!-- Checklist Grid -->
  {#if loading}
    <div class="py-8 text-center text-xs text-zinc-500">
      <div class="inline-block w-6 h-6 border-2 border-[#FF634A] border-t-transparent rounded-full animate-spin mb-2"></div>
      <div>Mengevaluasi kesiapan fondasi sistem...</div>
    </div>
  {:else if report}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      {#each report.items as item}
        {@const isReady = item.status === 'READY'}
        <div class="p-3.5 rounded-2xl bg-[#17171C] border border-[#24242A] flex items-center justify-between gap-3 text-xs">
          <div class="space-y-1 min-w-0 pr-2">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full {isReady ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
              <strong class="text-white truncate font-outfit-600">{item.title}</strong>
              {#if item.is_mandatory}
                <span class="text-[9px] px-1.5 py-0.2 rounded bg-red-950/40 text-red-400 border border-red-800/30">
                  Wajib
                </span>
              {/if}
            </div>
            <p class="text-[11px] text-[#A1A1AA] leading-relaxed line-clamp-2">
              {item.description}
            </p>
          </div>

          <button
            type="button"
            onclick={() => handleActionClick(item)}
            class="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-outfit-600 flex items-center gap-1 transition-all cursor-pointer
            {isReady ? 'bg-[#202027] hover:bg-[#2C2C36] text-zinc-300' : 'bg-[#FF634A]/20 hover:bg-[#FF634A]/30 text-[#FF634A] border border-[#FF634A]/40'}"
          >
            <span>{item.action_label}</span>
            <ArrowRight class="w-3 h-3" />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<SystemSettingsModal
  open={settingsModalOpen}
  onClose={() => (settingsModalOpen = false)}
  currentReport={report}
  onSuccess={loadReadiness}
/>
