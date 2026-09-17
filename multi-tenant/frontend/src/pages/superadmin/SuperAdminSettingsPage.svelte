<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Settings,
    Building2,
    MapPin,
    Shield,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Save,
    RotateCcw,
    Layers,
    Compass,
    Navigation,
    Lock,
    Key,
    Users,
    Activity,
    Check,
    HelpCircle
  } from 'lucide-svelte';
  import Alert from '../../components/ui/Alert.svelte';
  import { systemReadinessService, type SystemReadinessReport } from '../../services/systemReadinessService';
  import { mapPreferences } from '../../lib/stores/mapPreferences.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();

  let activeTab = $state<'hub' | 'rules' | 'schedule' | 'security' | 'readiness' | 'map'>('hub');
  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  let report = $state<SystemReadinessReport | null>(null);

  // Form State - Tab 1: Hub & Spatial
  let hubName = $state('Central Hub');
  let hubCityName = $state('');
  let hubAddress = $state('');
  let hubLat = $state('-7.2575');
  let hubLng = $state('112.7521');
  let radiusKm = $state('12');

  // Form State - Tab 2: Spatial Rules
  let protocolRoadProhibited = $state(true);
  let tollRoadProhibited = $state(true);

  // Leaflet Map References
  let mapContainer: HTMLDivElement | null = $state(null);
  let leafletMap: any = null;
  let hubMarker: any = null;
  let radiusCircle: any = null;
  let L: any = null;

  const loadSettings = async () => {
    loading = true;
    errorMsg = null;
    try {
      const data = await systemReadinessService.getReadiness();
      report = data;

      if (data.hub_config) {
        hubName = data.hub_config.name || 'Central Hub';
        hubCityName = data.hub_config.city_name || '';
        hubAddress = data.hub_config.address || '';
        hubLat = String(data.hub_config.latitude || '-7.2575');
        hubLng = String(data.hub_config.longitude || '112.7521');
        radiusKm = String(data.hub_config.radius_km || '12');
      }

      if (data.spatial_rules) {
        protocolRoadProhibited = data.spatial_rules.protocol_road_prohibited;
        tollRoadProhibited = data.spatial_rules.toll_road_prohibited;
      }

      updateMapVisuals();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal memuat konfigurasi sistem.';
    } finally {
      loading = false;
    }
  };

  const initMap = async () => {
    if (typeof window === 'undefined' || !mapContainer || leafletMap) return;

    try {
      L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      const lat = parseFloat(hubLat) || -7.4478;
      const lng = parseFloat(hubLng) || 112.7183;
      const radiusMeters = (parseFloat(radiusKm) || 12) * 1000;

      leafletMap = L.map(mapContainer, {
        center: [lat, lng],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
      }).addTo(leafletMap);

      // Hub Marker (Draggable)
      const hubIcon = L.divIcon({
        className: 'custom-hub-pin',
        html: `
          <div style="background-color: #FF634A; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(255, 99, 74, 0.5);">
            <svg style="width: 18px; height: 18px; fill: white;" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      hubMarker = L.marker([lat, lng], { icon: hubIcon, draggable: true }).addTo(leafletMap);
      hubMarker.bindPopup(`<b>${hubName}</b><br>Tarik pin untuk mengubah koordinat pusat.`);

      hubMarker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        hubLat = pos.lat.toFixed(6);
        hubLng = pos.lng.toFixed(6);
        updateMapVisuals();
      });

      // Radius Circle Overlay
      radiusCircle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: '#FF634A',
        fillColor: '#FF634A',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '6, 6',
      }).addTo(leafletMap);

      leafletMap.on('click', (e: any) => {
        hubLat = e.latlng.lat.toFixed(6);
        hubLng = e.latlng.lng.toFixed(6);
        updateMapVisuals();
      });

      setTimeout(() => {
        leafletMap?.invalidateSize();
      }, 200);
    } catch (err) {
      console.warn('Gagal inisialisasi peta Leaflet:', err);
    }
  };

  const updateMapVisuals = () => {
    if (!leafletMap || !L) return;
    const lat = parseFloat(hubLat) || -7.4478;
    const lng = parseFloat(hubLng) || 112.7183;
    const radiusMeters = (parseFloat(radiusKm) || 12) * 1000;

    if (hubMarker) {
      hubMarker.setLatLng([lat, lng]);
    }
    if (radiusCircle) {
      radiusCircle.setLatLng([lat, lng]);
      radiusCircle.setRadius(radiusMeters);
    }
    leafletMap.panTo([lat, lng]);
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          hubLat = pos.coords.latitude.toFixed(6);
          hubLng = pos.coords.longitude.toFixed(6);
          updateMapVisuals();
          successMsg = 'Titik koordinat berhasil diperbarui sesuai lokasi perangkat GPS.';
          setTimeout(() => (successMsg = null), 3000);
        },
        (err) => {
          errorMsg = `Gagal mendeteksi lokasi GPS: ${err.message}`;
          setTimeout(() => (errorMsg = null), 4000);
        }
      );
    }
  };

  const handleSaveAll = async () => {
    saving = true;
    errorMsg = null;
    successMsg = null;

    try {
      const res = await systemReadinessService.updateSettings({
        hub_name: hubName.trim(),
        hub_city_name: hubCityName.trim(),
        hub_address: hubAddress.trim(),
        hub_latitude: parseFloat(hubLat),
        hub_longitude: parseFloat(hubLng),
        operational_radius_km: parseFloat(radiusKm),
        protocol_road_prohibited: protocolRoadProhibited,
        toll_road_prohibited: tollRoadProhibited,
      });

      report = res.report;
      successMsg = res.msg || 'Konfigurasi sistem & parameter operasional berhasil diperbarui.';
      setTimeout(() => (successMsg = null), 4000);
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.message || 'Gagal menyimpan pengaturan sistem.';
    } finally {
      saving = false;
    }
  };

  onMount(async () => {
    await loadSettings();
    setTimeout(() => {
      initMap();
    }, 100);
  });

  onDestroy(() => {
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
    }
  });

  $effect(() => {
    if (activeTab === 'hub' && leafletMap) {
      setTimeout(() => {
        leafletMap.invalidateSize();
      }, 150);
    }
  });
</script>

<div class="space-y-6 font-outfit-400">
  <!-- PAGE HEADER & STATUS BANNER -->
  <div class="p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
    <div class="flex items-center gap-4">
      <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FF634A] to-[#FF8573] text-[#09090B] flex items-center justify-center font-bold shadow-lg shadow-[#FF634A]/25 shrink-0">
        <Settings class="w-7 h-7" />
      </div>
      <div>
        <div class="flex items-center gap-2.5 flex-wrap">
          <h1 class="text-xl sm:text-2xl font-outfit-600 text-white">Pengaturan Sistem & Fondasi Operasional</h1>
          {#if report}
            <span class="px-2.5 py-0.5 rounded-full text-xs font-outfit-600 flex items-center gap-1.5 border
              {report.overall_status === 'READY'
                ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50'
                : 'bg-amber-950/50 text-amber-400 border-amber-800/50'}">
              <span class="w-1.5 h-1.5 rounded-full {report.overall_status === 'READY' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}"></span>
              {report.overall_status === 'READY' ? 'SISTEM SIAP OPERASIONAL' : 'PERLU KONFIGURASI'}
            </span>
          {/if}
        </div>
        <p class="text-xs sm:text-sm text-[#A1A1AA] mt-1">
          Kelola markas Central Hub, batas wilayah PostGIS, jadwal sesi slot harian, dan kebijakan keamanan COZIS.
        </p>
      </div>
    </div>

    <!-- Overall Readiness Health Bar -->
    {#if report}
      <div class="p-3.5 rounded-2xl bg-[#1A1A1F] border border-[#272730] shrink-0 min-w-[200px] space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="text-zinc-400 font-outfit-600">Kesiapan Sistem</span>
          <span class="font-mono font-bold {report.readiness_percentage >= 80 ? 'text-emerald-400' : 'text-amber-400'}">
            {report.readiness_percentage}%
          </span>
        </div>
        <div class="w-full h-2 bg-[#272730] rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500 {report.readiness_percentage >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-[#FF634A]'}"
            style="width: {report.readiness_percentage}%"
          ></div>
        </div>
        <span class="text-[10px] text-zinc-500 block">
          {report.mandatory_passed}/{report.mandatory_total} Fondasi Wajib Terpenuhi
        </span>
      </div>
    {/if}
  </div>

  <!-- FEEDBACK ALERTS -->
  {#if errorMsg}
    <Alert variant="danger" title="Kendala Pengaturan">
      {errorMsg}
    </Alert>
  {/if}

  {#if successMsg}
    <Alert variant="success" title="Pengaturan Berhasil Disimpan">
      {successMsg}
    </Alert>
  {/if}

  <!-- TAB NAVIGATION -->
  <div class="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#24242A]">
    <button
      type="button"
      onclick={() => (activeTab = 'hub')}
      class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
      {activeTab === 'hub'
        ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
        : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
    >
      <Building2 class="w-4 h-4 {activeTab === 'hub' ? 'text-[#FF634A]' : 'text-zinc-400'}" />
      <span>1. Central Hub & Wilayah Spasial</span>
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'rules')}
      class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
      {activeTab === 'rules'
        ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
        : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
    >
      <Compass class="w-4 h-4 {activeTab === 'rules' ? 'text-[#FF634A]' : 'text-purple-400'}" />
      <span>2. Aturan Pembatasan GIS</span>
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'schedule')}
      class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
      {activeTab === 'schedule'
        ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
        : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
    >
      <Clock class="w-4 h-4 {activeTab === 'schedule' ? 'text-[#FF634A]' : 'text-amber-400'}" />
      <span>3. Jadwal & Sesi Operasional</span>
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'security')}
      class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
      {activeTab === 'security'
        ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
        : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
    >
      <Shield class="w-4 h-4 {activeTab === 'security' ? 'text-[#FF634A]' : 'text-emerald-400'}" />
      <span>4. Kebijakan Keamanan & Sesi</span>
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'readiness')}
      class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
      {activeTab === 'readiness'
        ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
        : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
    >
      <Activity class="w-4 h-4 {activeTab === 'readiness' ? 'text-[#FF634A]' : 'text-cyan-400'}" />
      <span>5. Audit Kesiapan Sistem</span>
    </button>

    <button
      type="button"
      onclick={() => (activeTab = 'map')}
      class="px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit-600 transition-all cursor-pointer flex items-center gap-2 shrink-0 border
      {activeTab === 'map'
        ? 'bg-white text-[#09090B] font-extrabold border-white shadow-lg shadow-white/10'
        : 'bg-[#131316] text-[#A1A1AA] hover:text-white border-[#24242A] hover:border-[#383842]'}"
    >
      <Layers class="w-4 h-4 {activeTab === 'map' ? 'text-[#FF634A]' : 'text-sky-400'}" />
      <span>6. Preferensi Map Tiles (Leaflet)</span>
    </button>
  </div>

  <!-- TAB CONTENT DISPLAY -->
  <div>
    <!-- TAB 1: CENTRAL HUB & WILAYAH SPASIAL -->
    {#if activeTab === 'hub'}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left: Form Controls (Col 5) -->
        <div class="lg:col-span-5 p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-5">
          <div class="pb-3 border-b border-[#24242A] flex items-center justify-between">
            <div>
              <h3 class="text-base font-outfit-600 text-white">Parameter Central Hub</h3>
              <p class="text-xs text-[#A1A1AA]">Titik acuan radius batas pembuatan zona operasional</p>
            </div>
            <button
              type="button"
              onclick={handleUseCurrentLocation}
              class="px-3 py-1.5 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-xs font-outfit-600 text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2E2E38]"
              title="Gunakan posisi GPS saat ini"
            >
              <Navigation class="w-3.5 h-3.5 text-[#FF634A]" />
              <span>GPS</span>
            </button>
          </div>

          <div class="space-y-4 text-xs">
            <!-- Hub Name -->
            <div class="space-y-1.5">
              <label for="input-hub-name" class="block font-outfit-600 text-zinc-300">
                Nama Markas Central Hub <span class="text-[#FF634A]">*</span>
              </label>
              <input
                id="input-hub-name"
                type="text"
                bind:value={hubName}
                placeholder="Contoh: Central Hub Surabaya"
                class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none"
              />
            </div>

            <!-- Hub Operational City -->
            <div class="space-y-1.5">
              <label for="input-hub-city" class="block font-outfit-600 text-zinc-300">
                Kota Wilayah Operasional Hub <span class="text-[#FF634A]">*</span>
              </label>
              <input
                id="input-hub-city"
                type="text"
                bind:value={hubCityName}
                placeholder="Contoh: Surabaya"
                class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-outfit-600 focus:border-[#FF634A] focus:outline-none"
              />
            </div>

            <!-- Hub Address -->
            <div class="space-y-1.5">
              <label for="input-hub-address" class="block font-outfit-600 text-zinc-300">
                Alamat Fisik Markas <span class="text-[#FF634A]">*</span>
              </label>
              <textarea
                id="input-hub-address"
                bind:value={hubAddress}
                rows={2}
                placeholder="Alamat lengkap markas operasional..."
                class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs focus:border-[#FF634A] focus:outline-none resize-none"
              ></textarea>
            </div>

            <!-- Coordinates: Lat & Lng -->
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label for="input-hub-lat" class="block font-outfit-600 text-zinc-300">
                  Latitude Geografis <span class="text-[#FF634A]">*</span>
                </label>
                <input
                  id="input-hub-lat"
                  type="text"
                  bind:value={hubLat}
                  oninput={updateMapVisuals}
                  class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-mono focus:border-[#FF634A] focus:outline-none"
                />
              </div>

              <div class="space-y-1.5">
                <label for="input-hub-lng" class="block font-outfit-600 text-zinc-300">
                  Longitude Geografis <span class="text-[#FF634A]">*</span>
                </label>
                <input
                  id="input-hub-lng"
                  type="text"
                  bind:value={hubLng}
                  oninput={updateMapVisuals}
                  class="w-full px-3.5 py-2.5 rounded-2xl bg-[#1A1A1F] border border-[#2E2E38] text-white text-xs font-mono focus:border-[#FF634A] focus:outline-none"
                />
              </div>
            </div>

            <!-- Operational Radius Slider -->
            <div class="space-y-2 p-3.5 rounded-2xl bg-[#1A1A1F] border border-[#272730]">
              <div class="flex items-center justify-between text-xs font-outfit-600">
                <span class="text-zinc-300">Radius Jangkauan Wilayah:</span>
                <span class="text-[#FF634A] font-mono font-bold text-sm">{radiusKm} KM</span>
              </div>
              <input
                type="range"
                min="3"
                max="30"
                step="1"
                bind:value={radiusKm}
                oninput={updateMapVisuals}
                class="w-full h-2 bg-[#272730] rounded-lg appearance-none cursor-pointer accent-[#FF634A]"
              />
              <div class="flex items-center justify-between text-[10px] text-zinc-500">
                <span>3 KM (Urban)</span>
                <span>30 KM (Suburban / Kabupaten)</span>
              </div>
            </div>
          </div>

          <div class="pt-2 border-t border-[#24242A]">
            <button
              type="button"
              onclick={handleSaveAll}
              disabled={saving}
              class="pill-btn-orange w-full text-xs font-outfit-600 disabled:opacity-50 cursor-pointer"
            >
              <span class="w-full py-3 px-4 flex items-center justify-center gap-2 text-white font-bold text-sm">
                <Save class="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Konfigurasi Central Hub'}</span>
              </span>
            </button>
          </div>
        </div>

        <!-- Right: Interactive Leaflet Map Preview (Col 7) -->
        <div class="lg:col-span-7 p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
            <div class="flex items-center gap-2">
              <MapPin class="w-4 h-4 text-[#FF634A]" />
              <h3 class="text-sm font-outfit-600 text-white">Peta Visualisasi Radius Buffer Spasial</h3>
            </div>
            <span class="text-[11px] text-zinc-400">Klik peta atau tarik pin untuk relokasi markas</span>
          </div>

          <div
            bind:this={mapContainer}
            class="w-full h-[460px] rounded-2xl overflow-hidden border border-[#2E2E38] relative z-0"
          ></div>
        </div>
      </div>

    <!-- TAB 2: ATURAN PEMBATASAN SPASIAL GIS -->
    {:else if activeTab === 'rules'}
      <div class="p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-6 max-w-3xl">
        <div class="pb-3 border-b border-[#24242A]">
          <h3 class="text-base font-outfit-600 text-white">Aturan Pembatasan Spasial GIS (PostGIS Constraints)</h3>
          <p class="text-xs text-[#A1A1AA]">Pengaturan restriksi spasial saat pembuatan poligon zona dan validasi geospasial</p>
        </div>

        <div class="space-y-4">
          <!-- Rule 1: Protocol Road -->
          <div class="p-4 rounded-2xl bg-[#1A1A1F] border border-[#272730] flex items-start justify-between gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h4 class="text-xs font-outfit-600 text-white">Larangan Berjualan di Area Jalan Protokol Utama</h4>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600 {protocolRoadProhibited ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : 'bg-zinc-800 text-zinc-400'}">
                  {protocolRoadProhibited ? 'AKTIF' : 'NON-AKTIF'}
                </span>
              </div>
              <p class="text-[11px] text-zinc-400">
                Mencegah pembuatan poligon zona yang melintasi koridor jalur cepat / jalan protokol utama untuk kepatuhan Perda dan keselamatan armada gerobak.
              </p>
            </div>

            <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                bind:checked={protocolRoadProhibited}
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-[#272730] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF634A]"></div>
            </label>
          </div>

          <!-- Rule 2: Toll Road -->
          <div class="p-4 rounded-2xl bg-[#1A1A1F] border border-[#272730] flex items-start justify-between gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h4 class="text-xs font-outfit-600 text-white">Larangan Berjualan di Area Koridor Jalan Tol</h4>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600 {tollRoadProhibited ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : 'bg-zinc-800 text-zinc-400'}">
                  {tollRoadProhibited ? 'AKTIF' : 'NON-AKTIF'}
                </span>
              </div>
              <p class="text-[11px] text-zinc-400">
                Memblokir penetapan zona pada jalur bebas hambatan / tol Surabaya-Porong melalui fungsi interseksi spasial PostGIS ST_Intersects.
              </p>
            </div>

            <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                bind:checked={tollRoadProhibited}
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-[#272730] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF634A]"></div>
            </label>
          </div>
        </div>

        <div class="pt-4 border-t border-[#24242A]">
          <button
            type="button"
            onclick={handleSaveAll}
            disabled={saving}
            class="pill-btn-orange text-xs font-outfit-600 disabled:opacity-50 cursor-pointer"
          >
            <span class="py-2.5 px-5 flex items-center justify-center gap-2 text-white font-bold">
              <Save class="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan Aturan Spasial'}</span>
            </span>
          </button>
        </div>
      </div>

    <!-- TAB 3: JADWAL & SESI OPERASIONAL -->
    {:else if activeTab === 'schedule'}
      <div class="p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-6 max-w-3xl">
        <div class="pb-3 border-b border-[#24242A]">
          <h3 class="text-base font-outfit-600 text-white">Jadwal & Sesi Operasional Harian</h3>
          <p class="text-xs text-[#A1A1AA]">Konfigurasi slot waktu rekomendasi DSS TOPSIS dan durasi reservasi armada</p>
        </div>

        <!-- Time Slot Grid -->
        <div class="space-y-3">
          <h4 class="text-xs font-outfit-600 text-zinc-300 uppercase tracking-wider">4 Slot Sesi Operasional Harian:</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {#each report?.schedule_config?.slots || [] as slot}
              <div class="p-4 rounded-2xl bg-[#1A1A1F] border border-[#272730] flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-xl bg-[#24242C] text-[#FF634A] flex items-center justify-center font-mono font-bold text-xs">
                    {slot.code}
                  </div>
                  <div>
                    <span class="font-outfit-600 text-white text-xs block">{slot.name}</span>
                    <span class="text-[11px] text-zinc-400 font-mono">{slot.time_range}</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-outfit-600 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                  Aktif
                </span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Fleet Hold Duration -->
        <div class="p-4 rounded-2xl bg-[#1A1A1F] border border-[#272730] space-y-2">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xs font-outfit-600 text-white">Batas Waktu Hold Reservasi Armada (BR-FLEET-02)</h4>
              <p class="text-[11px] text-zinc-400">Durasi maksimum status HELD sebelum otomatis kedaluwarsa jika rider belum klaim fisik.</p>
            </div>
            <span class="px-2.5 py-1 rounded-xl bg-purple-950/40 text-purple-300 border border-purple-800/40 font-mono font-bold text-xs">
              5 Menit
            </span>
          </div>
        </div>
      </div>

    <!-- TAB 4: KEAMANAN & KEBIJAKAN AUTENTIKASI -->
    {:else if activeTab === 'security'}
      <div class="p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-6 max-w-3xl">
        <div class="pb-3 border-b border-[#24242A]">
          <h3 class="text-base font-outfit-600 text-white">Kebijakan Keamanan & Sesi Autentikasi</h3>
          <p class="text-xs text-[#A1A1AA]">Pengaturan token JWT, durasi undangan pengguna, dan perlindungan keamanan akun</p>
        </div>

        <div class="space-y-3">
          <!-- Policy 1: Invitation Token -->
          <div class="p-4 rounded-2xl bg-[#1A1A1F] border border-[#272730] flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-blue-950/40 text-blue-400 border border-blue-800/40 flex items-center justify-center shrink-0">
                <Users class="w-4 h-4" />
              </div>
              <div>
                <h4 class="text-xs font-outfit-600 text-white">Masa Berlaku Token Undangan User (BR-AUTH-02)</h4>
                <p class="text-[11px] text-zinc-400">Token aktivasi mandiri akun baru yang dikirimkan melalui link undangan.</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-xl bg-blue-950/40 text-blue-300 border border-blue-800/40 font-mono font-bold text-xs">
              48 Jam
            </span>
          </div>

          <!-- Policy 2: JWT Access Token -->
          <div class="p-4 rounded-2xl bg-[#1A1A1F] border border-[#272730] flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center justify-center shrink-0">
                <Key class="w-4 h-4" />
              </div>
              <div>
                <h4 class="text-xs font-outfit-600 text-white">Durasi Access Token JWT (BR-AUTH-04)</h4>
                <p class="text-[11px] text-zinc-400">Masa aktif access token singkat untuk meminimalisir risiko session hijacking.</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-xl bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 font-mono font-bold text-xs">
              15 Menit
            </span>
          </div>

          <!-- Policy 3: Refresh Token Rotation -->
          <div class="p-4 rounded-2xl bg-[#1A1A1F] border border-[#272730] flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-purple-950/40 text-purple-400 border border-purple-800/40 flex items-center justify-center shrink-0">
                <Lock class="w-4 h-4" />
              </div>
              <div>
                <h4 class="text-xs font-outfit-600 text-white">Refresh Token Rotation via HttpOnly Cookie (BR-AUTH-05)</h4>
                <p class="text-[11px] text-zinc-400">Penyimpanan refresh token dalam cookie aman dengan revokasi otomatis saat logout.</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-xl bg-purple-950/40 text-purple-300 border border-purple-800/40 font-outfit-600 text-xs">
              Aktif
            </span>
          </div>

          <!-- Policy 4: Anti Account Enumeration -->
          <div class="p-4 rounded-2xl bg-[#1A1A1F] border border-[#272730] flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-amber-950/40 text-amber-400 border border-amber-800/40 flex items-center justify-center shrink-0">
                <Shield class="w-4 h-4" />
              </div>
              <div>
                <h4 class="text-xs font-outfit-600 text-white">Perlindungan Anti-Account Enumeration (BR-AUTH-06)</h4>
                <p class="text-[11px] text-zinc-400">Pesan generik pada alur lupa password untuk mencegah scanning email terdaftar.</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-xl bg-amber-950/40 text-amber-300 border border-amber-800/40 font-outfit-600 text-xs">
              Aktif
            </span>
          </div>
        </div>
      </div>

    <!-- TAB 5: AUDIT KESIAPAN SISTEM -->
    {:else if activeTab === 'readiness'}
      <div class="p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#24242A]">
          <div>
            <h3 class="text-base font-outfit-600 text-white">Audit 5 Kategori Kesiapan Sistem (Lifecycle Phase 1-3)</h3>
            <p class="text-xs text-[#A1A1AA]">Evaluasi menyeluruh terhadap fondasi operasional, zona spasial, DSS, dan armada</p>
          </div>

          <button
            type="button"
            onclick={loadSettings}
            class="px-3.5 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-xs font-outfit-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2E2E38]"
          >
            <RotateCcw class="w-3.5 h-3.5 text-[#FF634A]" />
            <span>Pindai Ulang Kesiapan</span>
          </button>
        </div>

        {#if report}
          <div class="space-y-3">
            {#each report.items as item}
              <div class="p-4 rounded-2xl bg-[#1A1A1F] border border-[#272730] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#383842] transition-colors">
                <div class="flex items-start gap-3">
                  <div class="mt-0.5">
                    {#if item.status === 'READY'}
                      <CheckCircle2 class="w-5 h-5 text-emerald-400 shrink-0" />
                    {:else}
                      <AlertTriangle class="w-5 h-5 text-amber-400 shrink-0" />
                    {/if}
                  </div>
                  <div class="space-y-0.5">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs font-outfit-600 text-white">{item.title}</span>
                      {#if item.is_mandatory}
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-outfit-600 bg-rose-950/40 text-rose-400 border border-rose-800/40">
                          Wajib
                        </span>
                      {:else}
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-outfit-600 bg-zinc-800 text-zinc-400">
                          Disarankan
                        </span>
                      {/if}
                    </div>
                    <p class="text-[11px] text-zinc-400">{item.description}</p>
                  </div>
                </div>

                <div class="flex items-center gap-3 self-end sm:self-auto">
                  {#if item.current_value}
                    <span class="font-mono text-xs text-zinc-300 bg-[#24242C] px-2.5 py-1 rounded-xl">
                      {item.current_value}
                    </span>
                  {/if}
                  <button
                    type="button"
                    onclick={() => onNavigate(item.route)}
                    class="px-3 py-1.5 rounded-xl bg-[#24242C] hover:bg-[#FF634A] hover:text-white text-zinc-200 text-xs font-outfit-600 transition-colors cursor-pointer"
                  >
                    {item.action_label}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    <!-- TAB 6: PREFERENSI MAP TILES & LAYER SPASIAL -->
    {:else if activeTab === 'map'}
      <div class="p-6 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-6 max-w-4xl">
        <div class="pb-3 border-b border-[#24242A] flex items-center justify-between">
          <div>
            <h3 class="text-base font-outfit-600 text-white">Preferensi Map Tiles Leaflet & Layer Spasial</h3>
            <p class="text-xs text-[#A1A1AA]">Pilih gaya peta dasar (basemap tiles) dan pengaturan toleransi penyangga buffer geofence PostGIS</p>
          </div>
          <button
            type="button"
            onclick={() => mapPreferences.resetDefaults()}
            class="px-3 py-1.5 rounded-xl bg-[#1A1A22] hover:bg-[#252530] text-zinc-300 text-xs font-outfit-600 border border-[#2E2E3C] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Reset Bawaan</span>
          </button>
        </div>

        <!-- Basemap Tile Selector Grid -->
        <div class="space-y-3">
          <span class="text-xs font-outfit-600 text-zinc-300 block">
            Gaya Peta Dasar Aktif (Tersimpan di Preferensi Sistem):
          </span>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {#each mapPreferences.providers as provider}
              {@const isSelected = mapPreferences.state.basemapId === provider.id}
              <button
                type="button"
                onclick={() => mapPreferences.setBasemap(provider.id)}
                class="p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 {isSelected
                  ? 'bg-[#FF634A]/10 border-[#FF634A] shadow-lg shadow-[#FF634A]/10'
                  : 'bg-[#18181D] border-[#2E2E38] hover:border-zinc-500'}"
              >
                <div>
                  <span class="font-outfit-600 text-xs text-white block">{provider.name}</span>
                  <span class="text-[10px] text-zinc-400 font-mono block mt-0.5">{provider.id}</span>
                </div>
                <div class="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-zinc-400">
                    MAX ZOOM {provider.maxZoom}
                  </span>
                  {#if isSelected}
                    <div class="w-5 h-5 rounded-full bg-[#FF634A] flex items-center justify-center text-white text-xs shadow-md">
                      <Check class="w-3 h-3 stroke-[3]" />
                    </div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Geofence Tolerance Buffer Slider -->
        <div class="p-4 rounded-2xl bg-[#1A1A1F] border border-[#272730] space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xs font-outfit-600 text-white">Toleransi Radius Penyangga Geofence (PostGIS Buffer)</h4>
              <p class="text-[11px] text-zinc-400">Toleransi deviasi sinyal GPS rider perkotaan sebelum dinyatakan di luar zona poligon</p>
            </div>
            <span class="text-sm font-mono font-bold text-[#FF634A]">±{mapPreferences.state.geofenceBufferMeters} Meter</span>
          </div>
          <input
            type="range"
            min="10"
            max="150"
            step="5"
            value={mapPreferences.state.geofenceBufferMeters}
            oninput={(e) => mapPreferences.setBufferMeters(Number((e.target as HTMLInputElement).value))}
            class="w-full accent-[#FF634A] h-2 bg-zinc-700 rounded-lg cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Ketat (±10m)</span>
            <span>Standar Surabaya (±50m)</span>
            <span>Longgar (±150m)</span>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
