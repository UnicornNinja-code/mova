# PART 06 — FLOW-06: MANAJEMEN ASET, ANALITIK, TATA KELOLA & SISTEM (LAYAR E1–E4 & F1–F3)

> **Status Dokumen**: 🏛️ **FLOW-06 RECONSTRUCTION BLUEPRINT**  
> **Referensi SSOT**: [`MAPING_UI_UX.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/docs/MAPING_UI_UX.md) (Layar E1–E4 & Layar F1–F3)  
> **Prinsip Panduan**: [`radix-ui-design-system`](file:///f:/01_Projects/apps/mova-app/.agents/skills/radix-ui-design-system/SKILL.md), [`web-design-guidelines`](file:///f:/01_Projects/apps/mova-app/.agents/skills/web-design-guidelines/SKILL.md), [`ui-ux-pro-max`](file:///f:/01_Projects/apps/mova-app/.agents/skills/ui-ux-pro-max/SKILL.md), [`test-driven-development`](file:///f:/01_Projects/apps/mova-app/.agents/skills/test-driven-development/SKILL.md)

---

## 1. Lingkup & Sasaran Layar

Fase ini merekonstruksi modul manajerial, analitik bisnis, pelaporan eksekutif, serta tata kelola sistem dan kesiapan operasional holistik:

| Kode Layar | Nama Layar | Rute URL | Komponen Radix UI | Endpoint API Terintegrasi |
|---|---|---|---|---|
| **Layar E1** | Fleet Assets & Lifecycle | `/fleet` | `Dialog`, `AlertDialog`, `Badge`, `DropdownMenu` | `GET /armada`, `POST /armada`, `GET /armada/:id`, `PUT /armada/:id`, `DELETE /armada/:id`, `PATCH /armada/:id/status`, `POST /armada/:id/maintenance`, `POST /armada/:id/release-maintenance`, `GET /armada/held-status` |
| **Layar E2** | Product Menu Catalog | `/products` | `Dialog`, `Switch`, `Table`, `Toast` | `GET /products`, `POST /products`, `GET /products/:id`, `PUT /products/:id`, `PATCH /products/:id/status`, `DELETE /products/:id` |
| **Layar E3** | Analytics & Plan vs Actual | `/analytics` | `Tabs`, `Select`, `Card`, `ScrollArea` | `GET /analytics/overview`, `GET /analytics/operational-summary`, `GET /analytics/sales-performance`, `GET /analytics/fleet-utilization`, `GET /analytics/compliance-summary`, `GET /analytics/dss-performance`, `GET /analytics/dss-plan-vs-actual`, `GET /analytics/hourly-sales-curves`, `GET /analytics/zone-hourly-curves`, `GET /analytics/in-zone-vs-out-of-zone` |
| **Layar E4** | Executive Reports & Export | `/reports` | `Select`, `Calendar/Popover`, `Button`, `Toast` | `GET /reports/daily-summary`, `GET /reports/rider-operational`, `GET /reports/zone-effectiveness`, `GET /reports/fleet-utilization`, `GET /reports/dss-accuracy`, `GET /reports/export` |
| **Layar F1** | User & Access RBAC Guard | `/users` | `Dialog`, `AlertDialog`, `Select`, `Table`, `Badge` | `GET /users`, `POST /users`, `GET /users/:id`, `PUT /users/:id`, `PATCH /users/:id/status`, `DELETE /users/:id` |
| **Layar F2** | System Readiness & Audit | `/system/readiness`<br>`/system/audit` | `Table`, `Sheet`, `Badge`, `Progress` | `GET /system-readiness`, `GET /audit-logs`, `GET /audit-logs/:id`, `GET /audit-logs/user/:user_id`, `GET /audit-logs/action/:action` |
| **Layar F3** | Data Health & Hub Settings | `/system/data-health`<br>`/settings` | `Switch`, `Form`, `Tabs`, `Toast` | `GET /data-freshness`, `POST /data-freshness/sync-poi`, `POST /data-freshness/sync-weather`, `GET /data-freshness/sync-history`, `GET /settings/system`, `PUT /settings/system`, `GET /settings/hub`, `PUT /settings/hub`, `GET /settings/basemap`, `PUT /settings/basemap`, `GET /settings/operational-rules`, `PUT /settings/operational-rules`, `POST /settings/operational-rules/re-evaluate` |

---

## 2. Arsitektur Antarmuka & UX Persona

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MANAGEMENT & SYSTEM GOVERNANCE PARADIGM                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🛡️ STRICT RBAC HIERARCHY GUARD: Role Management diblokir secara mutlak untuk membuat  │
│    atau mengedit akun Superadmin.                                                      │
│ 📈 PLAN VS ACTUAL CORRELATION: Mengukur secara matematis apakah zona dengan ranking    │
│    TOPSIS tertinggi benar-benar menghasilkan omzet penjualan lapangan tertinggi.       │
│ 🚦 8-SUBSYSTEM READINESS GATE: Indikator status lampu hijau/kuning/merah untuk 8       │
│    subsistem utama sebelum peluncuran operasional harian.                              │
│ 📄 ASYNC REPORT EXPORT: Unduh laporan format CSV / PDF dengan progress indikator.     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi TDD (Test-Driven Development)

### 3.1 Berkas Uji yang Wajib Dibuat (`tests/flow-06/`)
1. `tests/flow-06/fleetManagement.test.jsx`:
   - [x] Merender daftar armada gerobak kopi dan status operasional (`AVAILABLE`, `HELD`, `IN_USE`, `MAINTENANCE`).
   - [x] Mengubah status unit menjadi perawatan (*maintenance mode*) dan merilisnya kembali.
2. `tests/flow-06/productCatalog.test.jsx`:
   - [x] Menambah, memperbarui, dan menonaktifkan menu produk dengan Radix `Switch`.
3. `tests/flow-06/analyticsPlanVsActual.test.jsx`:
   - [x] Merender grafik kurva transaksi per jam dan perbandingan omzet *in-zone* vs *out-of-zone*.
   - [x] Menampilkan matriks korelasi *DSS Plan vs Actual*.
4. `tests/flow-06/reportsExport.test.jsx`:
   - [x] Memilih jenis laporan dan rentang tanggal filter.
   - [x] Memicu `GET /reports/export` dengan format CSV / PDF.
5. `tests/flow-06/userRbacGuard.test.jsx`:
   - [x] Memverifikasi role Management tidak memiliki akses tombol hapus Superadmin.
   - [x] Menguji form pembuatan user baru dengan role hierarchy validator.
6. `tests/flow-06/systemReadinessAudit.test.jsx`:
   - [x] Memverifikasi status kesiapan 8 subsistem MOVA.
   - [x] Merender log audit trail dengan perbandingan perubahan *before vs after*.

---

## 4. Rencana Implementasi Bertahap

```text
Langkah 1 (RED)   : Buat test suite di tests/flow-06/ mencakup RBAC guards, analitik, dan kesiapan sistem.
Langkah 2 (GREEN) : Bangun komponen Armada Grid, Produk POS, Recharts Analytics, User Form, dan Readiness Gauge.
Langkah 3 (VERIFY): Jalankan 'npx vitest run tests/flow-06/' dan pastikan 100% green.
Langkah 4 (REFACTOR): Optimalkan query deduplication dan lazy loading export PDF renderer.
```
