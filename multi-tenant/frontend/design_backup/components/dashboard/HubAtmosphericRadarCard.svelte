<script lang="ts">
  import { onMount } from 'svelte';
  import { mapService, type HubWeatherOverview } from '../../services/mapService';
  import { 
    Cloud, 
    Sun, 
    CloudRain, 
    Droplets, 
    Thermometer, 
    Eye, 
    Wind, 
    RefreshCw, 
    MapPin, 
    Clock, 
    ShieldCheck, 
    Sparkles 
  } from 'lucide-svelte';

  interface Props {
    onSyncRequest?: () => void;
  }

  let { onSyncRequest }: Props = $props();

  let loading = $state(true);
  let hubWeather = $state<HubWeatherOverview | null>(null);
  let zoneConfig = $state<any>(null);
  let syncing = $state(false);

  const loadData = async () => {
    loading = true;
    try {
      // 1. Ambil konfigurasi spasial & kota central hub
      const config = await mapService.getZoneConfig();
      zoneConfig = config;
      const targetCity = config?.hub_city_name || 'Sidoarjo';

      // 2. Ambil cuaca aktual hub dinamis
      const weather = await mapService.getHubWeather(targetCity);
      hubWeather = weather;
    } catch (err) {
      console.warn('Gagal memuat cuaca HUB:', err);
    } finally {
      loading = false;
    }
  };

  const handleSync = async () => {
    syncing = true;
    try {
      await mapService.syncWeather();
      await loadData();
      if (onSyncRequest) onSyncRequest();
    } catch (err) {
      console.error(err);
    } finally {
      syncing = false;
    }
  };

  onMount(() => {
    loadData();
  });
</script>

<div class="card-dark p-4 sm:p-5 rounded-3xl bg-[#131316] border border-[#24242A] shadow-xl space-y-4 font-outfit-400">
  <!-- Header: Hub Name & Sync Button -->
  <div class="flex items-center justify-between pb-3 border-b border-[#24242A]">
    <div class="flex items-center gap-2.5">
      <div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-[#FF634A] border border-[#FF634A]/30 flex items-center justify-center shadow-md">
        <Sun class="w-5 h-5" />
      </div>
      <div>
        <div class="flex items-center gap-1.5">
          <h4 class="text-sm font-outfit-600 text-white leading-none">
            Radar Cuaca & Parameter Atmosferik HUB
          </h4>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
            Open-Meteo Live
          </span>
        </div>
        <p class="text-[11px] text-[#A1A1AA] mt-1 leading-none flex items-center gap-1">
          <MapPin class="w-3 h-3 text-[#FF634A]" />
          <span>Central Hub: <strong class="text-zinc-200">{zoneConfig?.hub_city_name || 'Sidoarjo'}</strong> ({zoneConfig?.hub_latitude ? `${Number(zoneConfig.hub_latitude).toFixed(4)}, ${Number(zoneConfig.hub_longitude).toFixed(4)}` : '-7.3974, 112.7119'})</span>
        </p>
      </div>
    </div>

    <button
      type="button"
      onclick={handleSync}
      disabled={syncing}
      class="p-2 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A32] text-zinc-300 hover:text-white text-xs font-outfit-600 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
      title="Sinkronkan Cuaca dari Satelit Open-Meteo"
    >
      <RefreshCw class="w-3.5 h-3.5 text-[#FF634A] {syncing ? 'animate-spin' : ''}" />
      <span class="hidden sm:inline">{syncing ? 'Sinkronisasi...' : 'Update Cuaca'}</span>
    </button>
  </div>

  <!-- Atmospheric Weather Attributes Grid (from 'weathers' table) -->
  {#if loading}
    <div class="py-8 text-center text-xs text-[#71717A] animate-pulse">
      Memuat parameter atmosferik tabel weathers...
    </div>
  {:else if hubWeather}
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <!-- 1. Suhu Aktual & Terasa -->
      <div class="p-3 rounded-2xl bg-[#17171C] border border-[#26262E] space-y-1">
        <div class="flex items-center justify-between text-[10px] text-[#71717A] uppercase font-outfit-600">
          <span>Suhu Aktual</span>
          <Thermometer class="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div class="text-lg sm:text-xl font-outfit-600 text-white font-mono">
          {hubWeather.hub_overview.avg_temperature_c}°C
        </div>
        <span class="text-[10px] text-[#A1A1AA]">
          Terasa: {(hubWeather.hub_overview as any).apparent_temperature_c ?? hubWeather.hub_overview.avg_temperature_c}°C
        </span>
      </div>

      <!-- 2. Peluang Hujan (C4 Cost Criteria) -->
      <div class="p-3 rounded-2xl bg-[#17171C] border border-[#26262E] space-y-1">
        <div class="flex items-center justify-between text-[10px] text-[#71717A] uppercase font-outfit-600">
          <span>Peluang Hujan (C4)</span>
          <CloudRain class="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div class="text-lg sm:text-xl font-outfit-600 text-blue-400 font-mono">
          {hubWeather.hub_overview.max_rain_probability_percent}%
        </div>
        <span class="text-[10px] text-blue-400/80">
          Curah: {(hubWeather.hub_overview as any).precipitation_rain_mm ?? 0} mm
        </span>
      </div>

      <!-- 3. Kelembaban Relatif (relative_humidity_2m) -->
      <div class="p-3 rounded-2xl bg-[#17171C] border border-[#26262E] space-y-1">
        <div class="flex items-center justify-between text-[10px] text-[#71717A] uppercase font-outfit-600">
          <span>Kelembaban Udara</span>
          <Droplets class="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div class="text-lg sm:text-xl font-outfit-600 text-white font-mono">
          {(hubWeather.hub_overview as any).relative_humidity_2m ?? 65}%
        </div>
        <span class="text-[10px] text-[#A1A1AA]">
          Titik Embun: {(hubWeather.hub_overview as any).dew_point_2m ?? 23.4}°C
        </span>
      </div>

      <!-- 4. Kondisi Cuaca WMO (weather_code) -->
      <div class="p-3 rounded-2xl bg-[#17171C] border border-[#26262E] space-y-1">
        <div class="flex items-center justify-between text-[10px] text-[#71717A] uppercase font-outfit-600">
          <span>Kondisi Cuaca</span>
          <Cloud class="w-3.5 h-3.5 text-[#FF634A]" />
        </div>
        <div class="text-xs sm:text-sm font-outfit-600 text-[#FF634A] truncate">
          {hubWeather.hub_overview.weather_condition || 'Cerah Berawan'}
        </div>
        <span class="text-[10px] text-[#A1A1AA]">
          WMO Code: {hubWeather.hub_overview.weather_code}
        </span>
      </div>
    </div>

    <!-- Active Operational Window Banner -->
    <div class="p-2.5 rounded-2xl bg-[#1A1A22] border border-[#2E2E3C] flex flex-wrap items-center justify-between gap-2 text-xs text-[#A1A1AA]">
      <div class="flex items-center gap-2">
        <Clock class="w-4 h-4 text-[#FF634A]" />
        <span>Jam Operasional: <strong class="text-zinc-200">06:00 - 21:00 WIB</strong></span>
        <span class="text-zinc-600">•</span>
        <span>Slot Waktu Aktif: <strong class="text-[#FF634A] uppercase font-outfit-600">{hubWeather.hub_overview.active_time_slot}</strong></span>
      </div>
      <div class="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
        <ShieldCheck class="w-3.5 h-3.5" />
        <span>{hubWeather.total_zones} Zona Spasial Terpantau Aman</span>
      </div>
    </div>
  {/if}
</div>
