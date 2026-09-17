<script lang="ts">
  import { 
    CheckCircle2, 
    Building2, 
    Clock, 
    Radio, 
    Bike, 
    Map, 
    BrainCircuit, 
    Database, 
    ArrowLeft, 
    Sparkles, 
    ShieldCheck,
    Layers
  } from 'lucide-svelte';
  import { setupStore } from '../../../lib/stores/setupStore.svelte';

  interface Props {
    onApply: () => void;
    onPrev: () => void;
  }

  let { onApply, onPrev }: Props = $props();

  const CRITERIA_MAP: Record<string, string> = {
    '1': 'C1 (Densitas POI)',
    '2': 'C2 (Diversitas POI)',
    '3': 'C3 (Keramaian Waktu)',
    '4': 'C4 (Kondisi Cuaca)',
    '5': 'C5 (Jarak ke Hub)',
    '6': 'C6 (Kompetitor)',
  };
</script>

<div class="space-y-6">
  <!-- Step Header -->
  <div class="border-b border-[#24242A] pb-4">
    <div class="flex items-center gap-2 text-xs font-outfit-600 text-[#FF634A] tracking-wider uppercase">
      <span>Fase 07</span>
      <span>•</span>
      <span>Verifikasi & Konfirmasi Akhir</span>
    </div>
    <h2 class="text-xl sm:text-2xl font-outfit-700 text-white mt-1">
      Tinjau konfigurasi fondasi operasional MOVA
    </h2>
    <p class="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
      Pastikan parameter sistem telah sesuai dengan strategi bisnis Anda sebelum diterapkan ke basis data.
    </p>
  </div>

  <!-- Summary Sections Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- 1. Identitas Operasional -->
    <div class="bg-[#18181D] border border-[#272730] rounded-2xl p-4 space-y-3">
      <div class="flex items-center gap-2 border-b border-[#24242A] pb-2.5">
        <Building2 class="w-4 h-4 text-[#FF634A]" />
        <h3 class="text-xs font-outfit-700 text-white uppercase tracking-wider">
          Identitas Operasional
        </h3>
      </div>
      <div class="space-y-2 text-xs">
        <div class="flex justify-between">
          <span class="text-zinc-400">Nama Bisnis:</span>
          <span class="font-outfit-600 text-white text-right">{setupStore.identity.businessName || 'MOVA Operational'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Central Hub:</span>
          <span class="font-outfit-600 text-white text-right">{setupStore.identity.centralHubName || 'Central Hub'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Kota Operasional:</span>
          <span class="font-outfit-700 text-[#FF634A] text-right">{setupStore.identity.hubCityName || '-'}</span>
        </div>
        <div class="flex justify-between items-start gap-4">
          <span class="text-zinc-400 shrink-0">Alamat:</span>
          <span class="text-zinc-300 text-right line-clamp-2">{setupStore.identity.centralHubAddress || '-'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Koordinat WGS84:</span>
          <span class="font-mono text-zinc-300">
            {setupStore.identity.centralHubLat.toFixed(4)}, {setupStore.identity.centralHubLng.toFixed(4)}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Zona Waktu:</span>
          <span class="font-outfit-600 text-zinc-300">{setupStore.identity.timezone}</span>
        </div>
      </div>
    </div>

    <!-- 2. Kebijakan Operasional -->
    <div class="bg-[#18181D] border border-[#272730] rounded-2xl p-4 space-y-3">
      <div class="flex items-center gap-2 border-b border-[#24242A] pb-2.5">
        <Clock class="w-4 h-4 text-[#FF634A]" />
        <h3 class="text-xs font-outfit-700 text-white uppercase tracking-wider">
          Kebijakan Operasional
        </h3>
      </div>
      <div class="space-y-2 text-xs">
        <div class="flex justify-between">
          <span class="text-zinc-400">Jam Operasi:</span>
          <span class="font-outfit-700 font-mono text-white">
            {setupStore.operationalPolicy.operatingHoursStart} – {setupStore.operationalPolicy.operatingHoursEnd}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Radius Maksimum:</span>
          <span class="font-outfit-700 font-mono text-[#FF634A]">
            {setupStore.operationalPolicy.operationalRadiusKm} KM
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Cakupan Geografis:</span>
          <span class="text-zinc-300 text-right">Melingkar di sekitar Central Hub</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Manajemen Zona:</span>
          <span class="text-zinc-400 italic">Dikonfigurasi pasca onboarding</span>
        </div>
      </div>
    </div>

    <!-- 3. Armada Awal -->
    <div class="bg-[#18181D] border border-[#272730] rounded-2xl p-4 space-y-3">
      <div class="flex items-center justify-between border-b border-[#24242A] pb-2.5">
        <div class="flex items-center gap-2">
          <Bike class="w-4 h-4 text-[#FF634A]" />
          <h3 class="text-xs font-outfit-700 text-white uppercase tracking-wider">
            Armada Awal Terdaftar
          </h3>
        </div>
        <span class="text-[11px] font-mono text-zinc-400">
          {setupStore.fleets.length} Unit
        </span>
      </div>
      <div class="space-y-1.5 text-xs max-h-32 overflow-y-auto divide-y divide-[#272730]/50">
        {#each setupStore.fleets as f}
          <div class="flex items-center justify-between py-1.5 first:pt-0 last:pb-0">
            <div class="flex items-center gap-2">
              <span class="font-mono text-white font-outfit-700">{f.code}</span>
              <span class="text-zinc-400 text-[11px]">({f.type})</span>
            </div>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {f.status}
            </span>
          </div>
        {/each}
      </div>
    </div>

    <!-- 4. Preferensi Peta -->
    <div class="bg-[#18181D] border border-[#272730] rounded-2xl p-4 space-y-3">
      <div class="flex items-center gap-2 border-b border-[#24242A] pb-2.5">
        <Map class="w-4 h-4 text-[#FF634A]" />
        <h3 class="text-xs font-outfit-700 text-white uppercase tracking-wider">
          Preferensi Peta
        </h3>
      </div>
      <div class="space-y-2 text-xs">
        <div class="flex justify-between">
          <span class="text-zinc-400">Tema Basemap:</span>
          <span class="font-outfit-600 text-white capitalize">{setupStore.mapPreferences.basemapId.replace('openmaptiles-', '')}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Level Zoom Awal:</span>
          <span class="font-mono text-zinc-300">{setupStore.mapPreferences.defaultZoom}x</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Layer Radius Hub:</span>
          <span class="text-zinc-300">{setupStore.mapPreferences.showHubRadius ? 'Aktif (ON)' : 'Nonaktif (OFF)'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Layer Jalan Protokol:</span>
          <span class="text-zinc-300">{setupStore.mapPreferences.showProtocolRoads ? 'Aktif (ON)' : 'Nonaktif (OFF)'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-400">Layer Marker POI:</span>
          <span class="text-zinc-300">{setupStore.mapPreferences.showPoi ? 'Aktif (ON)' : 'Nonaktif (OFF)'}</span>
        </div>
      </div>
    </div>

    <!-- 5. Model DSS & 6. Sinkronisasi Data (Full Width) -->
    <div class="bg-[#18181D] border border-[#272730] rounded-2xl p-4 space-y-3 md:col-span-2">
      <div class="flex items-center justify-between border-b border-[#24242A] pb-2.5">
        <div class="flex items-center gap-2">
          <BrainCircuit class="w-4 h-4 text-[#FF634A]" />
          <h3 class="text-xs font-outfit-700 text-white uppercase tracking-wider">
            Model DSS & Integritas Lingkungan Data
          </h3>
        </div>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          TERKALIBRASI
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div>
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider block">Best Criterion</span>
          <p class="font-outfit-700 text-emerald-400 mt-0.5">
            {CRITERIA_MAP[setupStore.dss.bestCriteriaId] || 'C1 (Densitas POI)'}
          </p>
        </div>

        <div>
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider block">Worst Criterion</span>
          <p class="font-outfit-700 text-rose-400 mt-0.5">
            {CRITERIA_MAP[setupStore.dss.worstCriteriaId] || 'C5 (Jarak ke Hub)'}
          </p>
        </div>

        <div>
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider block">Consistency Ratio (CR)</span>
          <p class="font-mono text-zinc-200 mt-0.5">
            {setupStore.dss.cr ? setupStore.dss.cr.toFixed(4) : '0.0000'} (Konsisten)
          </p>
        </div>

        <div>
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider block">Status Data Spasial</span>
          <div class="mt-0.5 space-y-0.5 text-[11px] text-zinc-300">
            <p class="text-emerald-400 flex items-center gap-1 font-outfit-600">
              <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
              <span>Semua Dataset Terindeks</span>
            </p>
            <p class="text-zinc-400 font-mono text-[10px]">
              Tol: {setupStore.datasets.toll_roads.count || '-'} | Arteri: {setupStore.datasets.protocol_roads.count || '-'} | POI: {setupStore.datasets.poi.count || '-'}
            </p>
          </div>
        </div>
      </div>

      {#if setupStore.dss.weights && Object.keys(setupStore.dss.weights).length > 0}
        <div class="pt-2.5 border-t border-[#24242A]">
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">Sebaran Bobot Optimal BWM</span>
          <div class="flex flex-wrap gap-2">
            {#each ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as code}
              {@const w = setupStore.dss.weights[code] ?? 0}
              <div class="px-2.5 py-1 rounded-lg bg-[#121214] border border-[#24242A] flex items-center gap-1.5">
                <span class="font-mono text-[10px] text-zinc-400">{code}:</span>
                <span class="font-mono text-[11px] font-outfit-700 text-[#FF634A]">{(w * 100).toFixed(1)}%</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- ENVIRONMENT READY BANNER -->
  <div class="bg-gradient-to-r from-[#18181D] via-[#1E1E24] to-[#18181D] border border-emerald-500/30 rounded-2xl p-5 space-y-2 shadow-xl">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
        <ShieldCheck class="w-5 h-5" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-sm sm:text-base font-outfit-700 text-white">
            Lingkungan Operasional Siap (Environment Ready)
          </h3>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            SIAP AKTIF
          </span>
        </div>
        <p class="text-xs text-zinc-400 mt-0.5 leading-relaxed">
          Konfigurasi dasar MOVA berhasil disiapkan. Sistem siap digunakan untuk memulai aktivitas operasional dan analisis rekomendasi zona penjualan.
        </p>
      </div>
    </div>
  </div>

  <!-- Wizard Navigation Actions -->
  <div class="pt-4 flex items-center justify-between gap-3">
    <button
      type="button"
      onclick={onPrev}
      class="px-5 py-2.5 rounded-xl text-xs font-outfit-600 text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer"
    >
      <ArrowLeft class="w-4 h-4" />
      <span>Kembali</span>
    </button>
    <button
      type="button"
      onclick={onApply}
      class="px-8 py-3.5 bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] text-white rounded-xl text-xs sm:text-sm font-outfit-700 shadow-xl shadow-[#FF634A]/25 transition-all flex items-center gap-2 cursor-pointer"
    >
      <Sparkles class="w-4 h-4" />
      <span>Selesai & Mulai Gunakan MOVA</span>
    </button>
  </div>
</div>
