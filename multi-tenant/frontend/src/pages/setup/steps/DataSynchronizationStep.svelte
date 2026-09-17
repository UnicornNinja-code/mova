<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Database, 
    CheckCircle2, 
    Loader2, 
    XCircle, 
    Clock, 
    RefreshCw, 
    ArrowRight, 
    ArrowLeft,
    ShieldCheck,
    AlertCircle,
    Route,
    MapPin,
    Building2,
    StopCircle
  } from 'lucide-svelte';
  import { setupStore } from '../../../lib/stores/setupStore.svelte';

  interface Props {
    onNext: () => void;
    onPrev: () => void;
  }

  let { onNext, onPrev }: Props = $props();

  let showAbortModal = $state(false);
  let autoTriggered = false;

  onMount(async () => {
    setupStore.initSocketListeners();
    await setupStore.fetchSpatialSyncStatus();
    
    // Auto-trigger sync seamlessly upon entering Phase 6 if not already completed/syncing
    if (
      !setupStore.isAllDatasetsReady && 
      !autoTriggered && 
      (setupStore.syncState === 'IDLE' || setupStore.syncState === 'DRAFT')
    ) {
      autoTriggered = true;
      await setupStore.startSpatialSync();
    }
  });

  const handleRetryDataset = async (type: 'TOLL_ROADS' | 'PROTOCOL_ROADS' | 'POI') => {
    await setupStore.retryDataset(type);
  };

  const handleRetryFailedOnly = async () => {
    await setupStore.retryFailedOnly();
  };

  const handleAbort = async () => {
    await setupStore.abortSpatialSync();
    showAbortModal = false;
  };
</script>

