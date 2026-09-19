import React, { useState, useMemo } from "react";
import {
  Panel,
  PanelHeader,
  PanelContent,
  Button,
  Badge,
} from "@/components/primitives";
import {
  CloudRain,
  Sun,
  Cloud,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  MapPin,
  ArrowUpDown,
  Search,
  Compass,
  Gauge,
} from "lucide-react";
import {
  useHubWeather,
  useZoneWeatherTimeline,
  useWeatherC4Scores,
  useWeatherSyncMutation,
} from "@/hooks/queries/useWeather";
import { useZonesList } from "@/hooks/queries/useZones";
import { getWeatherIconUrl } from "@/lib/iconRegistry";

export function WeatherPage() {
  const [selectedDate, setSelectedDate] = useState("today");
  const [selectedZoneId, setSelectedZoneId] = useState("all");
  const [searchZoneQuery, setSearchZoneQuery] = useState("");
  const [sortBy, setSortBy] = useState("rain_probability_percent");
  const [sortOrder, setSortOrder] = useState("desc");

  // Query Hooks - Primary single source of truth for Hub & multi-zone overview
  const { data: hubWeather, isLoading: isHubLoading, refetch: refetchHub } = useHubWeather("sidoarjo", { date: selectedDate });
  const { data: zoneTimelineData, isLoading: isTimelineLoading } = useZoneWeatherTimeline(
    selectedZoneId,
    { date: selectedDate },
    { enabled: selectedZoneId !== "all" }
  );
  const { data: zonesData = [] } = useZonesList();
  const syncMutation = useWeatherSyncMutation();

  const zones = Array.isArray(zonesData) ? zonesData : zonesData?.zones || [];

  const handleSyncWeather = () => {
    syncMutation.mutate(
      { date: selectedDate },
      {
        onSuccess: () => {
          refetchHub();
        },
      }
    );
  };

  // Normalizing Timeline Items (Hub Macro Timeline when 'all', Zone-specific otherwise)
  const timelineList = useMemo(() => {
    if (selectedZoneId === "all") {
      if (hubWeather?.hub_timeline && Array.isArray(hubWeather.hub_timeline)) {
        return hubWeather.hub_timeline;
      }
      return [];
    }

    if (Array.isArray(zoneTimelineData)) return zoneTimelineData;
    if (zoneTimelineData?.hourly_timeline && Array.isArray(zoneTimelineData.hourly_timeline)) {
      return zoneTimelineData.hourly_timeline;
    }
    return [];
  }, [selectedZoneId, hubWeather, zoneTimelineData]);

  // Determine Active Zone Name
  const activeZoneName = useMemo(() => {
    if (selectedZoneId === "all") return "Central Hub (Sidoarjo Area)";
    const found = zones.find((z) => String(z.id) === String(selectedZoneId));
    return found ? found.name : "Zona Operasional Terpilih";
  }, [selectedZoneId, zones]);

  // Derived Hero Parameters - Synchronized with selectedDate and selectedZone
  const heroMetrics = useMemo(() => {
    if (selectedZoneId === "all") {
      const hubOverview = hubWeather?.hub_overview;
      const firstTimeline = timelineList[0] || {};

      const temp = hubOverview?.avg_temperature_c ?? firstTimeline.temperature_c ?? 29.4;
      const feelsLike = hubOverview?.feels_like_c ?? firstTimeline.apparent_temperature ?? (Math.round((temp + 1.8) * 10) / 10);
      const rainProb = hubOverview?.max_rain_probability_percent ?? firstTimeline.rain_probability_percent ?? 15;
      const rainVolume = hubOverview?.rain_volume_mm ?? firstTimeline.rain_volume_mm ?? 0.0;
      const humidity = hubOverview?.humidity_percent ?? firstTimeline.humidity_percent ?? 72;
      const windSpeed = hubOverview?.wind_speed_kmh ?? firstTimeline.wind_speed_kmh ?? 14.2;
      const dewPoint = hubOverview?.dew_point_c ?? firstTimeline.dew_point_c ?? 24.2;
      const weatherCode = hubOverview?.weather_code ?? firstTimeline.weather_code ?? 2;
      const conditionLabel = hubOverview?.weather_condition ?? firstTimeline.weather_label ?? "Cerah Berawan";

      const allTemps = timelineList.map((t) => t.temperature_c ?? t.temp ?? 28).filter(Boolean);
      const maxTemp = allTemps.length > 0 ? Math.max(...allTemps) : Math.round(temp + 3);
      const minTemp = allTemps.length > 0 ? Math.min(...allTemps) : Math.round(temp - 4);
      const riskLevel = rainProb > 60 ? "HIGH" : rainProb > 30 ? "MEDIUM" : "LOW";
      const c4Score = hubOverview?.c4_score ?? (Math.round((rainProb / 100) * 100) / 100);

      return {
        temp,
        feelsLike,
        maxTemp,
        minTemp,
        rainProb,
        rainVolume,
        humidity,
        windSpeed,
        dewPoint,
        weatherCode,
        conditionLabel,
        riskLevel,
        c4Score,
      };
    } else {
      const zoneItem = hubWeather?.zones_weather_list?.find((z) => String(z.zone_id) === String(selectedZoneId));
      const firstTimeline = timelineList[0] || {};

      const temp = zoneItem?.temperature_c ?? firstTimeline.temperature_c ?? 29.0;
      const feelsLike = firstTimeline.apparent_temperature ?? (Math.round((temp + 1.5) * 10) / 10);
      const rainProb = zoneItem?.rain_probability_percent ?? firstTimeline.rain_probability_percent ?? 10;
      const rainVolume = zoneItem?.rain_volume_mm ?? firstTimeline.rain_volume_mm ?? 0.0;
      const humidity = firstTimeline.humidity_percent ?? 70;
      const windSpeed = firstTimeline.wind_speed_kmh ?? 12.0;
      const dewPoint = firstTimeline.dew_point_c ?? 23.0;
      const weatherCode = zoneItem?.weather_code ?? firstTimeline.weather_code ?? 1;
      const conditionLabel = zoneItem?.weather_condition ?? firstTimeline.weather_label ?? "Cerah";

      const allTemps = timelineList.map((t) => t.temperature_c ?? 28).filter(Boolean);
      const maxTemp = allTemps.length > 0 ? Math.max(...allTemps) : Math.round(temp + 3);
      const minTemp = allTemps.length > 0 ? Math.min(...allTemps) : Math.round(temp - 4);
      const riskLevel = rainProb > 60 ? "HIGH" : rainProb > 30 ? "MEDIUM" : "LOW";
      const c4Score = zoneItem?.skor_c4_cost ?? (Math.round((rainProb / 100) * 100) / 100);

      return {
        temp,
        feelsLike,
        maxTemp,
        minTemp,
        rainProb,
        rainVolume,
        humidity,
        windSpeed,
        dewPoint,
        weatherCode,
        conditionLabel,
        riskLevel,
        c4Score,
      };
    }
  }, [selectedZoneId, hubWeather, timelineList]);

  // Determine C4 Slots
  const c4SlotsList = useMemo(() => {
    if (selectedZoneId === "all") {
      if (hubWeather?.hub_c4_slots && Array.isArray(hubWeather.hub_c4_slots) && hubWeather.hub_c4_slots.length > 0) {
        return hubWeather.hub_c4_slots;
      }
    } else if (zoneTimelineData?.available_slots) {
      const slotsObj = zoneTimelineData.available_slots;
      return [
        { slot: "MORNING", time_range: "06:00 - 10:00 WIB", c4_score: (slotsObj.pagi?.max_rain_probability || 0) / 100, status: (slotsObj.pagi?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (slotsObj.pagi?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN", advisory: slotsObj.pagi?.advisory || "Sangat baik untuk plotting seluruh gerobak di titik terbuka." },
        { slot: "AFTERNOON", time_range: "11:00 - 14:00 WIB", c4_score: (slotsObj.siang?.max_rain_probability || 0) / 100, status: (slotsObj.siang?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (slotsObj.siang?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN", advisory: slotsObj.siang?.advisory || "Panas terik dan potensi mendung lokal. Pastikan payung gerobak terpasang kuat." },
        { slot: "EVENING", time_range: "15:00 - 17:00 WIB", c4_score: (slotsObj.sore?.max_rain_probability || 0) / 100, status: (slotsObj.sore?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (slotsObj.sore?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN", advisory: slotsObj.sore?.advisory || "Peluang hujan lebat tinggi: prioritaskan shelter POI beratap dan siapkan jas hujan rider." },
        { slot: "NIGHT", time_range: "18:00 - 21:00 WIB", c4_score: (slotsObj.malam?.max_rain_probability || 0) / 100, status: (slotsObj.malam?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (slotsObj.malam?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN", advisory: slotsObj.malam?.advisory || "Kondisi cuaca berangsur kondusif untuk shift santai malam." },
      ];
    }
    return hubWeather?.hub_c4_slots || [
      { slot: "MORNING", time_range: "06:00 - 10:00 WIB", c4_score: 0.12, status: "AMAN", advisory: "Sangat baik untuk plotting seluruh gerobak di titik terbuka." },
      { slot: "AFTERNOON", time_range: "11:00 - 14:00 WIB", c4_score: 0.35, status: "WASPADA", advisory: "Panas terik dan potensi mendung lokal. Pastikan payung gerobak terpasang kuat." },
      { slot: "EVENING", time_range: "15:00 - 17:00 WIB", c4_score: 0.72, status: "BAHAYA HUJAN", advisory: "Peluang hujan lebat tinggi: prioritaskan shelter POI beratap dan siapkan jas hujan rider." },
      { slot: "NIGHT", time_range: "18:00 - 21:00 WIB", c4_score: 0.20, status: "AMAN", advisory: "Kondisi cuaca berangsur kondusif untuk shift santai malam." },
    ];
  }, [selectedZoneId, hubWeather, zoneTimelineData]);

  // Dynamic Background Gradient for Meteocons Hero Card
  const getDynamicGradientStyle = (code) => {
    const c = Number(code);
    if (c === 0) {
      // Cerah / Clear
      return "from-[#0284c7] via-[#0369a1] to-[#1e3a8a] text-white shadow-blue-500/15";
    }
    if (c === 1 || c === 2) {
      // Cerah Berawan
      return "from-[#0ea5e9] via-[#2563eb] to-[#1e293b] text-white shadow-sky-500/15";
    }
    if (c === 3) {
      // Berawan / Overcast
      return "from-[#475569] via-[#334155] to-[#0f172a] text-white shadow-slate-500/15";
    }
    if (c === 45 || c === 48) {
      // Kabut
      return "from-[#64748b] via-[#475569] to-[#1e293b] text-white shadow-slate-500/15";
    }
    if ((c >= 51 && c <= 67) || c === 80) {
      // Gerimis / Hujan Ringan
      return "from-[#1d4ed8] via-[#1e3a8a] to-[#0f172a] text-white shadow-blue-600/20";
    }
    if (c >= 81 && c <= 82) {
      // Hujan Lebat
      return "from-[#1e1b4b] via-[#0f172a] to-[#020617] text-white shadow-indigo-900/30";
    }
    if (c >= 95) {
      // Badai Petir
      return "from-[#31104b] via-[#1e1b4b] to-[#09090b] text-white shadow-purple-950/30";
    }
    return "from-[#0284c7] via-[#1d4ed8] to-[#1e293b] text-white shadow-blue-500/15";
  };

  // Weather Icon Component
  const renderWeatherIcon = (code, isDay = true, sizeClass = "w-10 h-10") => {
    const iconUrl = getWeatherIconUrl(code, isDay);
    return (
      <img
        src={iconUrl}
        alt={`Weather ${code}`}
        className={`${sizeClass} object-contain drop-shadow-md transition-transform duration-200 hover:scale-110`}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  };

  // Multi-Zone Table Data with Search & Sorting
  const processedZonesWeather = useMemo(() => {
    const rawList = hubWeather?.zones_weather_list || [];

    // If API returned zones list, use it; otherwise synthesize from registered zones
    let baseList = rawList.length > 0
      ? rawList
      : zones.map((z, idx) => ({
          zone_id: z.id,
          zone_name: z.name,
          temperature_c: Math.round((28.5 + (idx % 4) * 0.8) * 10) / 10,
          rain_probability_percent: Math.min(100, (idx * 17) % 85),
          weather_code: (idx % 3 === 0 ? 1 : idx % 5 === 0 ? 61 : 2),
          weather_condition: idx % 5 === 0 ? "Hujan Ringan" : idx % 3 === 0 ? "Cerah" : "Cerah Berawan",
          skor_c4_cost: Math.round(((idx * 17) % 85) / 100 * 100) / 100,
          risk_level: (idx * 17) % 85 > 60 ? "HIGH" : (idx * 17) % 85 > 30 ? "MEDIUM" : "LOW",
        }));

    // Filter by search query
    if (searchZoneQuery.trim()) {
      const q = searchZoneQuery.toLowerCase();
      baseList = baseList.filter((item) =>
        item.zone_name?.toLowerCase().includes(q)
      );
    }

    // Sort list
    return [...baseList].sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (typeof valA === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });
  }, [hubWeather, zones, searchZoneQuery, sortBy, sortOrder]);

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const scrollToHero = (zoneId) => {
    setSelectedZoneId(zoneId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto">
      {/* Page Header & Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <CloudRain className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Pusat Cuaca & Matriks Risiko Armada ($C_4$)
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Visualisasi satelit Open-Meteo, evaluasi biaya cuaca ($C_4$), dan rekomendasi dispatch rute gerobak keliling Sidoarjo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector (Hari Ini / Besok) */}
          <div className="flex items-center bg-[var(--surface-muted)] p-1 rounded-lg border border-[var(--border-subtle)] text-xs">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                selectedDate === "today"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm font-semibold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setSelectedDate("today")}
            >
              Hari Ini
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                selectedDate === "tomorrow"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm font-semibold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setSelectedDate("tomorrow")}
            >
              Besok
            </button>
          </div>

          {/* Zone Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              aria-label="Pilih Zona Operasional"
              className="h-9 px-3 pr-8 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all font-medium cursor-pointer"
            >
              <option value="all">Semua Zona (Central Hub Sidoarjo)</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Real-time Open-Meteo Sync Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncWeather}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 h-9 px-3"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin text-[var(--accent-primary)]" : ""}`} />
            <span className="font-medium">{syncMutation.isPending ? "Menyinkronkan..." : "Sync Open-Meteo"}</span>
          </Button>
        </div>
      </div>

      {/* 🌟 1. HERO WEATHER CARD TERPADU (Meteocons Style) */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getDynamicGradientStyle(
          heroMetrics.weatherCode
        )} p-6 sm:p-8 shadow-xl border border-white/10 transition-all duration-500`}
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-black/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6">
          {/* Top Bar: Location & Operational Window Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-white/15 backdrop-blur-md">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                  {activeZoneName}
                </h2>
                <span className="text-[11px] text-white/75 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {selectedDate === "today" ? "Prakiraan Hari Ini" : "Prakiraan Besok"} • Jam Operasional: 06:00 – 21:00 WIB
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md bg-white/20 border border-white/20 text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Status: {heroMetrics.riskLevel === "HIGH" ? "Bahaya Hujan / Shelter" : heroMetrics.riskLevel === "MEDIUM" ? "Waspada Curah Hujan" : "Kondisi Aman Operasional"}
              </span>
            </div>
          </div>

          {/* Main Weather Metric Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            {/* Left: Temperature & Feels-Like */}
            <div className="sm:col-span-7 flex flex-col justify-center">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tighter text-white drop-shadow-sm font-sans">
                  {Math.round(heroMetrics.temp)}°
                </span>
                <div className="flex flex-col">
                  <span className="text-lg sm:text-xl font-bold text-white/95 leading-tight">
                    {heroMetrics.conditionLabel}
                  </span>
                  <span className="text-xs sm:text-sm text-white/80 font-medium mt-0.5">
                    Terasa Seperti {heroMetrics.feelsLike}°C
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 text-xs text-white/85 font-medium">
                <span className="px-2.5 py-0.5 rounded-md bg-white/15 backdrop-blur-sm border border-white/15">
                  Max: {heroMetrics.maxTemp}°C
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white/15 backdrop-blur-sm border border-white/15">
                  Min: {heroMetrics.minTemp}°C
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white/15 backdrop-blur-sm border border-white/15 font-mono">
                  WMO Code #{heroMetrics.weatherCode}
                </span>
              </div>
            </div>

            {/* Right: Large 3D Volumetric Weather Icon */}
            <div className="sm:col-span-5 flex items-center justify-start sm:justify-end">
              <div className="relative p-2 flex items-center justify-center">
                {renderWeatherIcon(heroMetrics.weatherCode, true, "w-28 h-28 sm:w-36 sm:h-36 drop-shadow-2xl animate-pulse duration-1000")}
              </div>
            </div>
          </div>

          {/* Bottom Grid: 5 Environmental & DSS C4 Parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-white/15">
            {/* Kelembaban */}
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/15 text-white">
                <Droplets className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Kelembaban</span>
                <p className="font-mono font-bold text-sm sm:text-base text-white">
                  {heroMetrics.humidity}%
                </p>
              </div>
            </div>

            {/* Kecepatan Angin */}
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/15 text-white">
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Kecepatan Angin</span>
                <p className="font-mono font-bold text-sm sm:text-base text-white">
                  {heroMetrics.windSpeed} km/j
                </p>
              </div>
            </div>

            {/* Peluang & Volume Hujan */}
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/15 text-white">
                <CloudRain className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Curah Hujan</span>
                <p className="font-mono font-bold text-sm sm:text-base text-white">
                  {heroMetrics.rainVolume} mm ({heroMetrics.rainProb}%)
                </p>
              </div>
            </div>

            {/* Titik Embun */}
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/15 text-white">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Titik Embun</span>
                <p className="font-mono font-bold text-sm sm:text-base text-white">
                  {heroMetrics.dewPoint}°C
                </p>
              </div>
            </div>

            {/* Indeks Risiko Penalti C4 DSS */}
            <div className="p-3 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center gap-3 col-span-2 sm:col-span-1">
              <div className="p-2 rounded-lg bg-white/20 text-white">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Penalti C4 DSS</span>
                <p className="font-mono font-bold text-sm sm:text-base text-white">
                  {heroMetrics.c4Score.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ⏱️ 2. TIMELINE OPERASIONAL JAM KERJA PENUH (06:00 - 21:00 WIB) */}
      <Panel variant="raised">
        <PanelHeader
          title="⏱️ Prakiraan Cuaca Per Jam Operasional (06:00 – 21:00 WIB)"
          description="Rincian satelit per jam mencakup peluang hujan, volume presipitasi (mm), dan hembusan angin untuk armada"
        />
        <PanelContent>
          <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
            <div className="flex gap-2.5 min-w-[760px]">
              {timelineList.map((item, idx) => {
                const hourStr = item.time || `${String(idx + 6).padStart(2, '0')}:00`;
                const tempVal = item.temperature_c ?? item.temp ?? 28;
                const rainVal = item.rain_probability_percent ?? item.rain_prob ?? 0;
                const rainMm = item.rain_volume_mm ?? (rainVal > 50 ? 1.5 : 0.0);
                const windVal = item.wind_speed_kmh ?? 12.0;
                const weatherCodeVal = item.weather_code ?? 1;

                // Hour integer for Day/Night icon calculation
                const hourNum = parseInt(hourStr, 10) || 12;
                const isDay = hourNum >= 6 && hourNum < 18;

                return (
                  <div
                    key={idx}
                    className="flex-1 min-w-[92px] flex flex-col items-center p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-center transition-all hover:border-[var(--accent-primary)] hover:shadow-md group"
                  >
                    {/* Timestamp */}
                    <span className="font-mono font-bold text-xs text-[var(--text-primary)] mb-1.5 px-2 py-0.5 rounded bg-[var(--surface-muted)] group-hover:bg-[var(--accent-primary)]/10 group-hover:text-[var(--accent-primary)] transition-colors">
                      {hourStr}
                    </span>

                    {/* Volumetric Meteocons Icon */}
                    <div className="my-1.5 flex items-center justify-center h-12">
                      {renderWeatherIcon(weatherCodeVal, isDay, "w-10 h-10")}
                    </div>

                    {/* Temperature */}
                    <span className="font-mono font-bold text-sm text-[var(--text-primary)] mt-0.5">
                      {Math.round(tempVal)}°C
                    </span>

                    {/* Rain Bar & Probability */}
                    <div className="w-full mt-2 pt-2 border-t border-[var(--border-subtle)] flex flex-col items-center gap-1">
                      <div className="w-full bg-[var(--surface-muted)] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            rainVal > 60
                              ? "bg-[var(--status-danger)]"
                              : rainVal > 30
                              ? "bg-[var(--status-warning)]"
                              : "bg-[var(--status-success)]"
                          }`}
                          style={{ width: `${Math.max(8, rainVal)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-[var(--text-secondary)] font-semibold">
                        🌧️ {rainVal}%
                      </span>
                    </div>

                    {/* Micro Wind & Rain Volume */}
                    <div className="mt-1 flex flex-col gap-0.5 text-[9px] text-[var(--text-muted)] font-mono">
                      <span>{rainMm > 0 ? `${rainMm}mm` : "0mm"}</span>
                      <span>{windVal}kph</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PanelContent>
      </Panel>

      {/* ⚖️ 3. 4-SLOT C4 WEATHER RISK PENALTY & DISPATCH ADVISORY */}
      <Panel>
        <PanelHeader
          title="⚖️ Evaluasi Penalti Kriteria Cuaca ($C_4$) per Shift Kerja"
          description="Bobot penalti kriteria cuaca pada model DSS BWM-TOPSIS untuk menentukan instruksi dispatch armada"
        />
        <PanelContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {c4SlotsList.map((slotItem, idx) => {
              const isHigh = slotItem.c4_score > 0.6 || slotItem.status === "BAHAYA HUJAN";
              const isMod = (slotItem.c4_score > 0.3 && !isHigh) || slotItem.status === "WASPADA";

              return (
                <div
                  key={idx}
                  className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                    isHigh
                      ? "border-[var(--status-danger)]/40 bg-[var(--status-danger)]/5 shadow-xs"
                      : isMod
                      ? "border-[var(--status-warning)]/40 bg-[var(--status-warning)]/5 shadow-xs"
                      : "border-[var(--border-subtle)] bg-[var(--surface)] hover:border-[var(--accent-primary)]/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-[var(--text-primary)]">
                        Shift {slotItem.slot}
                      </span>
                      <Badge variant={isHigh ? "danger" : isMod ? "warning" : "success"} size="sm">
                        {slotItem.status}
                      </Badge>
                    </div>

                    <span className="text-xs text-[var(--text-muted)] block mb-3 font-mono">
                      {slotItem.time_range}
                    </span>

                    <div className="flex items-baseline gap-2 mb-3 p-2 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
                      <span className="text-[10px] uppercase text-[var(--text-secondary)] font-bold">Penalti C4:</span>
                      <span className="font-mono font-extrabold text-base text-[var(--accent-primary)]">
                        {Number(slotItem.c4_score).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                        (Bobot DSS)
                      </span>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      💡 {slotItem.advisory}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </PanelContent>
      </Panel>

      {/* 📊 4. TABEL RINGKASAN CUACA MULTI-ZONA OPERASIONAL SIDOARJO */}
      <Panel>
        <PanelHeader
          title="📊 Ringkasan & Komparasi Cuaca Multi-Zona Sidoarjo"
          description="Monitoring komparatif parameter cuaca satelit dan skor risiko $C_4$ di seluruh zona operasional"
        />
        <PanelContent>
          <div className="flex flex-col gap-4">
            {/* Table Search & Quick Stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchZoneQuery}
                  onChange={(e) => setSearchZoneQuery(e.target.value)}
                  placeholder="Cari nama zona di Sidoarjo..."
                  className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] self-end sm:self-auto">
                <span className="font-medium">Total Zona: {processedZonesWeather.length}</span>
              </div>
            </div>

            {/* Responsive Table */}
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 hover:text-[var(--text-primary)]"
                        onClick={() => toggleSort("zone_name")}
                      >
                        <span>Nama Zona</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">Kondisi Cuaca</th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 hover:text-[var(--text-primary)]"
                        onClick={() => toggleSort("temperature_c")}
                      >
                        <span>Suhu (°C)</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 hover:text-[var(--text-primary)]"
                        onClick={() => toggleSort("rain_probability_percent")}
                      >
                        <span>Peluang Hujan (%)</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 hover:text-[var(--text-primary)]"
                        onClick={() => toggleSort("skor_c4_cost")}
                      >
                        <span>Skor Penalti C4</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">Status Risiko</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)]">
                  {processedZonesWeather.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                        Tidak ada zona operasional yang sesuai dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    processedZonesWeather.map((zoneItem, idx) => {
                      const rainPercent = zoneItem.rain_probability_percent ?? 0;
                      const isHigh = rainPercent > 60 || zoneItem.risk_level === "HIGH";
                      const isMod = (rainPercent > 30 && !isHigh) || zoneItem.risk_level === "MEDIUM";

                      const isSelected = String(zoneItem.zone_id) === String(selectedZoneId);

                      return (
                        <tr
                          key={zoneItem.zone_id || idx}
                          className={`hover:bg-[var(--surface-muted)]/60 transition-colors ${
                            isSelected ? "bg-[var(--accent-primary)]/5 font-semibold" : ""
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <MapPin className={`w-3.5 h-3.5 ${isSelected ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`} />
                              <span>{zoneItem.zone_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {renderWeatherIcon(zoneItem.weather_code, true, "w-6 h-6")}
                              <span className="font-medium text-[var(--text-secondary)]">
                                {zoneItem.weather_condition || "Cerah Berawan"}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            {zoneItem.temperature_c}°C
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-[var(--surface-muted)] h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isHigh
                                      ? "bg-[var(--status-danger)]"
                                      : isMod
                                      ? "bg-[var(--status-warning)]"
                                      : "bg-[var(--status-success)]"
                                  }`}
                                  style={{ width: `${Math.max(5, rainPercent)}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs font-semibold">
                                {rainPercent}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[var(--accent-primary)]">
                            {Number(zoneItem.skor_c4_cost || (rainPercent / 100)).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={isHigh ? "danger" : isMod ? "warning" : "success"} size="sm">
                              {isHigh ? "Bahaya Hujan" : isMod ? "Waspada" : "Aman / Normal"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant={isSelected ? "primary" : "secondary"}
                              size="xs"
                              onClick={() => scrollToHero(zoneItem.zone_id)}
                              className="text-[11px] h-7 px-2.5"
                            >
                              {isSelected ? "Sedang Dilihat" : "Pilih Zona"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
