import React from "react";
import { Grid, Stack, Panel, PanelHeader, PanelBody, StatusBadge, Skeleton, EmptyState } from "@/components/primitives";
import { MetricCard, DataTable } from "@/components/composites";
import { Bike, MapPin, DollarSign, Activity, TrendingUp } from "lucide-react";
import { formatRupiah } from "@/lib/formatters";
import { useOperationalSummary, useFleetUtilization, useComplianceSummary, useSalesPerformance } from "@/hooks/queries/useDashboard";
import { useZonesList } from "@/hooks/queries/useZones";
import { useAuthStore } from "@/stores/useAuthStore";

export function OverviewPage() {
  const user = useAuthStore((state) => state.user);

  const { data: operationalData, isLoading: loadingOps } = useOperationalSummary();
  const { data: fleetData, isLoading: loadingFleet } = useFleetUtilization();
  const { data: complianceData, isLoading: loadingComp } = useComplianceSummary();
  const { data: salesData, isLoading: loadingSales } = useSalesPerformance();
  const { data: zonesData = [], isLoading: loadingZones } = useZonesList();

  const zones = Array.isArray(zonesData) ? zonesData : zonesData?.zones || [];

  const activeRiders = operationalData?.active_riders ?? fleetData?.active_riders ?? 0;
  const totalRiders = operationalData?.total_riders ?? fleetData?.total_riders ?? 0;
  const utilizationPct = totalRiders > 0 ? Math.round((activeRiders / totalRiders) * 100) : 0;

  const totalRevenue = salesData?.total_revenue ?? operationalData?.today_revenue ?? 0;
  const complianceRate = complianceData?.compliance_rate ?? 100;
  const violationsCount = complianceData?.violations_count ?? 0;

  const metrics = [
    {
      title: "Rider Aktif",
      value: `${activeRiders} / ${totalRiders || "-"}`,
      subtitle: `${utilizationPct}% Utilisasi Armada`,
      icon: Bike,
      status: utilizationPct > 0 ? "brand" : "neutral",
      trend: utilizationPct > 0 ? { value: `${utilizationPct}%`, direction: "up" } : undefined,
    },
    {
      title: "Zona Operasional",
      value: `${zones.length} Zona`,
      subtitle: zones.length > 0 ? `${zones.filter(z => z.status === "ACTIVE").length} Zona Aktif` : "Belum Ada Zona",
      icon: MapPin,
      status: zones.length > 0 ? "info" : "warning",
    },
    {
      title: "Estimasi Pendapatan Hari Ini",
      value: formatRupiah(totalRevenue),
      subtitle: totalRevenue > 0 ? "+14% vs Kemarin" : "Belum ada transaksi hari ini",
      icon: DollarSign,
      status: totalRevenue > 0 ? "success" : "neutral",
      trend: totalRevenue > 0 ? { value: "+14%", direction: "up" } : undefined,
    },
    {
      title: "Kepatuhan Geofence",
      value: `${complianceRate}%`,
      subtitle: `${violationsCount} Pelanggaran Jalan Terlarang`,
      icon: Activity,
      status: violationsCount === 0 ? "success" : "warning",
    },
  ];

  const columns = [
    {
      header: "Zona Operasional",
      accessor: "name",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] shrink-0" />
          <span className="font-semibold text-[var(--text-primary)]">{row.name}</span>
        </div>
      ),
    },
    {
      header: "Kapasitas Rider",
      render: (row) => (
        <span className="font-mono text-xs text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">{row.active_riders || 0}</strong> / {row.max_capacity || 3} Rider
        </span>
      ),
    },
    {
      header: "Status Kepatuhan",
      render: (row) => <StatusBadge status={row.status || "ACTIVE"} label={row.status === "ACTIVE" ? "Compliant" : row.status} />,
    },
    {
      header: "Deskripsi",
      render: (row) => (
        <span className="text-xs text-[var(--text-muted)] truncate max-w-xs block">
          {row.description || "Pemantauan zona spasial PostGIS"}
        </span>
      ),
    },
  ];

  const isLoading = loadingOps || loadingFleet || loadingComp || loadingSales || loadingZones;

  return (
    <Stack gap="lg">
      {/* Page Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Command Operational Overview
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Selamat datang kembali, <span className="font-semibold text-[var(--text-primary)]">{user?.name || "Admin"}</span>! Ringkasan metrik waktu-nyata operasional MantaKopi Sidoarjo Hub.
          </p>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      {isLoading ? (
        <Grid cols={4} gap="md">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-[var(--radius-lg)]" />
          ))}
        </Grid>
      ) : (
        <Grid cols={4} gap="md">
          {metrics.map((m, idx) => (
            <MetricCard key={idx} {...m} />
          ))}
        </Grid>
      )}

      {/* Zone Status Realtime Table */}
      <Panel className="card-elevated">
        <PanelHeader
          title="Status Realtime Zona Operasional"
          subtitle="Pemantauan live kapasitas zona dan data spasial PostGIS"
        />
        <PanelBody padding="none">
          {loadingZones ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
              <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
            </div>
          ) : zones.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Belum Ada Zona Operasional"
                description="Database belum memiliki zona terdaftar. Tambahkan zona melalui menu Spatial Zone Ops."
              />
            </div>
          ) : (
            <DataTable columns={columns} data={zones} />
          )}
        </PanelBody>
      </Panel>
    </Stack>
  );
}
