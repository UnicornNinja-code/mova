# PART 04 — FLOW-04: TATA KELOLA SPASIAL, POI & MARKET INTELLIGENCE (LAYAR D1–D4)

> **Status Dokumen**: 🏛️ **FLOW-04 RECONSTRUCTION BLUEPRINT**  
> **Referensi SSOT**: [`MAPING_UI_UX.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/docs/MAPING_UI_UX.md) (Layar D1, D2, D3, D4)  
> **Prinsip Panduan**: [`radix-ui-design-system`](file:///f:/01_Projects/apps/mova-app/.agents/skills/radix-ui-design-system/SKILL.md), [`web-design-guidelines`](file:///f:/01_Projects/apps/mova-app/.agents/skills/web-design-guidelines/SKILL.md), [`ui-ux-pro-max`](file:///f:/01_Projects/apps/mova-app/.agents/skills/ui-ux-pro-max/SKILL.md), [`test-driven-development`](file:///f:/01_Projects/apps/mova-app/.agents/skills/test-driven-development/SKILL.md)

---

## 1. Lingkup & Sasaran Layar

Fase ini merekonstruksi lapisan kecerdasan geografis (*Geographic Intelligence*) mencakup tata kelola poligon zona PostGIS, klaster titik jualan mikro, POI crowdsourcing, dan analisis kompetitor:

| Kode Layar | Nama Layar | Rute URL | Komponen Radix UI | Endpoint API Terintegrasi |
|---|---|---|---|---|
| **Layar D1** | Zone Master & Polygon Editor | `/zones` | `Dialog`, `Form`, `Slider`, `AlertDialog` | `GET /zones`, `POST /zones/validate`, `POST /zones`, `GET /zones/:id`, `PUT /zones/:id`, `DELETE /zones/:id`, `PATCH /zones/:id/status`, `PATCH /zones/:id/capacity`, `GET /zones/config` |
| **Layar D2** | Candidate Selling Spots | `/locations` | `Select`, `Card`, `Badge`, `Accordion` | `POST /candidate-locations/generate`, `GET /candidate-locations`, `GET /candidate-locations/:id`, `POST /candidate-locations/evaluate`, `GET /candidate-locations/explanation/:id`, `GET /candidate-locations/audit/:id` |
| **Layar D3** | POI Master & C3 Crowd Matrix | `/poi` | `Tabs`, `Table`, `Dialog`, `Select`, `Input` | `GET /pois/stats`, `GET /pois/categories`, `GET /pois/zone-density`, `GET /pois/operational-area`, `GET /pois/pending`, `POST /pois/approve`, `POST /pois/reject`, `POST /pois/sync-city`, `GET /poi-categories/crowd-scores`, `PUT /poi-categories/crowd-scores` |
| **Layar D4** | Market Competitors & Roads | `/market/competitors`<br>`/spatial/roads` | `Tabs`, `Table`, `Sheet`, `Badge` | `GET /competitors/zone/:zone_id`, `GET /competitors/score/:zone_id`, `POST /competitors`, `DELETE /competitors/:id`, `GET /road-network/protocol-roads`, `GET /road-network/toll-roads`, `GET /road-network/zone-accessibility/:zone_id` |

---

## 2. Arsitektur Antarmuka & UX Persona

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        GEOGRAPHIC INTELLIGENCE WORKSPACE                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 📐 POSTGIS DRY-RUN VALIDATION: Form pembuatan zona memicu 'POST /zones/validate'       │
│    secara real-time untuk memeriksa self-intersection, overlap poligon, dan boundary. │
│ 📍 SPOT DISCOVERY: Visualisasi klaster titik potensial jualan mikro di dalam poligon.  │
│ 🏬 58-CATEGORY C3 CROWD MATRIX: Editor matriks bobot keramaian pada 4 slot waktu       │
│    (Pagi, Siang, Sore, Malam skala 1-5) dengan fungsi bulk update instan.              │
│ ☕ COMPETITOR & ROAD ACCESS: Pemantauan kompetitor gerobak kopi dan penalti densitas   │
│    (C6) serta visualisasi layer pelarangan jalan protokol/tol (C4).                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi TDD (Test-Driven Development)

### 3.1 Berkas Uji yang Wajib Dibuat (`tests/flow-04/`)
1. `tests/flow-04/zoneMasterEditor.test.jsx`:
   - [x] Merender daftar zona PostGIS beserta batas kuota kapasitas armada.
   - [x] Menguji alur pembuatan poligon zona baru dengan validasi `POST /zones/validate`.
   - [x] Mengunci tombol submit jika poligon terdeteksi tumpang tindih (*overlap*).
   - [x] Memicu Radix `AlertDialog` pada aksi hapus atau penonaktifan status zona.
2. `tests/flow-04/candidateSpotsDiscovery.test.jsx`:
   - [x] Memicu tombol 'Generate Candidates' untuk membangkitkan spot jualan di zona aktif.
   - [x] Merender evaluasi TOPSIS level spot dan penjelasan kriteria kesesuaian lokasi.
3. `tests/flow-04/poiMasterCrowdMatrix.test.jsx`:
   - [x] Merender 3 tab POI (Overview Stats, Moderation Queue, C3 Crowd Matrix).
   - [x] Menguji aksi moderasi persetujuan/penolakan POI pending usulan.
   - [x] Mengedit nilai skor keramaian matriks 58 kategori dan mengeksekusi bulk update `PUT /poi-categories/crowd-scores`.
4. `tests/flow-04/marketCompetitorRoads.test.jsx`:
   - [x] Menambah data survei kompetitor lapangan via Radix `Sheet`.
   - [x] Memvalidasi kalkulasi penalti kriteria $C_6$.
   - [x] Memverifikasi rendering layer jalan protokol dan restriksi tol.

---

## 4. Rencana Implementasi Bertahap

```text
Langkah 1 (RED)   : Buat skenario pengujian di tests/flow-04/ untuk validasi poligon, moderasi POI, & matriks C3.
Langkah 2 (GREEN) : Bangun Leaflet Zone Drawer, Spot Discovery Panel, POI Tabs Table, dan Competitor Sheet.
Langkah 3 (VERIFY): Jalankan 'npx vitest run tests/flow-04/' dan pastikan 100% green.
Langkah 4 (REFACTOR): Optimalkan payload poligon GeoJSON dan caching data kategori POI.
```
