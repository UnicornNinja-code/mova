import React, { useState } from "react";
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Globe,
  User,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Database,
  Activity,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/formatters";
import { PoiCategoryBadge } from "./PoiCategoryIcon";

export function PoiHealthControlPanel({ stats, poisCount = 0, categoriesCount = 0, loading = false }) {
  const [showAllCategories, setShowAllCategories] = useState(false);

  if (!stats || loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-pulse">
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-3.5 h-28 flex flex-col justify-between shadow-2xs">
          <div className="h-3 bg-[var(--surface-muted)] rounded w-2/5" />
          <div className="h-6 bg-[var(--surface-muted)] rounded w-3/5" />
          <div className="h-2.5 bg-[var(--surface-muted)] rounded w-4/5" />
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-3.5 h-28 flex flex-col justify-between shadow-2xs">
          <div className="h-3 bg-[var(--surface-muted)] rounded w-2/5" />
          <div className="h-6 bg-[var(--surface-muted)] rounded w-3/5" />
          <div className="h-2.5 bg-[var(--surface-muted)] rounded w-4/5" />
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-3.5 h-28 flex flex-col justify-between shadow-2xs">
          <div className="h-3 bg-[var(--surface-muted)] rounded w-2/5" />
          <div className="h-6 bg-[var(--surface-muted)] rounded w-3/5" />
          <div className="h-2.5 bg-[var(--surface-muted)] rounded w-4/5" />
        </div>
      </div>
    );
  }

  const summary = stats.summary || {};
  const categoriesSummary = stats.categories_summary || [];
  const sourcesSummary = stats.sources_summary || [];

  const totalPois = summary.total_pois || poisCount || 0;
  const validPois = summary.valid_count || summary.eligible_count || totalPois;
  const excludedPois = summary.excluded_count || 0;
  const pendingPois = summary.pending_count || 0;
  const totalCategories = categoriesSummary.length || summary.total_categories || categoriesCount || 0;

  const validPct = totalPois > 0 ? ((validPois / totalPois) * 100).toFixed(1) : 0;
  const topCategory = categoriesSummary[0] || null;

  // Source helpers
  const getSourceIcon = (key) => {
    if (key === "OVERPASS_API" || key === "osm") return Globe;
    if (key === "MANUAL_ENTRY" || key === "manual") return User;
    if (key === "MANUAL_BULK_UPLOAD" || key === "bulk") return UploadCloud;
    return Database;
  };

  const getSourceLabel = (key) => {
    if (key === "OVERPASS_API" || key === "osm") return "OpenStreetMap";
    if (key === "MANUAL_ENTRY" || key === "manual") return "Manual Input";
    if (key === "MANUAL_BULK_UPLOAD" || key === "bulk") return "Bulk Upload";
    return "Sistem";
  };

  // Health status configuration
  const isOptimal = pendingPois === 0 && totalPois > 0;
  const healthBadge = isOptimal
    ? {
        label: "Dataset Optimal & Fresh",
        desc: "Seluruh data valid dan siap untuk analisis MapOps/DSS",
        colorClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
        icon: ShieldCheck,
        dotClass: "bg-emerald-500",
      }
    : pendingPois > 0
    ? {
        label: "Menunggu Peninjauan",
        desc: `${pendingPois} POI membutuhkan persetujuan supervisor`,
        colorClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
        icon: AlertTriangle,
        dotClass: "bg-amber-500",
      }
    : {
        label: "Dataset Kosong",
        desc: "Belum ada POI terdaftar di database",
        colorClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25",
        icon: Activity,
        dotClass: "bg-slate-400",
      };

  const HealthIcon = healthBadge.icon;

  return (
    <div className="space-y-3">
      {/* 3-Column Control Center Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* CARD 1: Dataset Vitals & Health */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Kesehatan Dataset POI
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-full)] text-[10px] font-semibold border ${healthBadge.colorClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${healthBadge.dotClass}`} />
              {healthBadge.label}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 py-3">
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Total POI</span>
              <span className="text-lg font-bold text-[var(--text-primary)] font-mono">
                {totalPois.toLocaleString("id-ID")}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block uppercase">
                Aktif/Eligible
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                  {validPois.toLocaleString("id-ID")}
                </span>
                <span className="text-[10px] text-emerald-600/80 font-mono font-semibold">
                  ({validPct}%)
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Excluded</span>
              <span className="text-lg font-bold text-[var(--text-secondary)] font-mono">
                {excludedPois}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span className="truncate">{healthBadge.desc}</span>
            {pendingPois > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">
                {pendingPois} Pending
              </span>
            )}
          </div>
        </div>

        {/* CARD 2: Provenance & Freshness */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Sumber & Pembaruan
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              {sourcesSummary.length || 1} Channel Asal
            </span>
          </div>

          {/* Sources Breakdown Pill Strip */}
          <div className="py-2.5 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {sourcesSummary.length > 0 ? (
                sourcesSummary.map((src, idx) => {
                  const SIcon = getSourceIcon(src.source_key);
                  return (
                    <span
                      key={src.source_key || idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-full)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-secondary)]"
                    >
                      <SIcon className="w-3 h-3 text-[var(--text-muted)]" />
                      <strong className="text-[var(--text-primary)] font-semibold">
                        {getSourceLabel(src.source_key)}
                      </strong>
                      <span className="text-[var(--text-muted)]">{src.percentage}%</span>
                    </span>
                  );
                })
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-full)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-secondary)]">
                  <Globe className="w-3 h-3 text-sky-500" />
                  <strong className="text-[var(--text-primary)]">OpenStreetMap</strong>
                  <span className="text-[var(--text-muted)]">100%</span>
                </span>
              )}
            </div>
          </div>

          {/* Freshness Timestamps */}
          <div className="pt-2 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-2 text-[10px] text-[var(--text-muted)]">
            <div className="truncate">
              <span className="block text-[9px] uppercase tracking-wider">Terakhir Sinkron:</span>
              <span className="font-mono text-[var(--text-secondary)] font-medium">
                {summary.last_sync_at ? formatDate(summary.last_sync_at) : "Sesuai Jadwal"}
              </span>
            </div>
            <div className="truncate text-right">
              <span className="block text-[9px] uppercase tracking-wider">Pembaruan Record:</span>
              <span className="font-mono text-[var(--text-secondary)] font-medium">
                {summary.last_updated_at ? formatRelativeTime(summary.last_updated_at) : "Terkini"}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: Category Distribution & Top Spotlight */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Distribusi Kategori
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              <strong className="text-[var(--text-primary)]">{totalCategories}</strong> dari 59 Otoritatif
            </span>
          </div>

          {/* Mini Top Categories Progress Strip */}
          <div className="py-1.5 space-y-1.5">
            {categoriesSummary.slice(0, 3).map((cat, idx) => (
              <div key={cat.category || idx} className="space-y-0.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-[var(--text-secondary)] font-medium truncate max-w-[140px]">
                    {idx === 0 && "🏆 "}
                    {cat.category}
                  </span>
                  <span className="font-mono text-[var(--text-muted)]">
                    <strong className="text-[var(--text-primary)]">{cat.count}</strong> ({cat.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-[var(--surface-muted)] h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-[var(--accent-primary)] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)] truncate">
              Dominan: <strong className="text-[var(--text-primary)]">{topCategory?.category || "—"}</strong>
            </span>
            {categoriesSummary.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="text-[10px] font-medium text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
              >
                {showAllCategories ? "Tutup" : "Lihat Semua"}
                {showAllCategories ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable All Categories Drawer/List */}
      {showAllCategories && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] p-3.5 space-y-2.5 animate-in fade-in duration-150 shadow-xs">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Seluruh Distribusi Kategori POI ({categoriesSummary.length} Kategori Aktif)
            </span>
            <button
              onClick={() => setShowAllCategories(false)}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Tutup Panel
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
            {categoriesSummary.map((cat, idx) => (
              <div
                key={cat.category || idx}
                className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-2 flex flex-col justify-between space-y-1"
              >
                <PoiCategoryBadge category={cat.category} className="w-full justify-start text-[10px] py-0.5" />
                <div className="flex justify-between items-center text-[10px] font-mono pt-1 text-[var(--text-muted)]">
                  <span>{cat.percentage}%</span>
                  <strong className="text-[var(--text-primary)]">{cat.count} POI</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
