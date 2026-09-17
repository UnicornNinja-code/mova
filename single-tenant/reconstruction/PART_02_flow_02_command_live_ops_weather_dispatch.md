# PART 02 — FLOW-02: FIELD CONTROL, TELEMETRI GIS, CUACA & DISPATCH (LAYAR B1–B4)

> **Status Dokumen**: 🏛️ **FLOW-02 RECONSTRUCTION BLUEPRINT**  
> **Referensi SSOT**: [`MAPING_UI_UX.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/docs/MAPING_UI_UX.md) (Layar B1, B2, B3, B4)  
> **Prinsip Panduan**: [`radix-ui-design-system`](file:///f:/01_Projects/apps/mova-app/.agents/skills/radix-ui-design-system/SKILL.md), [`web-design-guidelines`](file:///f:/01_Projects/apps/mova-app/.agents/skills/web-design-guidelines/SKILL.md), [`ui-ux-pro-max`](file:///f:/01_Projects/apps/mova-app/.agents/skills/ui-ux-pro-max/SKILL.md), [`test-driven-development`](file:///f:/01_Projects/apps/mova-app/.agents/skills/test-driven-development/SKILL.md)

---

## 1. Lingkup & Sasaran Layar

Fase ini merekonstruksi modul kendali operasional lapangan utama (*Field Control Room*) untuk Supervisor dan Manajemen:

| Kode Layar | Nama Layar | Rute URL | Komponen Radix UI | Endpoint API Terintegrasi |
|---|---|---|---|---|
| **Layar B1** | Command Center KPI | `/dashboard` | `Tabs`, `Card`, `Badge`, `ScrollArea`, `Tooltip` | `GET /dashboard/overview`, `GET /dashboard/summary`, `GET /dashboard/quick-alerts`, `GET /analytics/overview` |
| **Layar B2** | Live Operations GIS | `/operations/live` | `Sheet` (Slide-over), `ToggleGroup`, `Badge`, `Slider` | `GET /lbs/riders/live`, `GET /lbs/zone-logs`, `GET /lbs/zones-distance-summary`, `GET /dashboard/quick-alerts` |
| **Layar B3** | Operational Weather Forecast | `/operations/weather` | `Tabs`, `Select`, `Card`, `Badge`, `Progress`, `Tooltip` | `GET /weather/current`, `GET /weather/zone/:zone_id`, `GET /weather/zone/:zone_id/timeline`, `GET /weather/zone/:zone_id/c4`, `GET /weather/hub/:city_name`, `POST /weather/sync`, `GET /zones` |
| **Layar B4** | Distribution & FIFO Board | `/distribution`<br>`/distribution/runs/:id` | `Dialog`, `AlertDialog`, `Table`, `Badge`, `Progress` | `GET /distribution/status`, `GET /distribution/queue`, `POST /distribution/auto-assign`, `POST /distribution/manual-assign`, `GET /distribution/runs`, `GET /distribution/runs/:id` |

---

## 2. Arsitektur Antarmuka & UX Persona

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          MAPOPS & OPERATIONAL UX PARADIGM                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🗺️ MAP-FIRST: Leaflet GIS Map mengambil 100% tinggi ruang kerja (/operations/live).    │
│ 📋 PANEL-SECOND: Detail rider, log transisi geofence, & metrik cuaca muncul via Sheet │
│    Radix tanpa menutup kanvas peta utama.                                              │
│ 📊 TABLE-THIRD: Tabel ringkasan armada/topsis diletakkan pada tab sekunder.            │
│ 🌤️ PREDICTIVE WEATHER (06:00-21:00 WIB): Visualisasi risiko hujan & penalti C4 pada 4 │
│    slot waktu untuk mendukung tindakan mitigasi dini sebelum hujan turun.              │
│ ⚡ FIFO DISPATCH: Antrean antarmuka dua kolom (Waiting Queue vs Zone Capacity) dengan  │
│    tombol eksekusi 'Auto-Assign TOPSIS' & tombol override manual yang aman.           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi TDD (Test-Driven Development)

### 3.1 Berkas Uji yang Wajib Dibuat (`tests/flow-02/`)
1. `tests/flow-02/commandCenterDashboard.test.jsx`:
   - [x] Merender kartu metrik utama (Active Riders, Fleet Utilization, Revenue, Compliance Rate).
   - [x] Menampilkan widget *Quick Alerts* (Rider di luar zona, Peringatan Hujan).
   - [x] Menguji pergantian filter tanggal dan tab performa operasional.
2. `tests/flow-02/liveOperationsMap.test.jsx`:
   - [x] Merender layer peta poligon zona dan marker GPS rider.
   - [x] Menguji mekanisme polling telemetri otomatis interval 30 detik.
   - [x] Membuka Radix `Sheet` detail saat marker rider diklik.
   - [x] Memvalidasi status warna marker (Hijau, Kuning, Merah, Abu-abu).
3. `tests/flow-02/weatherForecast.test.jsx`:
   - [x] Merender timeline per jam (06:00–21:00 WIB) per zona dengan WMO weather code.
   - [x] Memvalidasi kalkulasi skor penalti $C_4$ pada 4 slot waktu (Pagi, Siang, Sore, Malam).
   - [x] Menguji tombol pemicu `POST /weather/sync` (Open-Meteo) dengan status loading/toast.
4. `tests/flow-02/distributionDispatch.test.jsx`:
   - [x] Merender daftar antrean FIFO rider standby dan persentase kapasitas zona.
   - [x] Menjalankan fungsi `POST /distribution/auto-assign` (TOPSIS Engine).
   - [x] Memicu Radix `Dialog` saat supervisor memilih *Manual Override*.
   - [x] Memvalidasi halaman riwayat run `/distribution/runs/:id`.

---

## 4. Rencana Implementasi Bertahap

```text
Langkah 1 (RED)   : Tulis file pengujian di tests/flow-02/ dengan mock MSW LBS, Weather & Distribution.
Langkah 2 (GREEN) : Implementasikan komponen Dashboard, Leaflet LiveOps, Weather Matrix, dan FIFO Board.
Langkah 3 (VERIFY): Jalankan 'npx vitest run tests/flow-02/' dan pastikan seluruh test lulus.
Langkah 4 (REFACTOR): Optimalkan rendering marker Leaflet (Leaflet Canvas/CanvasMarkers) & cache query.
```
