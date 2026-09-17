<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Layers, 
    RefreshCw, 
    CloudRain, 
    Sun, 
    Wind, 
    Building, 
    GraduationCap, 
    Train, 
    Trees, 
    MapPin, 
    Search, 
    Sparkles, 
    CheckCircle2, 
    AlertTriangle,
    Compass,
    Info
  } from 'lucide-svelte';
  import { axiosInstance } from '../../lib/axios';
  import { setupStore } from '../../lib/stores/setupStore.svelte';

  interface Props {
    onNavigate?: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let loading = $state(true);
  let syncing = $state(false);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  let pois = $state<any[]>([]);
  let zones = $state<any[]>([]);
  let searchQuery = $state('');
  let selectedCategory = $state('ALL');
  let hubCity = $state<string>('Surabaya');
  let hubWeather = $state<any | null>(null);

  const resolveHubCity = async () => {
    if (setupStore.identity.hubCityName) {
      hubCity = setupStore.identity.hubCityName;
      return;
    }
    try {
      const res = await axiosInstance.get('/settings/HUB_CITY_NAME');
      const val = res.data?.value || res.data?.setting?.value;
      if (val) hubCity = val;
    } catch {
      hubCity = 'Surabaya';
    }
  };

  const loadWeather = async () => {
    try {
      const res = await axiosInstance.get(`/weather/hub/${encodeURIComponent(hubCity)}`);
      hubWeather = res.data?.weather || res.data || null;
    } catch {
      hubWeather = null;
    }
  };

  const loadPois = async () => {
    loading = true;
    errorMsg = null;
    try {
      await resolveHubCity();
      const res = await axiosInstance.get('/pois/operational-area', {
        params: { hub_id: hubCity }
      });
      pois = res.data?.pois || [];
      zones = res.data?.zones || [];
      await loadWeather();
    } catch (err: any) {
      pois = [];
      zones = [];
      errorMsg = err?.response?.data?.msg || err?.response?.data?.message || err?.message || 'Gagal memuat data POI dari database.';
    } finally {
      loading = false;
    }
  };

  const handleSyncOsm = async () => {
    syncing = true;
    errorMsg = null;
    successMsg = null;
    try {
      const res = await axiosInstance.post('/pois/sync-osm', { city: hubCity });
      successMsg = res.data?.message || `Sinkronisasi POI Overpass OSM wilayah '${hubCity}' berhasil diselesaikan!`;
      await loadPois();
    } catch (err: any) {
      errorMsg = err?.response?.data?.msg || err?.response?.data?.message || err?.message || 'Gagal menyinkronkan data POI OSM.';
    } finally {
      syncing = false;
    }
  };

  onMount(() => {
    loadPois();
  });

  const filteredPois = $derived(
    pois.filter((p) => {
      const matchName = !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchName && matchCat;
    })
  );

  const unassignedCount = $derived(
    pois.filter((p) => !p.zone_id && !p.zone_name).length
  );
</script>

<div class="space-y-6 max-w-7xl mx-auto pb-12 font-outfit-400">
  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#24242A]">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 text-black flex items-center justify-center font-bold shadow-lg shadow-sky-500/20">
        <Layers class="w-5 h-5 stroke-[2.2]" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl sm:text-2xl font-outfit-600 font-bold text-white">Eksplorasi POI & Cuaca Spasial</h1>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
            OpenStreetMap & Open-Meteo
          </span>
        </div>
        <p class="text-xs text-zinc-400">
          Katalog titik pusat keramaian (POI) dan telemetri cuaca operasional hub {hubCity}
        </p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2.5">
      <button
        type="button"
        onclick={loadPois}
        class="px-3.5 py-2 rounded-xl bg-[#1A1A22] hover:bg-[#24242E] text-zinc-300 text-xs font-bold border border-[#2E2E3C] transition-all cursor-pointer flex items-center gap-1.5"
      >
        <RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
        <span>Refresh</span>
      </button>

      <button
        type="button"
        onclick={handleSyncOsm}
        disabled={syncing}
        class="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-black text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
      >
        <RefreshCw class="w-4 h-4 {syncing ? 'animate-spin' : ''}" />
        <span>{syncing ? 'Menyinkronkan OSM...' : 'Sinkronisasi Overpass OSM'}</span>
      </button>
    </div>
  </div>

  {#if errorMsg}
    <div class="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2.5 shadow-lg">
      <AlertTriangle class="w-4 h-4 shrink-0 text-rose-400" />
      <span>{errorMsg}</span>
    </div>
  {/if}

  {#if successMsg}
    <div class="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg">
      <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400" />
      <span>{successMsg}</span>
    </div>
  {/if}

  <!-- SECTION 1: Status Zonasi & Telemetri Cuaca Operasional -->
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-bold text-white flex items-center gap-2">
        <CloudRain class="w-4 h-4 text-sky-400" />
        Telemetri Cuaca Spasial Real-time (Hub {hubCity})
      </h3>
      <span class="text-xs text-zinc-400 font-mono">Status: {zones.length} Zona Aktif • {unassignedCount} POI Belum Terzonasi</span>
    </div>

    {#if zones.length === 0}
      <div class="p-4 rounded-3xl bg-[#131317] border border-[#24242E] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 flex items-center justify-center shrink-0">
            <Compass class="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <div class="text-xs font-bold text-white flex items-center gap-2">
              <span>Zonasi Operasional Belum Dikonfigurasi</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                UNASSIGNED POIs
              </span>
            </div>
            <p class="text-[11px] text-zinc-400">
              Seluruh POI yang telah diimpor berstatus bebas (<code class="text-zinc-300">zone_id IS NULL</code>). POI akan dialokasikan ke zona saat algoritma DSS/zoning dijalankan.
            </p>
          </div>
        </div>

        {#if hubWeather}
          <div class="flex items-center gap-4 px-4 py-2 rounded-2xl bg-[#1A1A22] border border-[#2E2E3C] shrink-0">
            <div class="flex items-center gap-2">
              <Sun class="w-5 h-5 text-amber-400" />
              <div>
                <div class="text-base font-bold text-white font-mono">{hubWeather.temperature_2m ?? hubWeather.temp ?? 31}°C</div>
                <div class="text-[10px] text-zinc-400">{hubWeather.condition || 'Cuaca Normal'}</div>
              </div>
            </div>
            <div class="text-[11px] text-zinc-400 border-l border-zinc-700/60 pl-3">
              <div>Hujan: {hubWeather.precipitation_probability ?? hubWeather.rain_prob ?? 0}%</div>
              <div>Angin: {hubWeather.wind_speed_10m ?? hubWeather.wind ?? 10} km/h</div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {#each zones as zw}
          <div class="p-4 rounded-3xl bg-[#131317] border border-[#24242E] space-y-2.5 shadow-lg">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white truncate">{zw.name || 'Zona Operasional'}</span>
              <Sun class="w-4 h-4 text-amber-400" />
            </div>

            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-bold text-white font-mono">{zw.temp || 31}°C</span>
              <span class="text-xs text-zinc-400">{zw.condition || 'Cerah'}</span>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-[#22222A] text-[11px] text-zinc-400">
              <div class="flex items-center gap-1">
                <CloudRain class="w-3.5 h-3.5 text-sky-400" />
                <span>Hujan: {zw.rain_prob || 10}%</span>
              </div>
              <div class="flex items-center gap-1">
                <Wind class="w-3.5 h-3.5 text-teal-400" />
                <span>Angin: {zw.wind || 12}km/h</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- SECTION 2: Katalog POI Overpass OSM -->
  <div class="p-5 rounded-3xl bg-[#131317] border border-[#24242E] space-y-4 shadow-xl">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#24242E]">
      <div class="flex items-center gap-2">
        <Building class="w-4 h-4 text-sky-400" />
        <h3 class="text-sm font-bold text-white">Katalog Titik Keramaian (POI)</h3>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
          {filteredPois.length} Titik
        </span>
      </div>

      <!-- Filter & Search Controls -->
      <div class="flex items-center gap-2">
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Cari nama tempat..."
            class="pl-8 pr-3 py-1.5 rounded-xl bg-[#1A1A22] border border-[#2E2E3C] text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-sky-500 w-48"
          />
        </div>

        <select
          bind:value={selectedCategory}
          class="p-1.5 rounded-xl bg-[#1A1A22] border border-[#2E2E3C] text-white text-xs focus:outline-none focus:border-sky-500"
        >
          <option value="ALL">Semua Kategori</option>
          <option value="MALL">Mall & Pusat Belanja</option>
          <option value="CAMPUS">Kampus & Universitas</option>
          <option value="TRANSIT">Stasiun / Terminal</option>
          <option value="OFFICE">Perkantoran</option>
          <option value="PARK">Taman Kota</option>
          <option value="TOURISM">Pariwisata & Hiburan</option>
          <option value="HEALTHCARE">Fasilitas Kesehatan</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs text-zinc-300">
        <thead class="text-[10px] font-bold uppercase text-zinc-400 border-b border-[#22222A] bg-[#16161D]">
          <tr>
            <th class="p-3">Nama Tempat (POI)</th>
            <th class="p-3">Kategori</th>
            <th class="p-3">Status Zona Operasional</th>
            <th class="p-3">Koordinat GPS</th>
            <th class="p-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#202028]">
          {#if filteredPois.length === 0}
            <tr>
              <td colspan="5" class="p-8 text-center text-zinc-500">
                {loading ? 'Memuat data POI...' : 'Tidak ada titik POI yang sesuai dengan filter.'}
              </td>
            </tr>
          {:else}
            {#each filteredPois as poi}
              <tr class="hover:bg-[#181822] transition-colors">
                <td class="p-3 font-bold text-white flex items-center gap-2">
                  <MapPin class="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>{poi.name}</span>
                </td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                    {poi.category}
                  </span>
                </td>
                <td class="p-3">
                  {#if poi.zone_name}
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-500/15 text-teal-300 border border-teal-500/30">
                      {poi.zone_name}
                    </span>
                  {:else}
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                      Belum Terzonasi (Unassigned)
                    </span>
                  {/if}
                </td>
                <td class="p-3 font-mono text-[11px] text-zinc-400">
                  {(poi.latitude ?? poi.lat)?.toFixed(4)}, {(poi.longitude ?? poi.lon)?.toFixed(4)}
                </td>
                <td class="p-3 text-right">
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg bg-[#22222E] hover:bg-[#2A2A38] text-zinc-300 text-[11px] font-bold transition-all cursor-pointer"
                  >
                    Detail
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
