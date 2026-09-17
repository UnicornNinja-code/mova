<script lang="ts">
  import { 
    Building2, 
    MapPin, 
    Compass, 
    Clock, 
    AlertCircle, 
    CheckCircle2, 
    ArrowRight,
    Check
  } from 'lucide-svelte';
  import { setupStore } from '../../../lib/stores/setupStore.svelte';
  import HubLocationPicker from '../../../components/map/HubLocationPicker.svelte';

  interface Props {
    onConfirmedNext: () => void;
  }

  let { onConfirmedNext }: Props = $props();

  let showConfirmModal = $state(false);
  let formError = $state<string | null>(null);

  const validateAndPrompt = () => {
    formError = null;

    if (!setupStore.identity.businessName.trim()) {
      formError = 'Silakan masukkan Nama Bisnis Anda.';
      return;
    }
    if (!setupStore.identity.hubCityName.trim()) {
      formError = 'Silakan masukkan Kota Wilayah Operasional Hub (cth. Surabaya).';
      return;
    }
    if (!setupStore.identity.centralHubName.trim()) {
      formError = 'Silakan masukkan Nama Central Hub operasional.';
      return;
    }
    if (!setupStore.identity.centralHubAddress.trim()) {
      formError = 'Silakan isi Alamat Central Hub.';
      return;
    }
    if (
      setupStore.identity.centralHubLat === 0 ||
      setupStore.identity.centralHubLng === 0 ||
      isNaN(setupStore.identity.centralHubLat) ||
      isNaN(setupStore.identity.centralHubLng)
    ) {
      formError = 'Silakan tentukan titik lokasi Central Hub pada peta terlebih dahulu.';
      return;
    }

    showConfirmModal = true;
  };

  const handleConfirmLocation = () => {
    showConfirmModal = false;
    onConfirmedNext();
  };

  const handleLocationPicked = (coords: { lat: number; lng: number; displayName?: string }) => {
    formError = null;
    if (coords.displayName) {
      if (!setupStore.identity.centralHubAddress) {
        setupStore.identity.centralHubAddress = coords.displayName;
      }
      if (!setupStore.identity.hubCityName.trim()) {
        const parts = coords.displayName.split(',').map((s) => s.trim());
        for (const p of parts) {
          const clean = p.replace(/^(Kota|Kabupaten|Kab\.|Kota Administrasi)\s+/i, '').trim();
          if (clean && !clean.match(/^\d+$/) && clean.length > 2) {
            if (
              ['Surabaya', 'Sidoarjo', 'Malang', 'Pasuruan', 'Gresik', 'Mojokerto', 'Jakarta', 'Bandung', 'Semarang', 'Yogyakarta', 'Denpasar', 'Medan', 'Makassar'].some(
                (c) => c.toLowerCase() === clean.toLowerCase()
              )
            ) {
              setupStore.identity.hubCityName = clean;
              break;
            }
          }
        }
      }
    }
  };
</script>

