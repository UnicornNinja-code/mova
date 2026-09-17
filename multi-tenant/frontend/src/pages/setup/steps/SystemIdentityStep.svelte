<script lang="ts">
  import { 
    Building2, 
    MapPin, 
    Compass, 
    AlertCircle, 
    ArrowRight, 
    ArrowLeft, 
    Check, 
    Loader2,
    Globe,
    RotateCcw,
    Trash2,
    X
  } from 'lucide-svelte';
  import { setupStore } from '../../../lib/stores/setupStore.svelte';
  import HubLocationPicker from '../../../components/map/HubLocationPicker.svelte';
  import { mapService, type GeocodeResult } from '../../../services/mapService';

  /**
   * Helper: Determine Indonesian timezone by longitude coordinate
   */
  const determineTimezoneByLng = (longitude: number): string => {
    if (longitude < 115) return 'Asia/Jakarta'; // WIB (UTC+7)
    if (longitude >= 115 && longitude <= 125) return 'Asia/Makassar'; // WITA (UTC+8)
    return 'Asia/Jayapura'; // WIT (UTC+9)
  };

  interface Props {
    onConfirmedNext: () => void;
  }

  let { onConfirmedNext }: Props = $props();

  // Sub-step index (1: Nama Bisnis, 2: Lokasi & Map, 3: Nama Hub)
  let subStep = $state<1 | 2 | 3>(1);
  let formError = $state<string | null>(null);

  // Address search states for address field
  let isSearchingAddress = $state(false);
  let addressSuggestions = $state<GeocodeResult[]>([]);
  let isAddressDropdownOpen = $state(false);
  let addressDebounceTimer: any = null;

  let locationPickerRef = $state<any>(null);

  // Derived condition: whether any location info is entered
  let hasLocationData = $derived(
    Boolean(
      setupStore.identity.centralHubLat !== 0 ||
      setupStore.identity.centralHubLng !== 0 ||
      setupStore.identity.centralHubAddress.trim() !== '' ||
      setupStore.identity.hubCityName.trim() !== ''
    )
  );

  /**
   * Clear all location fields and reset map pin
   */
  const handleClearLocationData = () => {
    setupStore.identity.centralHubLat = 0;
    setupStore.identity.centralHubLng = 0;
    setupStore.identity.centralHubAddress = '';
    setupStore.identity.hubCityName = '';
    addressSuggestions = [];
    isAddressDropdownOpen = false;
    formError = null;

    if (locationPickerRef?.clearLocation) {
      locationPickerRef.clearLocation();
    }
  };

  /**
   * Validate current sub-step before advancing
   */
  const handleNextSubStep = () => {
    formError = null;

    if (subStep === 1) {
      if (!setupStore.identity.businessName.trim()) {
        formError = 'Silakan masukkan Nama Bisnis Anda.';
        return;
      }
      subStep = 2;
    } else if (subStep === 2) {
      if (!setupStore.identity.hubCityName.trim()) {
        formError = 'Silakan masukkan Kota Operasional Hub Anda.';
        return;
      }
      if (!setupStore.identity.centralHubAddress.trim()) {
        formError = 'Silakan tentukan Alamat Lengkap atau titik pada peta.';
        return;
      }
      if (
        setupStore.identity.centralHubLat === 0 ||
        setupStore.identity.centralHubLng === 0 ||
        isNaN(setupStore.identity.centralHubLat) ||
        isNaN(setupStore.identity.centralHubLng)
      ) {
        formError = 'Silakan tentukan titik koordinat Central Hub pada peta.';
        return;
      }

      // Auto-suggest Central Hub Name if not already set
      if (!setupStore.identity.centralHubName.trim()) {
        setupStore.identity.centralHubName = `Central Hub ${setupStore.identity.hubCityName.trim()}`;
      }

      subStep = 3;
    } else if (subStep === 3) {
      if (!setupStore.identity.centralHubName.trim()) {
        formError = 'Silakan masukkan Nama Central Hub operasional.';
        return;
      }
      // Finish Phase 1 and advance to Phase 2
      onConfirmedNext();
    }
  };

  const handlePrevSubStep = () => {
    formError = null;
    if (subStep > 1) {
      subStep = (subStep - 1) as 1 | 2 | 3;
    }
  };

  /**
   * Handle changes from HubLocationPicker (map click, drag, or search)
   */
  const handleLocationPicked = (info: {
    lat: number;
    lng: number;
    displayName: string;
    city?: string;
    timezone?: string;
  }) => {
    formError = null;
    
    // Auto-update full address
    if (info.displayName) {
      setupStore.identity.centralHubAddress = info.displayName;
    }

    // Auto-update city if found
    if (info.city && info.city.trim()) {
      setupStore.identity.hubCityName = info.city.trim();
    }

    // Auto timezone silently in background
    if (info.timezone) {
      setupStore.identity.timezone = info.timezone;
    } else if (info.lng) {
      setupStore.identity.timezone = determineTimezoneByLng(info.lng);
    }
  };

  /**
   * Address field input typing with search suggestions
   */
  const handleAddressInput = () => {
    formError = null;
    if (addressDebounceTimer) clearTimeout(addressDebounceTimer);

    const query = setupStore.identity.centralHubAddress;
    if (!query || query.trim().length < 3) {
      addressSuggestions = [];
      isAddressDropdownOpen = false;
      return;
    }

    addressDebounceTimer = setTimeout(async () => {
      isSearchingAddress = true;
      try {
        const results = await mapService.searchLocation(query);
        addressSuggestions = results;
        isAddressDropdownOpen = results.length > 0;
      } catch {
        addressSuggestions = [];
      } finally {
        isSearchingAddress = false;
      }
    }, 350);
  };

  const selectAddressSuggestion = (item: GeocodeResult) => {
    const itemLat = parseFloat(item.lat);
    const itemLng = parseFloat(item.lon);
    if (isNaN(itemLat) || isNaN(itemLng)) return;

    setupStore.identity.centralHubAddress = item.display_name;
    setupStore.identity.centralHubLat = itemLat;
    setupStore.identity.centralHubLng = itemLng;
    isAddressDropdownOpen = false;

    // Silent background timezone
    setupStore.identity.timezone = determineTimezoneByLng(itemLng);

    // Auto city from item
    let resolvedCity = item.city || '';
    if (!resolvedCity) {
      const parts = item.display_name.split(',').map((s) => s.trim());
      for (const p of parts) {
        const clean = p.replace(/^(Kota|Kabupaten|Kab\.|Kota Administrasi)\s+/i, '').trim();
        if (clean && !clean.match(/^\d+$/) && clean.length > 2) {
          if (
            ['Surabaya', 'Sidoarjo', 'Malang', 'Pasuruan', 'Gresik', 'Mojokerto', 'Jakarta', 'Bandung', 'Semarang', 'Yogyakarta', 'Denpasar', 'Medan', 'Makassar', 'Bekasi', 'Tangerang', 'Depok', 'Bogor'].some(
              (c) => c.toLowerCase() === clean.toLowerCase()
            )
          ) {
            resolvedCity = clean;
            break;
          }
        }
      }
    }

    if (resolvedCity) {
      setupStore.identity.hubCityName = resolvedCity;
    }

    if (locationPickerRef?.flyToLocation) {
      locationPickerRef.flyToLocation(itemLat, itemLng, item.display_name, resolvedCity);
    }
  };
