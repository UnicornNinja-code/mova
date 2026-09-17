<script lang="ts">
  import { onMount } from 'svelte';
  import BwmCalibrationTab from '../../components/dss/BwmCalibrationTab.svelte';
  import C3TimeCrowdTab from '../../components/dss/C3TimeCrowdTab.svelte';
  import C6CompetitorTab from '../../components/dss/C6CompetitorTab.svelte';
  import TopsisSimulationTab from '../../components/dss/TopsisSimulationTab.svelte';
  import { 
    Compass, 
    Clock, 
    Users, 
    Play, 
    Layers, 
    ArrowLeft, 
    Sparkles, 
    Calculator, 
    Sliders,
    Award
  } from 'lucide-svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let activeTab = $state<'bwm' | 'c3' | 'c6' | 'topsis'>('bwm');
</script>

<div class="space-y-6 pb-12 font-outfit-400">
  <!-- TOP TOOLBAR: Breadcrumbs & Page Title -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#24242A]">
    <div>
      <div class="text-[11px] font-outfit-600 text-[#71717A] uppercase tracking-wider flex items-center gap-1.5">
        <span>Super Admin Workspace</span>
        <span>•</span>
        <span class="text-[#FF634A]">DSS Engine Command</span>
      </div>
      <h2 class="text-xl sm:text-2xl lg:text-3xl font-outfit-600 text-white tracking-tight leading-tight mt-0.5">
        Konfigurasi & Master DSS BWM-TOPSIS
      </h2>
    </div>

    <!-- Quick Navigation Pills -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        onclick={() => onNavigate('/zones')}
        class="pill-btn-dark text-xs font-outfit-600"
      >
        <span class="px-3.5 py-1.5 flex items-center gap-1.5">
          <i class="ri-road-map-line text-sm text-[#FF634A]"></i>
          <span>Kelola Zona Wilayah</span>
        </span>
      </button>

      <button
        onclick={() => onNavigate('/map')}
        class="pill-btn-white text-xs font-outfit-600"
      >
        <span class="px-3.5 py-1.5 flex items-center gap-1.5 text-[#09090B]">
          <i class="ri-map-pin-2-fill text-sm text-[#FF634A]"></i>
          <span>Live Map Spasial</span>
        </span>
      </button>
    </div>
  </div>

  <!-- MAIN 2 PRIMARY ACTIVITIES NAVIGATION BAR WITH SECONDARY CRITERIA PILLS -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#24242A]">
    <!-- Primary 2 Activities -->
    <div class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
      <!-- Activity 1: BWM Calibration Wizard -->
      <button
        type="button"
        onclick={() => (activeTab = 'bwm')}
        class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
        {activeTab === 'bwm'
          ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
          : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
      >
        <Compass class="w-4 h-4 {activeTab === 'bwm' ? 'text-[#FF634A]' : 'text-purple-400'}" />
        <span>1. Konfigurasi Bobot BWM</span>
      </button>

      <!-- Activity 2: TOPSIS Simulation & Rankings -->
      <button
        type="button"
        onclick={() => (activeTab = 'topsis')}
        class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
        {activeTab === 'topsis'
          ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
          : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
      >
        <Play class="w-4 h-4 {activeTab === 'topsis' ? 'text-[#FF634A]' : 'text-emerald-400'} fill-current" />
        <span>2. Simulasi & Ranking TOPSIS</span>
      </button>
    </div>

    <!-- Secondary Criteria Reference Pills -->
    <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
      <span class="text-[10px] uppercase font-outfit-600 text-zinc-500 hidden sm:inline">Data Kriteria:</span>
      <!-- Tab C3 -->
      <button
        type="button"
        onclick={() => (activeTab = 'c3')}
        class="px-3 py-2 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer flex items-center gap-1.5 border
        {activeTab === 'c3'
          ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
          : 'bg-[#18181C] text-zinc-400 hover:text-zinc-200 border-[#272730]'}"
      >
        <Clock class="w-3.5 h-3.5 text-amber-400" />
        <span>C3 Keramaian</span>
      </button>

      <!-- Tab C6 -->
      <button
        type="button"
        onclick={() => (activeTab = 'c6')}
        class="px-3 py-2 rounded-xl text-xs font-outfit-600 transition-all cursor-pointer flex items-center gap-1.5 border
        {activeTab === 'c6'
          ? 'bg-rose-950/60 text-rose-300 border-rose-800/80'
          : 'bg-[#18181C] text-zinc-400 hover:text-zinc-200 border-[#272730]'}"
      >
        <Users class="w-3.5 h-3.5 text-rose-400" />
        <span>C6 Kompetitor</span>
      </button>
    </div>
  </div>

  <!-- TAB CONTENT DISPLAY -->
  <div>
    {#if activeTab === 'bwm'}
      <BwmCalibrationTab />
    {:else if activeTab === 'c3'}
      <C3TimeCrowdTab />
    {:else if activeTab === 'c6'}
      <C6CompetitorTab />
    {:else if activeTab === 'topsis'}
      <TopsisSimulationTab />
    {/if}
  </div>
</div>
