import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Panel,
  PanelHeader,
  PanelContent,
  Button,
  Badge,
  Spinner,
} from "@/components/primitives";
import {
  MapPin,
  ArrowLeft,
  Layers,
  Users,
  Compass,
  Navigation,
  AlertCircle,
} from "lucide-react";
import { useZoneDetail, useCandidateSpots } from "@/hooks/queries/useZones";

export function ZoneDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    data: zone,
    isLoading: isZoneLoading,
    isError: isZoneError,
    error: zoneError,
  } = useZoneDetail(id);

  const {
    data: candidateSpotsData,
    isLoading: isSpotsLoading,
  } = useCandidateSpots(id);

  const candidateSpots = Array.isArray(candidateSpotsData)
    ? candidateSpotsData
    : candidateSpotsData?.data || [];

  if (isZoneLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        <Spinner size="lg" label="Memuat Data Detail Zona..." />
      </div>
    );
  }

  if (isZoneError || !zone) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
        </div>
        <Panel>
          <PanelContent>
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-12 h-12 text-[var(--status-danger)] mb-3" />
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Zona Tidak Ditemukan
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-md">
                {zoneError?.message ||
                  `Zona dengan ID '${id}' tidak ditemukan di database operasional.`}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/operations/weather")}
                className="mt-4 text-xs"
              >
                Kembali ke Ringkasan Cuaca
              </Button>
            </div>
          </PanelContent>
        </Panel>
      </div>
    );
  }

  const zoneStatus = zone.status || "ACTIVE";
  const polygonCoordinates = zone.polygon?.coordinates?.[0] || [];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-8 w-8 p-0 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            title="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                Operasional / Detail Zona
              </span>
              <span className="text-xs text-[var(--text-muted)]">•</span>
              <span className="text-xs font-mono text-[var(--text-secondary)]">
                ID: {zone.id}
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2 mt-0.5">
              <MapPin className="w-5 h-5 text-[var(--accent-primary)]" />
              {zone.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={
              zoneStatus === "ACTIVE"
                ? "success"
                : zoneStatus === "RESTRICTED"
                ? "warning"
                : "neutral"
            }
            size="md"
          >
            {zoneStatus === "ACTIVE"
              ? "Status: Aktif"
              : zoneStatus === "RESTRICTED"
              ? "Status: Dibatasi"
              : "Status: Non-Aktif"}
          </Badge>
          <Link to="/operations/weather">
            <Button variant="secondary" size="sm" className="text-xs">
              Lihat Cuaca Terkait
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid: Overview Information & Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Kapasitas Armada */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] flex items-center gap-4 shadow-xs">
          <div className="p-3 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
              Kapasitas Maksimum Armada
            </span>
            <p className="text-lg font-mono font-bold text-[var(--text-primary)] mt-0.5">
              {zone.max_capacity ?? 0}{" "}
              <span className="text-xs font-sans font-normal text-[var(--text-secondary)]">
                Unit Gerobak
              </span>
            </p>
          </div>
        </div>

        {/* Card 2: Jumlah Candidate Spots */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] flex items-center gap-4 shadow-xs">
          <div className="p-3 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
              Titik Spot Kandidat (POI)
            </span>
            <p className="text-lg font-mono font-bold text-[var(--text-primary)] mt-0.5">
              {candidateSpots.length}{" "}
              <span className="text-xs font-sans font-normal text-[var(--text-secondary)]">
                Titik Terdaftar
              </span>
            </p>
          </div>
        </div>

        {/* Card 3: Geometri Poligon */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] flex items-center gap-4 shadow-xs">
          <div className="p-3 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
              Verteks Poligon PostGIS
            </span>
            <p className="text-lg font-mono font-bold text-[var(--text-primary)] mt-0.5">
              {polygonCoordinates.length}{" "}
              <span className="text-xs font-sans font-normal text-[var(--text-secondary)]">
                Titik Koordinat
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Deskripsi & Ringkasan Parameter Zona */}
      <Panel>
        <PanelHeader
          title="Informasi & Parameter Zona"
          description="Rincian deskripsi operasional dan atribut zona operasional terdaftar"
        />
        <PanelContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="flex flex-col gap-3">
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Deskripsi Zona
                </span>
                <p className="mt-1 text-[var(--text-primary)] leading-relaxed bg-[var(--surface-muted)] p-3 rounded-lg border border-[var(--border-subtle)]">
                  {zone.description || "Tidak ada deskripsi tambahan yang tercatat untuk zona ini."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Dibuat Pada
                  </span>
                  <p className="mt-0.5 font-mono text-[var(--text-secondary)]">
                    {zone.created_at
                      ? new Date(zone.created_at).toLocaleString("id-ID")
                      : "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Pembaruan Terakhir
                  </span>
                  <p className="mt-0.5 font-mono text-[var(--text-secondary)]">
                    {zone.updated_at
                      ? new Date(zone.updated_at).toLocaleString("id-ID")
                      : "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Geometri Poligon GeoJSON (PostGIS SRID 4326)
              </span>
              <div className="font-mono text-[11px] bg-[var(--surface-muted)] p-3 rounded-lg border border-[var(--border-subtle)] max-h-36 overflow-y-auto text-[var(--text-secondary)] scrollbar-thin">
                {zone.polygon ? (
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(zone.polygon, null, 2)}
                  </pre>
                ) : (
                  <span className="text-[var(--text-muted)]">
                    Poligon tidak terdefinisi.
                  </span>
                )}
              </div>
            </div>
          </div>
        </PanelContent>
      </Panel>

      {/* Tabel Titik Kandidat (POI Candidate Locations) */}
      <Panel>
        <PanelHeader
          title="Daftar Titik Lokasi Kandidat (Candidate Spots)"
          description="Spot strategis terdaftar di dalam zona untuk penempatan armada rute gerobak"
        />
        <PanelContent>
          {isSpotsLoading ? (
            <div className="py-8 flex justify-center">
              <Spinner size="md" label="Memuat candidate spots..." />
            </div>
          ) : candidateSpots.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              Belum ada titik kandidat (candidate spots) yang terdaftar di zona ini.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Nama Titik Spot</th>
                    <th className="py-3 px-4">Koordinat (Lat, Lng)</th>
                    <th className="py-3 px-4">Radius Efektif</th>
                    <th className="py-3 px-4">Kategori / Tipe</th>
                    <th className="py-3 px-4">Skor Potensi</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)]">
                  {candidateSpots.map((spot, idx) => (
                    <tr
                      key={spot.id || idx}
                      className="hover:bg-[var(--surface-muted)]/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          <Navigation className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          <span>{spot.name || `Spot #${spot.id}`}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-secondary)]">
                        {spot.latitude && spot.longitude
                          ? `${Number(spot.latitude).toFixed(5)}, ${Number(spot.longitude).toFixed(5)}`
                          : spot.location?.coordinates
                          ? `${spot.location.coordinates[1]?.toFixed(5)}, ${spot.location.coordinates[0]?.toFixed(5)}`
                          : "-"}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {spot.radius_meters ? `${spot.radius_meters} m` : "50 m"}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        {spot.category || "General POI"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[var(--accent-primary)]">
                        {spot.potential_score ? Number(spot.potential_score).toFixed(2) : "-"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge
                          variant={spot.is_active !== false ? "success" : "neutral"}
                          size="xs"
                        >
                          {spot.is_active !== false ? "Aktif" : "Non-Aktif"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}

export default ZoneDetailPage;