</script>

<div class="space-y-8 max-w-3xl mx-auto text-center">
  <!-- Clean Phase Header (Centered Sub-step Indicator) -->
  <div class="flex flex-col items-center justify-center gap-2 border-b border-[#24242A] pb-4">
    <span class="text-xs font-semibold text-[#FF634A] tracking-wider uppercase font-mono">
      Fase 1: Identitas & Lokasi Hub
    </span>

    <!-- Centered Sub-step Indicator (Pills) -->
    <div class="flex items-center gap-2 pt-1">
      {#each [1, 2, 3] as stepNum}
        <div class="h-2 rounded-full transition-all duration-300 {subStep === stepNum ? 'w-8 bg-gradient-to-r from-[#FF634A] to-[#FF8573] shadow-md shadow-[#FF634A]/30' : subStep > stepNum ? 'w-3 bg-emerald-500' : 'w-3 bg-zinc-700'}"></div>
      {/each}
    </div>
  </div>

  {#if formError}
    <div class="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center gap-2.5 text-xs text-rose-300 max-w-lg mx-auto animate-in fade-in duration-200">
      <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
      <span>{formError}</span>
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════ -->
  <!-- QUESTION 1: Apa Nama Bisnis Anda?                          -->
  <!-- ══════════════════════════════════════════════════════════ -->
  {#if subStep === 1}
    <div class="space-y-6 py-4 animate-in fade-in duration-300 flex flex-col items-center">
      <div class="space-y-2 text-center max-w-lg">
        <h3 class="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight">
          Apa Nama bisnis Anda?
        </h3>
        <p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">
          Masukkan nama entitas bisnis atau merek layanan operasional Anda.
        </p>
      </div>

      <div class="relative w-full max-w-md">
        <Building2 class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          id="business-name"
          type="text"
          bind:value={setupStore.identity.businessName}
          onkeydown={(e) => e.key === 'Enter' && handleNextSubStep()}
          placeholder="cth. MOVA Coffee Delivery"
          class="w-full pl-12 pr-10 py-3.5 sm:py-4 bg-[#18181D] border border-[#272730] rounded-2xl text-base sm:text-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]/60 focus:ring-2 focus:ring-[#FF634A]/20 transition-all text-center sm:text-left"
        />
        {#if setupStore.identity.businessName}
          <button
            type="button"
            onclick={() => (setupStore.identity.businessName = '')}
            class="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Bersihkan teks"
          >
            <X class="w-4 h-4" />
          </button>
        {/if}
      </div>
    </div>

  <!-- ══════════════════════════════════════════════════════════ -->
  <!-- QUESTION 2: Dimana HUB Anda Beroperasi?                    -->
  <!-- (Map Panel at Top, Inputs Below with Clear Widget)         -->
  <!-- ══════════════════════════════════════════════════════════ -->
  {:else if subStep === 2}
    <div class="space-y-6 py-2 animate-in fade-in duration-300 flex flex-col items-center w-full">
      <div class="space-y-2 text-center max-w-lg">
        <div class="flex items-center justify-center gap-3">
          <h3 class="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight">
            Di mana HUB Anda beroperasi?
          </h3>
        </div>
        <p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">
          Pilih lokasi pada peta atau cari alamat di bawah. Kota operasional terhubung otomatis.
        </p>
      </div>

      <!-- MAP PANEL AT THE VERY TOP -->
      <div class="w-full text-left">
        <HubLocationPicker
          bind:this={locationPickerRef}
          bind:lat={setupStore.identity.centralHubLat}
          bind:lng={setupStore.identity.centralHubLng}
          bind:address={setupStore.identity.centralHubAddress}
          onLocationChange={handleLocationPicked}
          onClear={handleClearLocationData}
        />
      </div>

      <!-- INPUT FIELDS BELOW MAP PANEL -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left pt-1">
        <!-- Kota Operasional (Terhubung Otomatis) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label for="hub-city-name" class="block text-xs font-semibold text-zinc-300 tracking-wide uppercase">
              Kota Operasional <span class="text-[#FF634A]">*</span>
            </label>
            {#if setupStore.identity.hubCityName}
              <button
                type="button"
                onclick={() => (setupStore.identity.hubCityName = '')}
                class="text-[11px] text-zinc-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                title="Hapus kota"
              >
                <X class="w-3 h-3" /> Clear
              </button>
            {:else}
              <span class="text-[10px] text-zinc-500 font-mono">
                Terhubung otomatis
              </span>
            {/if}
          </div>
          <div class="relative">
            <MapPin class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF634A]" />
            <input
              id="hub-city-name"
              type="text"
              bind:value={setupStore.identity.hubCityName}
              placeholder="cth. Surabaya / Sidoarjo / Jakarta"
              class="w-full pl-11 pr-4 py-3 bg-[#18181D] border border-[#272730] rounded-2xl text-sm sm:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]/60 focus:ring-2 focus:ring-[#FF634A]/20 transition-all"
            />
          </div>
        </div>

        <!-- Alamat Lengkap Central Hub (Terhubung Dua Arah dengan Peta) -->
        <div class="space-y-2 relative z-40">
          <div class="flex items-center justify-between">
            <label for="hub-address" class="block text-xs font-semibold text-zinc-300 tracking-wide uppercase">
              Alamat Lengkap Central Hub <span class="text-[#FF634A]">*</span>
            </label>
            {#if setupStore.identity.centralHubAddress}
              <button
                type="button"
                onclick={() => { setupStore.identity.centralHubAddress = ''; addressSuggestions = []; isAddressDropdownOpen = false; }}
                class="text-[11px] text-zinc-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                title="Hapus alamat"
              >
                <X class="w-3 h-3" /> Clear
              </button>
            {:else}
              <span class="text-[10px] text-zinc-500 font-mono">
                🇮🇩 Indonesia
              </span>
            {/if}
          </div>
          <div class="relative">
            <MapPin class="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
            <textarea
              id="hub-address"
              rows="2"
              bind:value={setupStore.identity.centralHubAddress}
              oninput={handleAddressInput}
              placeholder="Ketik alamat lengkap atau gunakan pencarian peta..."
              class="w-full pl-11 pr-10 py-3 bg-[#18181D] border border-[#272730] rounded-2xl text-sm sm:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]/60 focus:ring-2 focus:ring-[#FF634A]/20 transition-all resize-none"
            ></textarea>

            {#if isSearchingAddress}
              <div class="absolute right-3.5 top-3.5">
                <Loader2 class="w-4 h-4 text-[#FF634A] animate-spin" />
              </div>
            {/if}

            <!-- Autocomplete Suggestions Dropdown with Super High Z-Index -->
            {#if isAddressDropdownOpen && addressSuggestions.length > 0}
              <div class="absolute left-0 right-0 top-full mt-1.5 bg-[#18181D] border border-white/10 rounded-2xl shadow-2xl z-[3000] max-h-52 overflow-y-auto divide-y divide-[#272730] backdrop-blur-2xl ring-1 ring-black/60">
                <div class="px-3 py-1.5 bg-[#121214] border-b border-white/5 flex items-center justify-between text-[10px] text-zinc-400">
                  <span class="flex items-center gap-1 font-mono">
                    <Globe class="w-3 h-3 text-[#FF634A]" /> Hasil Pencarian Indonesia
                  </span>
                  <span class="text-[9px] text-zinc-500">Klik untuk sinkronisasi peta</span>
                </div>
                {#each addressSuggestions as item}
                  <button
                    type="button"
                    onclick={() => selectAddressSuggestion(item)}
                    class="w-full text-left px-4 py-2.5 hover:bg-[#24242A] transition-colors flex items-start gap-2.5 group cursor-pointer"
                  >
                    <MapPin class="w-4 h-4 text-[#FF634A] shrink-0 mt-0.5" />
                    <div class="min-w-0 flex-1">
                      <p class="text-xs sm:text-sm font-medium text-zinc-200 group-hover:text-white truncate">
                        {item.display_name.split(',')[0]}
                      </p>
                      <p class="text-[11px] text-zinc-400 truncate">
                        {item.display_name}
                      </p>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

  <!-- ══════════════════════════════════════════════════════════ -->
  <!-- QUESTION 3: Berikan Nama HUB Anda                          -->
  <!-- ══════════════════════════════════════════════════════════ -->
  {:else if subStep === 3}
    <div class="space-y-6 py-4 animate-in fade-in duration-300 flex flex-col items-center">
      <div class="space-y-2 text-center max-w-lg">
        <h3 class="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight">
          Berikan nama HUB Anda
        </h3>
        <p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">
          Beri label pengenal untuk markas operasional utama ini.
        </p>
      </div>

      <div class="relative w-full max-w-md">
        <Compass class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          id="hub-name"
          type="text"
          bind:value={setupStore.identity.centralHubName}
          onkeydown={(e) => e.key === 'Enter' && handleNextSubStep()}
          placeholder="cth. Central Hub Surabaya Timur"
          class="w-full pl-12 pr-10 py-3.5 sm:py-4 bg-[#18181D] border border-[#272730] rounded-2xl text-base sm:text-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF634A]/60 focus:ring-2 focus:ring-[#FF634A]/20 transition-all text-center sm:text-left"
        />
        {#if setupStore.identity.centralHubName}
          <button
            type="button"
            onclick={() => (setupStore.identity.centralHubName = '')}
            class="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Bersihkan nama hub"
          >
            <X class="w-4 h-4" />
          </button>
        {/if}
      </div>

      <!-- Clean Summary Confirmation Card -->
      <div class="w-full max-w-md p-4 sm:p-5 rounded-2xl bg-[#121214] border border-white/5 space-y-3 text-xs text-zinc-300 text-left">
        <div class="flex items-center justify-between text-xs font-semibold text-zinc-400 border-b border-white/5 pb-2">
          <span>Ringkasan Identitas Hub</span>
          <span class="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
            <Check class="w-3.5 h-3.5" /> Terverifikasi
          </span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span class="text-zinc-500 block text-[10px] uppercase tracking-wider">Nama Bisnis</span>
            <span class="font-medium text-white text-sm">{setupStore.identity.businessName}</span>
          </div>
          <div>
            <span class="text-zinc-500 block text-[10px] uppercase tracking-wider">Kota Operasional</span>
            <span class="font-medium text-[#FF8573] text-sm">{setupStore.identity.hubCityName}</span>
          </div>
          <div class="col-span-2">
            <span class="text-zinc-500 block text-[10px] uppercase tracking-wider">Alamat Lengkap</span>
            <span class="text-zinc-300 line-clamp-2 leading-relaxed">{setupStore.identity.centralHubAddress}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Centered / Balanced Navigation Action Buttons Bar -->
  <div class="pt-4 flex items-center justify-center gap-4 border-t border-white/5">
    {#if subStep > 1}
      <button
        type="button"
        onclick={handlePrevSubStep}
        class="px-6 py-3 rounded-2xl text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer border border-white/10"
      >
        <ArrowLeft class="w-4 h-4" />
        <span>Kembali</span>
      </button>
    {/if}

    <button
      type="button"
      onclick={handleNextSubStep}
      class="px-8 py-3 bg-gradient-to-r from-[#FF634A] to-[#FF8573] hover:opacity-90 text-white rounded-2xl text-xs sm:text-sm font-semibold shadow-lg shadow-[#FF634A]/25 transition-all flex items-center gap-2 cursor-pointer border-0"
    >
      <span>{subStep === 3 ? 'Lanjut ke Fase 2' : 'Lanjut'}</span>
      <ArrowRight class="w-4 h-4" />
    </button>
  </div>
</div>
