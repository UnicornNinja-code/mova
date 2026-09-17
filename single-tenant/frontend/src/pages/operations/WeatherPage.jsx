import React, { useState } from "react";
import {
  Panel,
  PanelHeader,
  PanelContent,
  Button,
  StatusBadge,
  Badge,
  Select,
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

  const { data: hubWeather, isLoading: isHubLoading, refetch: refetchHub } = useHubWeather("sidoarjo");
  const { data: timelineData = [], isLoading: isTimelineLoading } = useZoneWeatherTimeline(
    selectedZoneId === "all" ? "zone-all" : selectedZoneId,
    { date: selectedDate }
  );
  const { data: c4Data, isLoading: isC4Loading } = useWeatherC4Scores(
    selectedZoneId === "all" ? "zone-default" : selectedZoneId
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

  const getWeatherIcon = (code, isDay = true) => {
    const iconUrl = getWeatherIconUrl(code, isDay);
    return (
      <img
        src={iconUrl}
        alt={`Weather ${code}`}
        className="w-9 h-9 md:w-10 md:h-10 object-contain drop-shadow-sm transition-transform duration-200 hover:scale-115 cursor-pointer"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto">
      {/* Page Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <CloudRain className="w-6 h-6 text-[var(--accent-primary)]" />
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Prediksi Cuaca & Matriks Risiko Spasial
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Evaluasi parameter biaya cuaca ($C_4$) & mitigasi risiko hujan terhadap rute armada keliling
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-1 bg-[var(--surface-muted)] p-1 rounded border border-[var(--border-subtle)] text-xs">
            <button
              type="button"
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedDate === "today"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setSelectedDate("today")}
            >
              Hari Ini
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedDate === "tomorrow"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setSelectedDate("tomorrow")}
            >
              Besok
            </button>
          </div>

          {/* Zone Selector */}
          <select
            value={selectedZoneId}
            onChange={(e) => setSelectedZoneId(e.target.value)}
            className="h-8 px-2 text-xs rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
          >
            <option value="all">Semua Zona Operasional</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>

          {/* Sync Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncWeather}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            <span>{syncMutation.isPending ? "Menyinkronkan..." : "Sync Open-Meteo"}</span>
          </Button>
        </div>
      </div>

      {/* Central Hub Weather Overview Card */}
      <Panel variant="raised">
        <PanelHeader
          title="🌤️ Central Hub Weather Overview (Sidoarjo & Surabaya Hub)"
          description="Kondisi cuaca satelit real-time dari Open-Meteo API"
        />
        <PanelContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            <div className="flex items-center gap-3 p-3 rounded bg-[var(--surface)] border border-[var(--border-subtle)]">
              <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-500">
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-medium">Suhu Udara</span>
                <p className="font-mono font-bold text-lg text-[var(--text-primary)]">
                  {hubWeather?.temperature ?? 29.4}°C
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded bg-[var(--surface)] border border-[var(--border-subtle)]">
              <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-500">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-medium">Kelembaban</span>
                <p className="font-mono font-bold text-lg text-[var(--text-primary)]">
                  {hubWeather?.relative_humidity ?? 72}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded bg-[var(--surface)] border border-[var(--border-subtle)]">
              <div className="p-2.5 rounded-full bg-teal-500/10 text-teal-500">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-medium">Kecepatan Angin</span>
                <p className="font-mono font-bold text-lg text-[var(--text-primary)]">
                  {hubWeather?.wind_speed ?? 14.2} km/j
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded bg-[var(--surface)] border border-[var(--border-subtle)]">
              <div className="p-2.5 rounded-full bg-indigo-500/10 text-indigo-500">
                <CloudRain className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-medium">Peluang Hujan</span>
                <p className="font-mono font-bold text-lg text-[var(--text-primary)]">
                  {hubWeather?.precipitation_probability ?? 15}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded bg-[var(--surface)] border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
              <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-medium">Status Risiko</span>
                <div className="mt-0.5">
                  <Badge variant="success" size="sm">
                    {hubWeather?.risk_level === "HIGH" ? "Risiko Tinggi" : "Aman / Normal"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </PanelContent>
      </Panel>

      {/* Hourly Operational Timeline (06:00 - 21:00 WIB) */}
      <Panel>
        <PanelHeader
          title="⏱️ Hourly Operational Timeline (06:00 - 21:00 WIB)"
          description="Prakiraan curah hujan dan kondisi cuaca per 2 jam selama jam operasional armada"
        />
        <PanelContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
            {timelineData.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center p-3 rounded border border-[var(--border-subtle)] bg-[var(--surface)] text-center transition-all hover:border-[var(--accent-primary)]/50"
              >
                <span className="font-mono font-bold text-xs text-[var(--text-primary)] mb-1.5">
                  {item.time}
                </span>

                <div className="my-1.5 flex items-center justify-center min-h-[44px]">
                  {getWeatherIcon(
                    item.weather_code,
                    item.is_day !== undefined
                      ? item.is_day
                      : parseInt(item.time, 10) >= 6 && parseInt(item.time, 10) < 18
                  )}
                </div>

                <span className="font-mono font-semibold text-sm text-[var(--text-primary)] mt-1">
                  {item.temp}°C
                </span>

                <div className="w-full mt-2 pt-2 border-t border-[var(--border-subtle)] flex flex-col items-center gap-1">
                  <div className="w-full bg-[var(--surface-muted)] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.rain_prob > 60
                          ? "bg-[var(--status-danger)]"
                          : item.rain_prob > 30
                          ? "bg-[var(--status-warning)]"
                          : "bg-[var(--status-success)]"
                      }`}
                      style={{ width: `${item.rain_prob}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    🌧️ {item.rain_prob}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </PanelContent>
      </Panel>

      {/* 4-Slot C4 Weather Risk Penalty & Dispatch Advisory */}
      <Panel>
        <PanelHeader
          title="⚖️ 4-Slot C4 Weather Risk Penalty & Dispatch Advisory"
          description="Evaluasi penalti kriteria cuaca (C4) pada model DSS BWM-TOPSIS untuk 4 shift waktu"
        />
        <PanelContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(c4Data?.slots || []).map((slotItem, idx) => {
              const isHigh = slotItem.c4_score > 0.6;
              const isMod = slotItem.c4_score > 0.3 && !isHigh;

              return (
                <div
                  key={idx}
                  className={`flex flex-col justify-between p-4 rounded border ${
                    isHigh
                      ? "border-[var(--status-danger)]/50 bg-[var(--status-danger)]/5"
                      : isMod
                      ? "border-[var(--status-warning)]/50 bg-[var(--status-warning)]/5"
                      : "border-[var(--border-subtle)] bg-[var(--surface)]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
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

                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-[10px] uppercase text-[var(--text-muted)] font-medium">Skor Penalti C4:</span>
                      <span className="font-mono font-bold text-base text-[var(--accent-primary)]">
                        {slotItem.c4_score.toFixed(2)}
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
    </div>
  );
}
