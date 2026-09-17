<script lang="ts">
  import { 
    Clock, 
    Radio, 
    AlertCircle, 
    ArrowRight, 
    ArrowLeft,
    ShieldAlert
  } from 'lucide-svelte';
  import { setupStore } from '../../../lib/stores/setupStore.svelte';
  import RadiusPreviewMap from '../../../components/map/RadiusPreviewMap.svelte';

  interface Props {
    onNext: () => void;
    onPrev: () => void;
  }

  let { onNext, onPrev }: Props = $props();

  let validationError = $state<string | null>(null);

  const validateAndProceed = () => {
    validationError = null;

    const start = setupStore.operationalPolicy.operatingHoursStart;
    const end = setupStore.operationalPolicy.operatingHoursEnd;
    const radius = setupStore.operationalPolicy.operationalRadiusKm;

    if (!start || !end) {
      validationError = 'Silakan tentukan jam mulai dan jam selesai operasional.';
      return;
    }

    if (start === end) {
      validationError = 'Jam mulai operasional tidak boleh sama dengan jam selesai.';
      return;
    }

    if (!radius || radius <= 0 || isNaN(radius)) {
      validationError = 'Radius maksimum operasional harus bernilai lebih dari 0 KM.';
      return;
    }

    if (radius > 50) {
      validationError = 'Batas radius maksimum rekomendasi adalah 50 KM untuk menjaga efisiensi armada.';
      return;
    }

    onNext();
  };
</script>

<div class="space-y-6">
  <!-- Step Header -->
  <div class="border-b border-[#24242A] pb-4">
    <div class="flex items-center gap-2 text-xs font-outfit-600 text-[#FF634A] tracking-wider uppercase">
      <span>Fase 02</span>
      <span>•</span>
      <span>Kebijakan Operasional</span>
    </div>
    <h2 class="text-xl sm:text-2xl font-outfit-700 text-white mt-1">
      Seberapa jauh dan kapan operasional Anda berjalan?
    </h2>
    <p class="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
      Tentukan jam kerja sistem dan batas jangkauan radius penjualan di sekitar Central Hub.
    </p>
  </div>

  {#if validationError}
    <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
      <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
      <span>{validationError}</span>
    </div>
  {/if}

  <!-- Policy Inputs Grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
    <!-- Operating Hours Start -->
    <div class="space-y-1.5">
      <label for="start-time" class="block text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Jam Mulai Operasional <span class="text-[#FF634A]">*</span>
      </label>
      <div class="relative">
        <Clock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          id="start-time"
          type="time"
          bind:value={setupStore.operationalPolicy.operatingHoursStart}
          class="w-full pl-10 pr-4 py-2.5 bg-[#18181D] border border-[#272730] rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all"
        />
      </div>
      <span class="text-[11px] text-zinc-400">Waktu dimulainya layanan dan dispatch armada</span>
    </div>

    <!-- Operating Hours End -->
    <div class="space-y-1.5">
      <label for="end-time" class="block text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Jam Selesai Operasional <span class="text-[#FF634A]">*</span>
      </label>
      <div class="relative">
        <Clock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          id="end-time"
          type="time"
          bind:value={setupStore.operationalPolicy.operatingHoursEnd}
          class="w-full pl-10 pr-4 py-2.5 bg-[#18181D] border border-[#272730] rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all"
        />
      </div>
      <span class="text-[11px] text-zinc-400">Waktu selesainya layanan dan penutupan shift</span>
    </div>

    <!-- Radius Input with explicit Unit -->
    <div class="space-y-1.5 sm:col-span-2">
      <label for="max-radius" class="block text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Radius Maksimum Operasional <span class="text-[#FF634A]">*</span>
      </label>
      <div class="flex items-center gap-3">
        <div class="relative flex-1">
          <Radio class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            id="max-radius"
            type="number"
            min="1"
            max="50"
            step="1"
            bind:value={setupStore.operationalPolicy.operationalRadiusKm}
            class="w-full pl-10 pr-4 py-2.5 bg-[#18181D] border border-[#272730] rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all"
          />
        </div>
        <div class="px-4 py-2.5 bg-[#24242A] border border-[#272730] rounded-xl text-xs sm:text-sm font-outfit-700 text-white select-none">
          KM (Kilometer)
        </div>
      </div>
      <div class="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
        <span>Batas radius disarankan: 5 – 25 KM</span>
        <span class="font-mono text-zinc-300">{setupStore.operationalPolicy.operationalRadiusKm || 0} KM (~{(setupStore.operationalPolicy.operationalRadiusKm || 0) * 1000} meter)</span>
      </div>
    </div>
  </div>

  <!-- Real-Time Leaflet Radius Preview -->
  <div class="space-y-2 pt-2">
    <div class="flex items-center justify-between">
      <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Visualisasi Lingkaran Jangkauan Operasional
      </h3>
      <span class="text-[11px] text-zinc-400">
        Pusat: {setupStore.identity.centralHubName || 'Central Hub'}
      </span>
    </div>

    <RadiusPreviewMap
      hubLat={setupStore.identity.centralHubLat}
      hubLng={setupStore.identity.centralHubLng}
      hubName={setupStore.identity.centralHubName}
      radiusKm={setupStore.operationalPolicy.operationalRadiusKm}
    />
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
      onclick={validateAndProceed}
      class="px-6 py-3 bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] text-white rounded-xl text-xs sm:text-sm font-outfit-700 shadow-lg shadow-[#FF634A]/25 transition-all flex items-center gap-2 cursor-pointer"
    >
      <span>Lanjutkan ke Armada Awal</span>
      <ArrowRight class="w-4 h-4" />
    </button>
  </div>
</div>
