<script lang="ts">
  import { Cloud, X, Sun, CloudRain, Droplets, RefreshCw } from 'lucide-svelte';
  import type { HubWeatherOverview } from '../../../services/mapService';

  interface Props {
    weatherData: HubWeatherOverview | null;
    syncingWeather: boolean;
    hubCityName?: string;
    onClose: () => void;
    onSyncWeather: () => void;
  }

  let {
    weatherData,
    syncingWeather,
    hubCityName = 'Operasional',
    onClose,
    onSyncWeather,
  }: Props = $props();
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between border-b border-[#24242A] pb-2">
    <div class="flex items-center gap-2">
      <Cloud class="w-4 h-4 text-sky-400" />
      <div>
        <h4 class="text-xs font-extrabold text-white">Radar Cuaca HUB {hubCityName}</h4>
        <span class="text-[10px] text-[#8E8E93]">Open-Meteo Satelit Real-Time</span>
      </div>
    </div>
    <button onclick={onClose} class="text-[#71717A] hover:text-white cursor-pointer p-0.5" aria-label="Tutup radar cuaca">
      <X class="w-4 h-4" />
    </button>
  </div>

  <!-- 4 Grid Parameter Atmosferik -->
  <div class="grid grid-cols-2 gap-2 text-xs">
    <!-- 1. Suhu Udara -->
    <div class="p-2.5 bg-[#18181D] rounded-xl border border-[#24242A] space-y-1">
      <span class="text-[10px] text-[#71717A] uppercase font-bold flex items-center justify-between">
        <span>Suhu Udara</span>
        <Sun class="w-3 h-3 text-amber-400" />
      </span>
      <div class="text-lg font-bold text-white font-mono">
        {weatherData?.hub_overview?.avg_temperature_c ?? 30.5}°C
      </div>
      <span class="text-[9px] text-[#A1A1AA] block">
        Terasa: {(weatherData?.hub_overview as any)?.apparent_temperature_c ?? 32}°C
      </span>
    </div>

    <!-- 2. Peluang Hujan (C4 Cost) -->
    <div class="p-2.5 bg-[#18181D] rounded-xl border border-[#24242A] space-y-1">
      <span class="text-[10px] text-[#71717A] uppercase font-bold flex items-center justify-between">
        <span>Peluang Hujan (C4)</span>
        <CloudRain class="w-3 h-3 text-blue-400" />
      </span>
      <div class="text-lg font-bold text-blue-400 font-mono">
        {weatherData?.hub_overview?.max_rain_probability_percent ?? 0}%
      </div>
      <span class="text-[9px] text-blue-400/80 block">
        Curah: {(weatherData?.hub_overview as any)?.precipitation_rain_mm ?? 0} mm
      </span>
    </div>

    <!-- 3. Kelembaban -->
    <div class="p-2.5 bg-[#18181D] rounded-xl border border-[#24242A] space-y-1">
      <span class="text-[10px] text-[#71717A] uppercase font-bold flex items-center justify-between">
        <span>Kelembaban Udara</span>
        <Droplets class="w-3 h-3 text-cyan-400" />
      </span>
      <div class="text-lg font-bold text-white font-mono">
        {(weatherData?.hub_overview as any)?.relative_humidity_2m ?? 65}%
      </div>
      <span class="text-[9px] text-[#A1A1AA] block">
        Titik Embun: {(weatherData?.hub_overview as any)?.dew_point_2m ?? 23.4}°C
      </span>
    </div>

    <!-- 4. Kondisi Cuaca WMO -->
    <div class="p-2.5 bg-[#18181D] rounded-xl border border-[#24242A] space-y-1">
      <span class="text-[10px] text-[#71717A] uppercase font-bold flex items-center justify-between">
        <span>Kondisi WMO</span>
        <Cloud class="w-3 h-3 text-[#FF634A]" />
      </span>
      <div class="text-xs font-bold text-[#FF634A] truncate">
        {weatherData?.hub_overview?.weather_condition ?? 'Cerah Berawan'}
      </div>
      <span class="text-[9px] text-[#A1A1AA] block">
        Kode WMO: {weatherData?.hub_overview?.weather_code ?? 2}
      </span>
    </div>
  </div>

  <!-- Daftar Cuaca per Zona Spasial -->
  {#if weatherData?.zones_weather_list && weatherData.zones_weather_list.length > 0}
    <div class="space-y-1.5 pt-2 border-t border-[#24242A]">
      <span class="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block">
        Skor Cuaca C4 per Zona ({weatherData.zones_weather_list.length})
      </span>
      <div class="space-y-1 max-h-40 overflow-y-auto pr-1">
        {#each weatherData.zones_weather_list as zw}
          <div class="p-2 rounded-xl bg-[#18181D] border border-[#24242A] flex items-center justify-between text-xs">
            <div>
              <strong class="text-zinc-200 block text-[11px]">{zw.zone_name}</strong>
              <span class="text-[10px] text-[#71717A]">{zw.weather_condition} • {zw.temperature_c}°C</span>
            </div>
            <div class="text-right">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold {zw.rain_probability_percent > 50 ? 'bg-rose-950 text-rose-400' : 'bg-blue-950 text-blue-400'}">
                C4: {zw.rain_probability_percent}%
              </span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Sync Action Button -->
  <button
    onclick={onSyncWeather}
    disabled={syncingWeather}
    class="w-full py-2 bg-[#262630] hover:bg-[#323240] text-white rounded-xl text-xs font-outfit-600 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
  >
    <RefreshCw class="w-3.5 h-3.5 {syncingWeather ? 'animate-spin' : ''}" />
    <span>{syncingWeather ? 'Menyinkronkan...' : 'Sinkronkan Cuaca Open-Meteo'}</span>
  </button>
</div>
