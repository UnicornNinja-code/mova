import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Badge,
} from "@/components/primitives";
import {
  Shield,
  ArrowLeft,
  Check,
  Minus,
  Users,
  Lock,
  Layers,
  Info,
} from "lucide-react";

export function RolesPage() {
  const [selectedRole, setSelectedRole] = useState("ALL");

  const roles = [
    {
      id: "SUPERADMIN",
      name: "Superadmin",
      description: "Full administrative authority, system configurations, weight calibration, and user hierarchy management.",
      usersCount: "1+",
      accessLevel: "Full System Administration",
      badgeVariant: "danger",
    },
    {
      id: "MANAGEMENT",
      name: "Management",
      description: "Executive oversight, citywide multi-zone KPI analytics, revenue reporting, and supervisor provisioning.",
      usersCount: "Executive",
      accessLevel: "Business & Strategic Oversight",
      badgeVariant: "warning",
    },
    {
      id: "SUPERVISOR",
      name: "Supervisor",
      description: "Field operational commander, real-time rider dispatching, TOPSIS recommendation approval, and fleet audits.",
      usersCount: "Operations",
      accessLevel: "Operational Command & Control",
      badgeVariant: "brand",
    },
    {
      id: "RIDER",
      name: "Rider",
      description: "Field mobile operator, 5-minute armada holding/claiming, GPS geofence check-in, and POS sales recording.",
      usersCount: "Field Fleet",
      accessLevel: "Field Mobile Operations",
      badgeVariant: "neutral",
    },
  ];

  const permissionsMatrix = [
    {
      module: "Overview & Dashboard",
      description: "Akses metrik KPI operasional dan ringkasan eksekutif armada",
      superadmin: true,
      management: true,
      supervisor: true,
      rider: false,
    },
    {
      module: "Live MapOps & Telemetri",
      description: "Peta spasial real-time, visualisasi armada, dan geofence tracking",
      superadmin: true,
      management: true,
      supervisor: true,
      rider: false,
    },
    {
      module: "Zona Operasional & Geometri",
      description: "Pembuatan polygon, edit batas wilayah, dan validasi jalan terlarang PostGIS",
      superadmin: true,
      management: false,
      supervisor: true,
      rider: false,
    },
    {
      module: "Manajemen Armada & Penugasan",
      description: "Pemeliharaan unit, status gerobak/motor, dan alokasi rider otomatis/manual",
      superadmin: true,
      management: true,
      supervisor: true,
      rider: false,
    },
    {
      module: "DSS Recommendation Engine",
      description: "Perhitungan TOPSIS, bobot kriteria BWM, dan persetujuan spot penjualan",
      superadmin: true,
      management: true,
      supervisor: true,
      rider: false,
    },
    {
      module: "Master POI & Data Spasial",
      description: "Sinkronisasi Overpass OSM, kurasi kategori, dan audit jalan protokol/tol",
      superadmin: true,
      management: false,
      supervisor: true,
      rider: false,
    },
    {
      module: "Survei Kompetitor",
      description: "Pencatatan kompetitor lapangan dan analisis densitas kedai kopi",
      superadmin: true,
      management: true,
      supervisor: true,
      rider: false,
    },
    {
      module: "Laporan & Ekspor Data",
      description: "Generasi laporan KPI eksekutif, efektivitas zona, dan ekspor CSV / PDF",
      superadmin: true,
      management: true,
      supervisor: false,
      rider: false,
    },
    {
      module: "Aplikasi Lapangan Rider (PWA)",
      description: "Klaim armada 5 menit, GPS check-in zona, lock spot, dan transaksi kasir POS",
      superadmin: false,
      management: false,
      supervisor: false,
      rider: true,
    },
    {
      module: "Manajemen User & Hak Akses",
      description: "Provisioning akun staf, pembagian peran, aktivasi, dan pencabutan sesi",
      superadmin: true,
      management: false,
      supervisor: false,
      rider: false,
    },
    {
      module: "Log Audit Forensik & Sistem",
      description: "Pemeriksaan trail aktivitas administratif dan konfigurasi scheduler cron",
      superadmin: true,
      management: false,
      supervisor: false,
      rider: false,
    },
  ];

  return (
    <div className="flex flex-col w-full min-h-screen bg-[var(--background)] p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/admin/users"
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Administration
            </Link>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            Roles & Access
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Manage what each MOVA role can access and perform across all system modules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin/users">
            <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Manage Users
            </Button>
          </Link>
        </div>
      </div>

      {/* Role Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-2.5 flex flex-col justify-between"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[var(--text-primary)] tracking-wide">
                  {role.id}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                  {role.usersCount}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {role.name}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                {role.description}
              </p>
            </div>

            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{role.accessLevel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Hierarchy Guard Callout */}
      <div className="p-3.5 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] flex items-start gap-3 text-xs text-[var(--text-secondary)]">
        <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[var(--text-primary)]">Hierarchy Guard Enforced: </span>
          Otorisasi hak akses berbasis RBAC 4-tingkat diatur secara ketat di layer backend. Pengguna tidak dapat membuat, mengubah, atau menurunkan akun dengan peran yang setara atau lebih tinggi dari dirinya.
        </div>
      </div>

      {/* Module Permissions Matrix Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Module Permission Matrix
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            Single Source of Truth (RBAC v1.0)
          </span>
        </div>

        <div className="border border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] font-semibold">
                  <th className="p-3 w-[260px]">MODULE</th>
                  <th className="p-3">CAPABILITY & SCOPE</th>
                  <th className="p-3 text-center w-[120px]">SUPERADMIN</th>
                  <th className="p-3 text-center w-[120px]">MANAGEMENT</th>
                  <th className="p-3 text-center w-[120px]">SUPERVISOR</th>
                  <th className="p-3 text-center w-[120px]">RIDER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {permissionsMatrix.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[var(--surface-raised)]/50 transition-colors">
                    <td className="p-3 font-medium text-[var(--text-primary)]">
                      {item.module}
                    </td>
                    <td className="p-3 text-[var(--text-secondary)]">
                      {item.description}
                    </td>
                    <td className="p-3 text-center">
                      {item.superadmin ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {item.management ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {item.supervisor ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {item.rider ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RolesPage;