<div class="space-y-6">
  <!-- Step Header -->
  <div class="border-b border-[#24242A] pb-4">
    <div class="flex items-center gap-2 text-xs font-outfit-600 text-[#FF634A] tracking-wider uppercase">
      <span>Fase 01</span>
      <span>•</span>
      <span>Identitas Operasional</span>
    </div>
    <h2 class="text-xl sm:text-2xl font-outfit-700 text-white mt-1">
      Di mana pusat operasional bisnis Anda?
    </h2>
    <p class="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
      Tentukan nama bisnis, kota operasional, dan titik markas utama (Central Hub) yang menjadi acuan radius dan armada MOVA.
    </p>
  </div>

  {#if formError}
    <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
      <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
      <span>{formError}</span>
    </div>
  {/if}

  <!-- Form Fields -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    <!-- Business Name -->
    <div class="space-y-1.5">
      <label for="business-name" class="block text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Nama Bisnis <span class="text-[#FF634A]">*</span>
      </label>
      <div class="relative">
        <Building2 class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          id="business-name"
          type="text"
          bind:value={setupStore.identity.businessName}
          placeholder="cth. MOVA Coffee Delivery"
          class="w-full pl-10 pr-4 py-2.5 bg-[#18181D] border border-[#272730] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all"
        />
      </div>
    </div>

    <!-- Hub Operational City -->
    <div class="space-y-1.5">
      <label for="hub-city-name" class="block text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Kota Operasional Hub <span class="text-[#FF634A]">*</span>
      </label>
      <div class="relative">
        <MapPin class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF634A]" />
        <input
          id="hub-city-name"
          type="text"
          bind:value={setupStore.identity.hubCityName}
          placeholder="cth. Surabaya"
          class="w-full pl-10 pr-4 py-2.5 bg-[#18181D] border border-[#272730] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all"
        />
      </div>
    </div>

    <!-- Hub Name -->
    <div class="space-y-1.5">
      <label for="hub-name" class="block text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Nama Central Hub <span class="text-[#FF634A]">*</span>
      </label>
      <div class="relative">
        <Compass class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          id="hub-name"
          type="text"
          bind:value={setupStore.identity.centralHubName}
          placeholder="cth. Hub Pusat Surabaya"
          class="w-full pl-10 pr-4 py-2.5 bg-[#18181D] border border-[#272730] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all"
        />
      </div>
    </div>

    <!-- Timezone -->
    <div class="space-y-1.5">
      <label for="timezone" class="block text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Zona Waktu Operasional
      </label>
      <div class="relative">
        <Clock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <select
          id="timezone"
          bind:value={setupStore.identity.timezone}
          class="w-full pl-10 pr-4 py-2.5 bg-[#18181D] border border-[#272730] rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all cursor-pointer"
        >
          <option value="Asia/Jakarta">WIB — Waktu Indonesia Barat (UTC+7)</option>
          <option value="Asia/Makassar">WITA — Waktu Indonesia Tengah (UTC+8)</option>
          <option value="Asia/Jayapura">WIT — Waktu Indonesia Timur (UTC+9)</option>
        </select>
      </div>
    </div>

    <!-- Hub Full Address -->
    <div class="space-y-1.5 md:col-span-2">
      <label for="hub-address" class="block text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
        Alamat Lengkap Central Hub <span class="text-[#FF634A]">*</span>
      </label>
      <div class="relative">
        <MapPin class="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
        <textarea
          id="hub-address"
          rows="2"
          bind:value={setupStore.identity.centralHubAddress}
          placeholder="cth. Jl. Pemuda No. 45, Kompleks Ruko Sentral Blok A"
          class="w-full pl-10 pr-4 py-2.5 bg-[#18181D] border border-[#272730] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]/60 focus:ring-1 focus:ring-[#FF634A]/20 transition-all resize-none"
        ></textarea>
      </div>
    </div>
  </div>

  <!-- Leaflet Location Picker Section -->
  <div class="space-y-2 pt-2">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wide">
          Pin Titik Koordinat Central Hub <span class="text-[#FF634A]">*</span>
        </h3>
        <p class="text-[11px] text-zinc-400">
          Gunakan kolom pencarian atau klik langsung pada peta untuk memposisikan markas operasional.
        </p>
      </div>
    </div>

    <HubLocationPicker
      bind:lat={setupStore.identity.centralHubLat}
      bind:lng={setupStore.identity.centralHubLng}
      address={setupStore.identity.centralHubAddress}
      onLocationChange={handleLocationPicked}
    />
  </div>

  <!-- Primary Action Button -->
  <div class="pt-4 flex justify-end">
    <button
      type="button"
      onclick={validateAndPrompt}
      class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] text-white rounded-xl text-xs sm:text-sm font-outfit-700 shadow-lg shadow-[#FF634A]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
    >
      <span>Lanjutkan ke Kebijakan Operasional</span>
      <ArrowRight class="w-4 h-4" />
    </button>
  </div>
</div>

<!-- ============================================================ -->
<!-- MODAL KONFIRMASI LOKASI CENTRAL HUB                          -->
<!-- ============================================================ -->
{#if showConfirmModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div class="bg-[#18181D] border border-[#272730] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl shadow-black/50">
      <!-- Modal Header -->
      <div class="flex items-center gap-3 border-b border-[#272730] pb-4">
        <div class="w-10 h-10 rounded-xl bg-[#FF634A]/10 border border-[#FF634A]/20 flex items-center justify-center text-[#FF634A] shrink-0">
          <MapPin class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-outfit-700 text-white">Konfirmasi Lokasi Central Hub</h3>
          <p class="text-xs text-zinc-400">Pastikan koordinat markas operasional sudah tepat</p>
        </div>
      </div>

      <!-- Confirmation Details -->
      <div class="space-y-3 bg-[#121214] border border-[#24242A] p-4 rounded-xl text-xs">
        <div>
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider block">Nama Bisnis & Hub</span>
          <p class="font-outfit-600 text-white mt-0.5">
            {setupStore.identity.businessName} — {setupStore.identity.centralHubName}
          </p>
        </div>

        <div>
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider block">Kota Operasional Hub</span>
          <p class="font-outfit-600 text-[#FF634A] mt-0.5">
            {setupStore.identity.hubCityName}
          </p>
        </div>

        <div>
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider block">Alamat</span>
          <p class="text-zinc-300 mt-0.5 leading-relaxed">
            {setupStore.identity.centralHubAddress}
          </p>
        </div>

        <div>
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider block">Koordinat WGS84</span>
          <p class="font-mono text-zinc-200 mt-0.5">
            {setupStore.identity.centralHubLat.toFixed(6)}, {setupStore.identity.centralHubLng.toFixed(6)}
          </p>
        </div>
      </div>

      <p class="text-xs text-zinc-400 text-center leading-relaxed">
        Apakah lokasi ini sudah sesuai dengan pusat operasional utama Anda?
      </p>

      <!-- Modal Actions -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onclick={() => (showConfirmModal = false)}
          class="px-4 py-2.5 rounded-xl text-xs font-outfit-600 text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
        >
          Kembali
        </button>
        <button
          type="button"
          onclick={handleConfirmLocation}
          class="px-5 py-2.5 rounded-xl text-xs font-outfit-700 text-white bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:from-[#E54E36] hover:to-[#FF634A] shadow-md shadow-[#FF634A]/25 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Check class="w-4 h-4" />
          <span>Ya, Gunakan Lokasi Ini</span>
        </button>
      </div>
    </div>
  </div>
{/if}
