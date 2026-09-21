import React, { useState, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  useHubWeather,
  useZoneWeatherTimeline,
  useWeatherC4Scores,
  useWeatherSyncMutation,
} from "@/hooks/queries/useWeather";
import { useZonesList } from "@/hooks/queries/useZones";
import { getWeatherIconUrl } from "@/lib/iconRegistry";

/**
 * Interactive Dual-Axis SVG Chart for Hourly Forecast (06:00 – 21:00 WIB)
 * - Curve: Temperature (°C)
 * - Bars/Area: Rain Probability (%)
 * - Current Hour Indicator: Glowing vertical line, pulsing node, and 'Saat Ini' badge
 * - Interactive Crosshair & Detailed Floating Tooltip on hover
 */
function HourlyWeatherChart({ timelineList, isToday = true }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const containerRef = useRef(null);

  // Normalize operational timeline 06:00 - 21:00 (16 hourly points)
  const chartData = useMemo(() => {
    if (!timelineList || timelineList.length === 0) {
      return Array.from({ length: 16 }, (_, i) => {
        const hour = i + 6;
        return {
          time: `${String(hour).padStart(2, "0")}:00`,
          temp: 28 + (i % 5) * 1.5,
          feels_like: 29 + (i % 5) * 1.6,
          rain_prob: (i * 13) % 70,
          rain_mm: (i * 13) % 70 > 50 ? 1.5 : 0.0,
          wind_speed: 10 + (i % 4) * 2,
          dew_point: 22 + (i % 3),
          weather_code: (i * 13) % 70 > 50 ? 61 : i % 3 === 0 ? 1 : 2,
          weather_label: (i * 13) % 70 > 50 ? "Hujan Ringan" : i % 3 === 0 ? "Cerah" : "Cerah Berawan",
        };
      });
    }

    return timelineList.map((item, idx) => {
      const hourStr = item.time || `${String(idx + 6).padStart(2, "0")}:00`;
      const tempVal = item.temperature_c ?? item.temp ?? 28;
      const rainVal = item.rain_probability_percent ?? item.rain_prob ?? 0;
      const rainMm = item.rain_volume_mm ?? (rainVal > 50 ? 1.5 : 0.0);
      const windVal = item.wind_speed_kmh ?? 12.0;
      const feelsVal = item.apparent_temperature ?? (Math.round((tempVal + 1.5) * 10) / 10);
      const dewVal = item.dew_point_c ?? 23.0;
      const codeVal = item.weather_code ?? 1;
      const labelVal = item.weather_label || item.weather_condition || "Cerah Berawan";

      return {
        time: hourStr,
        temp: Number(tempVal),
        feels_like: Number(feelsVal),
        rain_prob: Number(rainVal),
        rain_mm: Number(rainMm),
        wind_speed: Number(windVal),
        dew_point: Number(dewVal),
        weather_code: codeVal,
        weather_label: labelVal,
      };
    });
  }, [timelineList]);

  // Current system/local hour calculation
  const currentHour = useMemo(() => {
    return new Date().getHours();
  }, []);

  // Determine active current hour index within operational range (06:00 - 21:00)
  const currentHourIndex = useMemo(() => {
    if (!isToday) return null;
    const hourPrefix = `${String(currentHour).padStart(2, "0")}:00`;
    const foundIdx = chartData.findIndex((d) => d.time === hourPrefix);
    return foundIdx !== -1 ? foundIdx : null;
  }, [isToday, currentHour, chartData]);

  // Chart dimensions & scaling
  const width = 940;
  const height = 245;
  const padding = { top: 32, right: 48, bottom: 42, left: 48 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const temps = chartData.map((d) => d.temp);
  const minTemp = Math.floor(Math.min(...temps, 24) - 2);
  const maxTemp = Math.ceil(Math.max(...temps, 36) + 2);

  const getX = (index) => padding.left + (index / Math.max(1, chartData.length - 1)) * plotWidth;
  const getYTemp = (temp) =>
    padding.top + plotHeight - ((temp - minTemp) / (maxTemp - minTemp || 1)) * plotHeight;
  const getYRain = (prob) =>
    padding.top + plotHeight - (Math.min(100, Math.max(0, prob)) / 100) * (plotHeight * 0.75);

  // Generate Smooth Bezier Line for Temperature
  const tempPathData = useMemo(() => {
    if (chartData.length === 0) return "";
    const points = chartData.map((d, i) => ({ x: getX(i), y: getYTemp(d.temp) }));

    return points.reduce((acc, point, i, arr) => {
      if (i === 0) return `M ${point.x} ${point.y}`;
      const prev = arr[i - 1];
      const cx = (prev.x + point.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${point.y}, ${point.x} ${point.y}`;
    }, "");
  }, [chartData, minTemp, maxTemp]);

  // Temperature Area fill (subtle gradient under line)
  const tempAreaPath = useMemo(() => {
    if (chartData.length === 0) return "";
    const firstX = getX(0);
    const lastX = getX(chartData.length - 1);
    const baselineY = padding.top + plotHeight;
    return `${tempPathData} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  }, [tempPathData, chartData]);

  // Handle pointer tracking
  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relativeX = (clientX / rect.width) * width - padding.left;
    const stepWidth = plotWidth / (chartData.length - 1);
    const index = Math.round(relativeX / stepWidth);
    const clampedIndex = Math.max(0, Math.min(chartData.length - 1, index));
    setHoveredIndex(clampedIndex);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const activeItem = hoveredIndex !== null ? chartData[hoveredIndex] : null;

  return (
    <div className="flex flex-col gap-3.5">
      {/* Chart Legend & Metric Guide */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-white/15 pb-2.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-amber-400 inline-block shadow-xs" />
            <span className="text-white/90 font-medium">Suhu (°C)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400/40 border border-sky-300 inline-block" />
            <span className="text-white/90 font-medium">Peluang Hujan (%)</span>
          </div>
          {isToday && currentHourIndex !== null && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
              </span>
              <span className="text-amber-300 font-semibold">Saat Ini ({chartData[currentHourIndex]?.time} WIB)</span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-white/75 flex items-center gap-1 font-mono">
          <Info className="w-3 h-3 text-white/80" />
          <span>Arahkan kursor pada kurva untuk melihat parameter detail lengkap</span>
        </div>
      </div>

      {/* SVG Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full overflow-hidden select-none cursor-crosshair rounded-xl bg-black/20 border border-white/15 pt-2 backdrop-blur-sm"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="rainBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.25" />
            </linearGradient>

            <linearGradient id="rainBarHighGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#dc2626" stopOpacity="0.35" />
            </linearGradient>

            <linearGradient id="currentTimeLineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.3" />
            </linearGradient>

            {/* Subtle glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid Lines Horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding.top + plotHeight * ratio;
            const tempLabel = Math.round(maxTemp - ratio * (maxTemp - minTemp));
            const rainLabel = Math.round((1 - ratio) * 100);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-white/70 text-[10px] font-mono"
                >
                  {tempLabel}°C
                </text>
                <text
                  x={width - padding.right + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-sky-300 text-[10px] font-mono"
                >
                  {rainLabel}%
                </text>
              </g>
            );
          })}

          {/* Rain Probability Column Bars */}
          {chartData.map((d, i) => {
            const x = getX(i);
            const barWidth = 14;
            const barY = getYRain(d.rain_prob);
            const barHeight = Math.max(0, padding.top + plotHeight - barY);
            const isHighRain = d.rain_prob > 50;

            return (
              <g key={`rain-bar-${i}`}>
                <rect
                  x={x - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  rx="3"
                  fill={isHighRain ? "url(#rainBarHighGrad)" : "url(#rainBarGrad)"}
                  className="transition-all duration-200"
                />
              </g>
            );
          })}

          {/* Temperature Area Fill */}
          <path d={tempAreaPath} fill="url(#tempAreaGrad)" />

          {/* Temperature Curve Stroke */}
          <path
            d={tempPathData}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 1. CURRENT TIME INDICATOR: Vertical Reference Line & Badge */}
          {currentHourIndex !== null && (
            <g key="current-time-indicator" className="transition-all duration-300">
              {/* Glowing vertical line background */}
              <line
                x1={getX(currentHourIndex)}
                y1={padding.top}
                x2={getX(currentHourIndex)}
                y2={padding.top + plotHeight}
                stroke="#f59e0b"
                strokeWidth="4"
                className="opacity-25"
                filter="url(#glow)"
              />
              {/* Primary dashed vertical reference line */}
              <line
                x1={getX(currentHourIndex)}
                y1={padding.top - 2}
                x2={getX(currentHourIndex)}
                y2={padding.top + plotHeight}
                stroke="url(#currentTimeLineGrad)"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              {/* Sleek Pill Badge at top of the line */}
              <g transform={`translate(${getX(currentHourIndex)}, ${padding.top - 14})`}>
                <rect
                  x="-26"
                  y="-8"
                  width="52"
                  height="16"
                  rx="8"
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth="1"
                  className="drop-shadow-md"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#18181b"
                  className="text-[9px] font-extrabold uppercase tracking-wider font-mono select-none"
                >
                  Saat Ini
                </text>
              </g>
            </g>
          )}

          {/* Data Points on Curve */}
          {chartData.map((d, i) => {
            const x = getX(i);
            const y = getYTemp(d.temp);
            const isHovered = hoveredIndex === i;
            const isCurrent = currentHourIndex === i;

            return (
              <g key={`point-${i}`}>
                {/* Special pulsing highlight for current hour node */}
                {isCurrent && (
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r="12"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      className="animate-ping origin-center opacity-75"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="8"
                      fill="rgba(245, 158, 11, 0.35)"
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                    />
                  </>
                )}

                {/* Normal / Hover Node */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 6.5 : isCurrent ? 4.5 : 3.5}
                  fill={isHovered ? "#ffffff" : isCurrent ? "#f59e0b" : "#ffffff"}
                  stroke={isCurrent ? "#ffffff" : "#fbbf24"}
                  strokeWidth={isHovered ? 3 : isCurrent ? 2 : 2}
                  className="transition-all duration-150"
                />

                {/* X Axis Time Labels */}
                <text
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  className={`text-[10px] font-mono transition-colors ${
                    isHovered
                      ? "fill-white font-bold text-[11px]"
                      : isCurrent
                      ? "fill-amber-300 font-extrabold text-[11px]"
                      : "fill-white/80"
                  }`}
                >
                  {d.time}
                </text>
              </g>
            );
          })}

          {/* Active Hover Crosshair Line */}
          {hoveredIndex !== null && (
            <g>
              <line
                x1={getX(hoveredIndex)}
                y1={padding.top}
                x2={getX(hoveredIndex)}
                y2={padding.top + plotHeight}
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className="opacity-90"
              />
            </g>
          )}
        </svg>

        {/* Floating Detailed Hover Tooltip Popover */}
        {activeItem && (
          <div
            className="absolute top-3 pointer-events-none z-30 transition-all duration-75 shadow-xl"
            style={{
              left: `${Math.min(
                82,
                Math.max(18, (getX(hoveredIndex) / width) * 100)
              )}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xl backdrop-blur-md min-w-[220px]">
              {/* Tooltip Header */}
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-2 mb-2">
                <div className="flex items-center gap-1.5 font-bold text-xs font-mono text-[var(--accent-primary)]">
                  <span>{activeItem.time} WIB</span>
                  {isToday && hoveredIndex === currentHourIndex && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-400 text-black font-bold">KINI</span>
                  )}
                </div>
                <Badge
                  variant={
                    activeItem.rain_prob > 60
                      ? "danger"
                      : activeItem.rain_prob > 30
                      ? "warning"
                      : "success"
                  }
                  size="xs"
                >
                  {activeItem.weather_label}
                </Badge>
              </div>

              {/* Tooltip Metrics Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Suhu Aktual</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {activeItem.temp}°C
                  </span>
                </div>

                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Terasa Seperti</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {activeItem.feels_like}°C
                  </span>
                </div>

                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Peluang Hujan</span>
                  <span className={`font-mono font-bold ${activeItem.rain_prob > 50 ? "text-[var(--status-danger)]" : "text-sky-400"}`}>
                    {activeItem.rain_prob}% ({activeItem.rain_mm} mm)
                  </span>
                </div>

                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Kecepatan Angin</span>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {activeItem.wind_speed} km/j
                  </span>
                </div>

                <div className="col-span-2 pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                  <span>Titik Embun: {activeItem.dew_point}°C</span>
                  <span>WMO Code #{activeItem.weather_code}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WeatherPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState("today");
  const [selectedZoneId, setSelectedZoneId] = useState("all");
  const [searchZoneQuery, setSearchZoneQuery] = useState("");
  const [sortBy, setSortBy] = useState("rain_probability_percent");
  const [sortOrder, setSortOrder] = useState("desc");

  // Query Hooks - Single source of truth for Hub & multi-zone overview
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

  // Determine C4 Slots with clean, professional phrasing
  const c4SlotsList = useMemo(() => {
    if (selectedZoneId === "all") {
      if (hubWeather?.hub_c4_slots && Array.isArray(hubWeather.hub_c4_slots) && hubWeather.hub_c4_slots.length > 0) {
        return hubWeather.hub_c4_slots;
      }
    } else if (zoneTimelineData?.available_slots) {
      const slotsObj = zoneTimelineData.available_slots;
      return [
        {
          slot: "MORNING",
          title: "Pagi",
          time_range: "06:00 – 10:00 WIB",
          c4_score: (slotsObj.pagi?.max_rain_probability || 0) / 100,
          status: (slotsObj.pagi?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (slotsObj.pagi?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN",
          advisory: slotsObj.pagi?.advisory || "Kondisi optimal untuk penempatan armada di seluruh titik terbuka.",
        },
        {
          slot: "AFTERNOON",
          title: "Siang",
          time_range: "11:00 – 14:00 WIB",
          c4_score: (slotsObj.siang?.max_rain_probability || 0) / 100,
          status: (slotsObj.siang?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (slotsObj.siang?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN",
          advisory: slotsObj.siang?.advisory || "Suhu operasional tinggi. Pastikan perlengkapan peneduh armada terpasang baik.",
        },
        {
          slot: "EVENING",
          title: "Sore",
          time_range: "15:00 – 17:00 WIB",
          c4_score: (slotsObj.sore?.max_rain_probability || 0) / 100,
          status: (slotsObj.sore?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (slotsObj.sore?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN",
          advisory: slotsObj.sore?.advisory || "Potensi presipitasi meningkat: prioritaskan titik POI beratap dan siapkan jas hujan rider.",
        },
        {
          slot: "NIGHT",
          title: "Malam",
          time_range: "18:00 – 21:00 WIB",
          c4_score: (slotsObj.malam?.max_rain_probability || 0) / 100,
          status: (slotsObj.malam?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (slotsObj.malam?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN",
          advisory: slotsObj.malam?.advisory || "Kondisi cuaca stabil untuk kelanjutan operasional shift malam.",
        },
      ];
    }
    return [
      {
        slot: "MORNING",
        title: "Pagi",
        time_range: "06:00 – 10:00 WIB",
        c4_score: 0.12,
        status: "AMAN",
        advisory: "Kondisi optimal untuk penempatan armada di seluruh titik terbuka.",
      },
      {
        slot: "AFTERNOON",
        title: "Siang",
        time_range: "11:00 – 14:00 WIB",
        c4_score: 0.35,
        status: "WASPADA",
        advisory: "Suhu operasional tinggi. Pastikan perlengkapan peneduh armada terpasang baik.",
      },
      {
        slot: "EVENING",
        title: "Sore",
        time_range: "15:00 – 17:00 WIB",
        c4_score: 0.72,
        status: "BAHAYA HUJAN",
        advisory: "Potensi presipitasi meningkat: prioritaskan titik POI beratap dan siapkan jas hujan rider.",
      },
      {
        slot: "NIGHT",
        title: "Malam",
        time_range: "18:00 – 21:00 WIB",
        c4_score: 0.20,
        status: "AMAN",
        advisory: "Kondisi cuaca stabil untuk kelanjutan operasional shift malam.",
      },
    ];
  }, [selectedZoneId, hubWeather, zoneTimelineData]);

  // Dynamic Gradient for Hero Card
  const getDynamicGradientStyle = (code) => {
    const c = Number(code);
    if (c === 0) {
      return "from-[#0284c7] via-[#0369a1] to-[#1e3a8a] text-white";
    }
    if (c === 1 || c === 2) {
      return "from-[#0ea5e9] via-[#2563eb] to-[#1e293b] text-white";
    }
    if (c === 3) {
      return "from-[#475569] via-[#334155] to-[#0f172a] text-white";
    }
    if (c === 45 || c === 48) {
      return "from-[#64748b] via-[#475569] to-[#1e293b] text-white";
    }
    if ((c >= 51 && c <= 67) || c === 80) {
      return "from-[#1d4ed8] via-[#1e3a8a] to-[#0f172a] text-white";
    }
    if (c >= 81 && c <= 82) {
      return "from-[#1e1b4b] via-[#0f172a] to-[#020617] text-white";
    }
    if (c >= 95) {
      return "from-[#31104b] via-[#1e1b4b] to-[#09090b] text-white";
    }
    return "from-[#0284c7] via-[#1d4ed8] to-[#1e293b] text-white";
  };

  // Weather Icon Component
  const renderWeatherIcon = (code, isDay = true, sizeClass = "w-10 h-10") => {
    const iconUrl = getWeatherIconUrl(code, isDay);
    return (
      <img
        src={iconUrl}
        alt={`Kondisi Cuaca ${code}`}
        className={`${sizeClass} object-contain drop-shadow-md transition-transform duration-200 hover:scale-105`}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  };

  // Multi-Zone Table Data with Search & Sorting
  const processedZonesWeather = useMemo(() => {
    const rawList = hubWeather?.zones_weather_list || [];

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

    if (searchZoneQuery.trim()) {
      const q = searchZoneQuery.toLowerCase();
      baseList = baseList.filter((item) =>
        item.zone_name?.toLowerCase().includes(q)
      );
    }

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

  const handleSelectZone = (zoneId) => {
    setSelectedZoneId(zoneId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto">
      {/* Top Page Header & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <CloudRain className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Pusat Cuaca & Matriks Risiko Armada (C4)
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Visualisasi satelit Open-Meteo, evaluasi parameter cuaca C4, dan rekomendasi dispatch operasional rute armada Sidoarjo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector (Hari Ini / Besok) */}
          <div className="flex items-center bg-[var(--surface-muted)] p-1 rounded-lg border border-[var(--border-subtle)] text-xs">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                selectedDate === "today"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-xs font-semibold"
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
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-xs font-semibold"
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

          {/* Sync Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncWeather}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 h-9 px-3 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin text-[var(--accent-primary)]" : ""}`} />
            <span>{syncMutation.isPending ? "Menyinkronkan..." : "Sinkronisasi Cuaca"}</span>
          </Button>
        </div>
      </div>

      {/* 1. UNIFIED HERO WEATHER OVERVIEW & HOURLY FORECAST PANEL */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getDynamicGradientStyle(
          heroMetrics.weatherCode
        )} p-6 sm:p-8 shadow-xl border border-white/15 transition-all duration-500`}
      >
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
                <span className="text-[11px] text-white/80 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {selectedDate === "today" ? "Prakiraan Hari Ini" : "Prakiraan Besok"} • Jam Operasional: 06:00 – 21:00 WIB
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md bg-white/20 border border-white/20 text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Status: {heroMetrics.riskLevel === "HIGH" ? "Bahaya Hujan / Shelter" : heroMetrics.riskLevel === "MEDIUM" ? "Waspada Hujan" : "Kondisi Aman"}
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
                  Maks: {heroMetrics.maxTemp}°C
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white/15 backdrop-blur-sm border border-white/15">
                  Min: {heroMetrics.minTemp}°C
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white/15 backdrop-blur-sm border border-white/15 font-mono">
                  WMO Code #{heroMetrics.weatherCode}
                </span>
              </div>
            </div>

            {/* Right: Weather Icon */}
            <div className="sm:col-span-5 flex items-center justify-start sm:justify-end">
              <div className="relative p-2 flex items-center justify-center">
                {renderWeatherIcon(heroMetrics.weatherCode, true, "w-24 h-24 sm:w-32 sm:h-32 drop-shadow-xl")}
              </div>
            </div>
          </div>

          {/* Environmental Parameter Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
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

            {/* Curah Hujan */}
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

          {/* Integrated Hourly Operational Forecast Sub-Panel */}
          <div className="mt-2 pt-6 border-t border-white/15">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Prakiraan Cuaca Per Jam Operasional (06:00 – 21:00 WIB)</span>
                </h3>
                <p className="text-xs text-white/75 mt-0.5">
                  Fluktuasi suhu dan probabilitas presipitasi per jam armada beroperasi.
                </p>
              </div>
            </div>

            <HourlyWeatherChart
              timelineList={timelineList}
              isToday={selectedDate === "today"}
            />
          </div>
        </div>
      </div>

      {/* 3. EVALUASI PENALTI KRITERIA CUACA (C4) PER SHIFT KERJA */}
      <Panel>
        <PanelHeader
          title="Evaluasi Penalti Kriteria Cuaca (C4) per Shift Kerja"
          description="Bobot penalti kriteria cuaca pada model DSS BWM-TOPSIS untuk pertimbangan instruksi dispatch armada"
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
                      ? "border-[var(--status-danger)]/40 bg-[var(--status-danger)]/5"
                      : isMod
                      ? "border-[var(--status-warning)]/40 bg-[var(--status-warning)]/5"
                      : "border-[var(--border-subtle)] bg-[var(--surface)] hover:border-[var(--accent-primary)]/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-[var(--text-primary)]">
                        Shift {slotItem.title || slotItem.slot}
                      </span>
                      <Badge variant={isHigh ? "danger" : isMod ? "warning" : "success"} size="xs">
                        {slotItem.status}
                      </Badge>
                    </div>

                    <span className="text-xs text-[var(--text-muted)] block mb-3 font-mono">
                      {slotItem.time_range}
                    </span>

                    <div className="flex items-baseline justify-between mb-3 p-2 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
                      <span className="text-[10px] uppercase text-[var(--text-secondary)] font-bold">
                        Penalti C4:
                      </span>
                      <span className="font-mono font-bold text-sm text-[var(--accent-primary)]">
                        {Number(slotItem.c4_score).toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {slotItem.advisory}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </PanelContent>
      </Panel>

      {/* 4. TABEL RINGKASAN & KOMPARASI CUACA MULTI-ZONA */}
      <Panel>
        <PanelHeader
          title="Ringkasan & Komparasi Cuaca Multi-Zona Sidoarjo"
          description="Monitoring komparatif parameter cuaca satelit dan skor risiko C4 di seluruh zona operasional"
        />
        <PanelContent>
          <div className="flex flex-col gap-4">
            {/* Table Search & Total Count */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchZoneQuery}
                  onChange={(e) => setSearchZoneQuery(e.target.value)}
                  placeholder="Cari nama zona operasional..."
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
                        className="flex items-center gap-1.5 hover:text-[var(--text-primary)] cursor-pointer"
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
                        className="flex items-center gap-1.5 hover:text-[var(--text-primary)] cursor-pointer"
                        onClick={() => toggleSort("temperature_c")}
                      >
                        <span>Suhu (°C)</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 hover:text-[var(--text-primary)] cursor-pointer"
                        onClick={() => toggleSort("rain_probability_percent")}
                      >
                        <span>Peluang Hujan (%)</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 hover:text-[var(--text-primary)] cursor-pointer"
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
                            <button
                              type="button"
                              onClick={() => handleSelectZone(zoneItem.zone_id)}
                              className="flex items-center gap-2 text-left hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
                              title="Klik untuk fokus cuaca zona ini"
                            >
                              <MapPin className={`w-3.5 h-3.5 ${isSelected ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]"}`} />
                              <span className={isSelected ? "text-[var(--accent-primary)] font-bold" : ""}>
                                {zoneItem.zone_name}
                              </span>
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {renderWeatherIcon(zoneItem.weather_code, true, "w-5 h-5")}
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
                            <Badge variant={isHigh ? "danger" : isMod ? "warning" : "success"} size="xs">
                              {isHigh ? "Bahaya Hujan" : isMod ? "Waspada" : "Aman"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant={isSelected ? "primary" : "ghost"}
                                size="xs"
                                onClick={() => handleSelectZone(zoneItem.zone_id)}
                                className="text-[11px] h-7 px-2"
                                title="Lihat cuaca zona ini pada grafik di atas"
                              >
                                {isSelected ? "Aktif" : "Pilih"}
                              </Button>
                              <Link to={`/operations/zones/${zoneItem.zone_id}`}>
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  className="text-[11px] h-7 px-2.5 flex items-center gap-1"
                                >
                                  <span>Detail Zona</span>
                                  <ChevronRight className="w-3 h-3" />
                                </Button>
                              </Link>
                            </div>
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

export default WeatherPage;