<div class="space-y-6">
  <!-- Step Header -->
  <div class="border-b border-[#24242A] pb-4">
    <div class="flex items-center gap-2 text-xs font-outfit-600 text-[#FF634A] tracking-wider uppercase">
      <span>Fase 06</span>
      <span>•</span>
      <span>Sinkronisasi Data Spasial</span>
    </div>
    <h2 class="text-xl sm:text-2xl font-outfit-700 text-white mt-1">
      Penarikan & Validasi Jaringan Spasial Terdistribusi
    </h2>
    <p class="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
      Sistem memproses dataset Jalan Tol, Jalan Protokol, dan POI secara asinkron via BullMQ Pipeline & Overpass API untuk membangun basis geospasial DSS.
    </p>
  </div>

  <!-- Overall Progress & Dynamic Status Header -->
  <div class="p-4 sm:p-5 rounded-2xl border bg-[#18181D] border-[#272730] space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center {setupStore.isAllDatasetsReady ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : setupStore.isSyncingLocked ? 'bg-[#FF634A]/20 text-[#FF634A] border border-[#FF634A]/30' : setupStore.hasFailedDatasets ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-zinc-800 text-zinc-400'}">
          {#if setupStore.isAllDatasetsReady}
            <CheckCircle2 class="w-5 h-5" />
          {:else if setupStore.isSyncingLocked}
            <Loader2 class="w-5 h-5 animate-spin" />
          {:else if setupStore.hasFailedDatasets}
            <AlertCircle class="w-5 h-5" />
          {:else}
            <Database class="w-5 h-5" />
          {/if}
        </div>
        <div>
          <h3 class="text-sm font-outfit-700 text-white">
            {#if setupStore.isAllDatasetsReady}
              Semua Dataset Spasial Berhasil Dipromosikan (Versi Aktif)
            {:else if setupStore.isSyncingLocked}
              Menyiapkan dan mengindeks data spasial...
            {:else if setupStore.hasFailedDatasets}
              Terdapat kendala pada proses sinkronisasi dataset
            {:else if setupStore.syncState === 'ABORTED'}
              Sinkronisasi Dibatalkan oleh Pengguna
            {:else}
              Inisialisasi Sinkronisasi Spasial...
            {/if}
          </h3>
          <p class="text-xs text-zinc-400 mt-0.5">
            Progress Keseluruhan: <span class="text-white font-mono font-outfit-600">{setupStore.overallSyncProgress}%</span>
          </p>
        </div>
      </div>

      <!-- Contextual Action Controls -->
      <div class="flex items-center gap-2">
        {#if setupStore.isSyncingLocked}
          <button
            type="button"
            onclick={() => (showAbortModal = true)}
            class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-outfit-600 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <StopCircle class="w-3.5 h-3.5 text-rose-400" />
            <span>Batalkan</span>
          </button>
        {:else if setupStore.hasFailedDatasets}
          <button
            type="button"
            onclick={handleRetryFailedOnly}
            class="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-outfit-600 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw class="w-3.5 h-3.5" />
            <span>Ulangi Bagian yang Gagal</span>
          </button>
        {/if}
      </div>
    </div>

    <!-- Overall Progress Bar -->
    <div class="w-full bg-[#121214] rounded-full h-2.5 overflow-hidden border border-[#24242A]">
      <div
        class="h-full rounded-full transition-all duration-500 {setupStore.isAllDatasetsReady ? 'bg-emerald-500' : setupStore.hasFailedDatasets ? 'bg-rose-500' : 'bg-gradient-to-r from-[#FF634A] to-amber-400'}"
        style="width: {setupStore.overallSyncProgress}%"
      ></div>
    </div>
  </div>

  {#if setupStore.syncError}
    <div class="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-300">
      <div class="flex items-center gap-2.5">
        <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
        <span>{setupStore.syncError}</span>
      </div>
    </div>
  {/if}

  <!-- 3 Granular Dataset Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <!-- 1. TOLL ROADS -->
    <div class="bg-[#18181D] border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all {setupStore.datasets.toll_roads.status === 'COMPLETED' ? 'border-emerald-500/30 bg-emerald-950/10' : setupStore.datasets.toll_roads.status === 'FAILED' ? 'border-rose-500/30 bg-rose-950/10' : setupStore.datasets.toll_roads.status === 'PROCESSING' ? 'border-[#FF634A]/40 bg-[#FF634A]/5' : 'border-[#272730]'}">
      <div>
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-[#24242A]">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20">
              <Route class="w-3.5 h-3.5" />
            </div>
            <h4 class="text-xs font-outfit-700 text-white uppercase tracking-wide">Jalan Tol</h4>
          </div>
          <!-- Badge -->
          {#if setupStore.datasets.toll_roads.status === 'COMPLETED'}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              AKTIF (v{setupStore.datasets.toll_roads.version || 1})
            </span>
          {:else if setupStore.datasets.toll_roads.status === 'PROCESSING'}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse">
              PROSES {setupStore.datasets.toll_roads.progress}%
            </span>
          {:else if setupStore.datasets.toll_roads.status === 'FAILED'}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
              GAGAL
            </span>
          {:else}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
              MENUNGGU
            </span>
          {/if}
        </div>

        <p class="text-xs text-zinc-400 mt-3 leading-relaxed">
          Dataset jaringan jalan bebas hambatan untuk filtering zona terlarang armada roda dua.
        </p>

        <!-- Count info -->
        <div class="mt-3 text-xs flex items-center justify-between text-zinc-400">
          <span>Jumlah Segmen:</span>
          <span class="text-white font-mono font-outfit-600">
            {#if setupStore.datasets.toll_roads.status === 'COMPLETED'}
              {setupStore.datasets.toll_roads.count > 0 ? setupStore.datasets.toll_roads.count.toLocaleString('id-ID') + ' Segmen' : '0 Segmen (Tidak ada di wilayah hub)'}
            {:else if setupStore.datasets.toll_roads.count > 0}
              {setupStore.datasets.toll_roads.count.toLocaleString('id-ID')}
            {:else}
              -
            {/if}
          </span>
        </div>

        <!-- Progress bar -->
        <div class="mt-2 w-full bg-[#121214] rounded-full h-1.5 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300 {setupStore.datasets.toll_roads.status === 'COMPLETED' ? 'bg-emerald-500' : setupStore.datasets.toll_roads.status === 'FAILED' ? 'bg-rose-500' : 'bg-orange-400'}"
            style="width: {setupStore.datasets.toll_roads.progress}%"
          ></div>
        </div>

        {#if setupStore.datasets.toll_roads.error}
          <p class="mt-2 text-[11px] text-rose-400 font-mono leading-tight">{setupStore.datasets.toll_roads.error}</p>
        {/if}
      </div>

      {#if setupStore.datasets.toll_roads.status === 'FAILED'}
        <button
          type="button"
          onclick={() => handleRetryDataset('TOLL_ROADS')}
          class="mt-4 w-full py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-outfit-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5" />
          <span>Retry Jalan Tol</span>
        </button>
      {/if}
    </div>

    <!-- 2. PROTOCOL ROADS -->
    <div class="bg-[#18181D] border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all {setupStore.datasets.protocol_roads.status === 'COMPLETED' ? 'border-emerald-500/30 bg-emerald-950/10' : setupStore.datasets.protocol_roads.status === 'FAILED' ? 'border-rose-500/30 bg-rose-950/10' : setupStore.datasets.protocol_roads.status === 'PROCESSING' ? 'border-[#FF634A]/40 bg-[#FF634A]/5' : 'border-[#272730]'}">
      <div>
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-[#24242A]">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Building2 class="w-3.5 h-3.5" />
            </div>
            <h4 class="text-xs font-outfit-700 text-white uppercase tracking-wide">Jalan Protokol</h4>
          </div>
          <!-- Badge -->
          {#if setupStore.datasets.protocol_roads.status === 'COMPLETED'}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              AKTIF (v{setupStore.datasets.protocol_roads.version || 1})
            </span>
          {:else if setupStore.datasets.protocol_roads.status === 'PROCESSING'}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">
              PROSES {setupStore.datasets.protocol_roads.progress}%
            </span>
          {:else if setupStore.datasets.protocol_roads.status === 'FAILED'}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
              GAGAL
            </span>
          {:else}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
              MENUNGGU
            </span>
          {/if}
        </div>

        <p class="text-xs text-zinc-400 mt-3 leading-relaxed">
          Koridor jalan arteri dan primer perkotaan untuk penetapan batasan operasional dan rute.
        </p>

        <!-- Count info -->
        <div class="mt-3 text-xs flex items-center justify-between text-zinc-400">
          <span>Jumlah Segmen:</span>
          <span class="text-white font-mono font-outfit-600">
            {#if setupStore.datasets.protocol_roads.status === 'COMPLETED'}
              {setupStore.datasets.protocol_roads.count.toLocaleString('id-ID')} Segmen
            {:else if setupStore.datasets.protocol_roads.count > 0}
              {setupStore.datasets.protocol_roads.count.toLocaleString('id-ID')}
            {:else}
              -
            {/if}
          </span>
        </div>

        <!-- Progress bar -->
        <div class="mt-2 w-full bg-[#121214] rounded-full h-1.5 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300 {setupStore.datasets.protocol_roads.status === 'COMPLETED' ? 'bg-emerald-500' : setupStore.datasets.protocol_roads.status === 'FAILED' ? 'bg-rose-500' : 'bg-blue-400'}"
            style="width: {setupStore.datasets.protocol_roads.progress}%"
          ></div>
        </div>

        {#if setupStore.datasets.protocol_roads.error}
          <p class="mt-2 text-[11px] text-rose-400 font-mono leading-tight">{setupStore.datasets.protocol_roads.error}</p>
        {/if}
      </div>

      {#if setupStore.datasets.protocol_roads.status === 'FAILED'}
        <button
          type="button"
          onclick={() => handleRetryDataset('PROTOCOL_ROADS')}
          class="mt-4 w-full py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-outfit-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5" />
          <span>Retry Jalan Protokol</span>
        </button>
      {/if}
    </div>

    <!-- 3. POI & LANDMARKS -->
    <div class="bg-[#18181D] border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all {setupStore.datasets.poi.status === 'COMPLETED' ? 'border-emerald-500/30 bg-emerald-950/10' : setupStore.datasets.poi.status === 'FAILED' ? 'border-rose-500/30 bg-rose-950/10' : setupStore.datasets.poi.status === 'PROCESSING' ? 'border-[#FF634A]/40 bg-[#FF634A]/5' : 'border-[#272730]'}">
      <div>
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-[#24242A]">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <MapPin class="w-3.5 h-3.5" />
            </div>
            <h4 class="text-xs font-outfit-700 text-white uppercase tracking-wide">POI & Landmark</h4>
          </div>
          <!-- Badge -->
          {#if setupStore.datasets.poi.status === 'COMPLETED'}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              AKTIF (v{setupStore.datasets.poi.version || 1})
            </span>
          {:else if setupStore.datasets.poi.status === 'PROCESSING'}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
              PROSES {setupStore.datasets.poi.progress}%
            </span>
          {:else if setupStore.datasets.poi.status === 'FAILED'}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
              GAGAL
            </span>
          {:else}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
              MENUNGGU
            </span>
          {/if}
        </div>

        <p class="text-xs text-zinc-400 mt-3 leading-relaxed">
          Titik-titik potensi permintaan (kampus, kantor, pusat perbelanjaan, transit publik) untuk DSS.
        </p>

        <!-- Count info -->
        <div class="mt-3 text-xs flex items-center justify-between text-zinc-400">
          <span>Jumlah POI:</span>
          <span class="text-white font-mono font-outfit-600">
            {#if setupStore.datasets.poi.status === 'COMPLETED'}
              {setupStore.datasets.poi.count.toLocaleString('id-ID')} Titik POI
            {:else if setupStore.datasets.poi.count > 0}
              {setupStore.datasets.poi.count.toLocaleString('id-ID')}
            {:else}
              -
            {/if}
          </span>
        </div>

        <!-- Progress bar -->
        <div class="mt-2 w-full bg-[#121214] rounded-full h-1.5 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300 {setupStore.datasets.poi.status === 'COMPLETED' ? 'bg-emerald-500' : setupStore.datasets.poi.status === 'FAILED' ? 'bg-rose-500' : 'bg-emerald-400'}"
            style="width: {setupStore.datasets.poi.progress}%"
          ></div>
        </div>

        {#if setupStore.datasets.poi.error}
          <p class="mt-2 text-[11px] text-rose-400 font-mono leading-tight">{setupStore.datasets.poi.error}</p>
        {/if}
      </div>

      {#if setupStore.datasets.poi.status === 'FAILED'}
        <button
          type="button"
          onclick={() => handleRetryDataset('POI')}
          class="mt-4 w-full py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-outfit-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5" />
          <span>Retry POI</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Success Completion Banner -->
  {#if setupStore.isAllDatasetsReady}
    <div class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-300 animate-in fade-in duration-300">
      <ShieldCheck class="w-5 h-5 text-emerald-400 shrink-0" />
      <div>
        <p class="font-outfit-700 text-white">Seluruh Komponen Geospasial Siap Digunakan!</p>
        <p class="mt-0.5 text-emerald-400/90">
          Data jalan tol, jalan protokol, dan POI telah tervalidasi, terindeks dalam PostGIS, dan dipromosikan ke versi aktif sistem.
        </p>
      </div>
    </div>
  {/if}

  <!-- Wizard Navigation Actions -->
  <div class="pt-4 flex items-center justify-between gap-3">
    <button
      type="button"
      onclick={onPrev}
      disabled={setupStore.isSyncingLocked}
      class="px-5 py-2.5 rounded-xl text-xs font-outfit-600 text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
    >
      <ArrowLeft class="w-4 h-4" />
      <span>Kembali</span>
    </button>

    {#if setupStore.isAllDatasetsReady}
      <button
        type="button"
        onclick={onNext}
        class="px-6 py-3 bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] text-white rounded-xl text-xs sm:text-sm font-outfit-700 shadow-lg shadow-[#FF634A]/25 transition-all flex items-center gap-2 cursor-pointer animate-in fade-in duration-300"
      >
        <span>Lanjutkan ke Ringkasan Verifikasi</span>
        <ArrowRight class="w-4 h-4" />
      </button>
    {/if}
  </div>
</div>

<!-- Abort Confirmation Modal Dialog -->
{#if showAbortModal}
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-[#1C1C22] border border-[#272730] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
      <div class="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
        <AlertCircle class="w-6 h-6" />
      </div>
      <div>
        <h3 class="text-base font-outfit-700 text-white">Batalkan Sinkronisasi Spasial?</h3>
        <p class="text-xs text-zinc-400 mt-1 leading-relaxed">
          Proses penarikan data dari Overpass API dan BullMQ worker yang sedang aktif akan dihentikan secara langsung. Anda dapat memulai ulang proses kapan saja.
        </p>
      </div>
      <div class="flex items-center justify-end gap-2.5 pt-2">
        <button
          type="button"
          onclick={() => (showAbortModal = false)}
          class="px-4 py-2 rounded-xl text-xs font-outfit-600 text-zinc-300 hover:bg-white/5 transition-all cursor-pointer"
        >
          Lanjutkan Sinkronisasi
        </button>
        <button
          type="button"
          onclick={handleAbort}
          class="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-outfit-700 transition-all shadow-md shadow-rose-500/20 cursor-pointer"
        >
          Hentikan Sekarang
        </button>
      </div>
    </div>
  </div>
{/if}
