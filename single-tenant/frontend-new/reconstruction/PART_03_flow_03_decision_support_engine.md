# PART 03 — FLOW-03: DECISION SUPPORT SYSTEM (DSS) BWM-TOPSIS (LAYAR C1–C4)

> **Status Dokumen**: 🏛️ **FLOW-03 RECONSTRUCTION BLUEPRINT**  
> **Referensi SSOT**: [`MAPING_UI_UX.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/docs/MAPING_UI_UX.md) (Layar C1, C2, C3, C4)  
> **Prinsip Panduan**: [`radix-ui-design-system`](file:///f:/01_Projects/apps/mova-app/.agents/skills/radix-ui-design-system/SKILL.md), [`web-design-guidelines`](file:///f:/01_Projects/apps/mova-app/.agents/skills/web-design-guidelines/SKILL.md), [`ui-ux-pro-max`](file:///f:/01_Projects/apps/mova-app/.agents/skills/ui-ux-pro-max/SKILL.md), [`test-driven-development`](file:///f:/01_Projects/apps/mova-app/.agents/skills/test-driven-development/SKILL.md)

---

## 1. Lingkup & Sasaran Layar

Fase ini merekonstruksi inti kecerdasan keputusan (*Decision Intelligence*) sistem MOVA berbasis metode hibrida **BWM (Best-Worst Method) + TOPSIS (Technique for Order Preference by Similarity to Ideal Solution)**:

| Kode Layar | Nama Layar | Rute URL | Komponen Radix UI | Endpoint API Terintegrasi |
|---|---|---|---|---|
| **Layar C1** | DSS Evaluation Workspace | `/dss` | `Select`, `Checkbox`, `Accordion`, `Progress`, `Tooltip` | `POST /dss/evaluate`, `GET /dss/configs`, `GET /zones`, `GET /dss/explanation/:run_id` |
| **Layar C2** | What-If Sensitivity Simulator | `/dss/impact` | `Slider`, `Table`, `Badge`, `Tabs` | `POST /dss/preview-impact` |
| **Layar C3** | BWM Calibration & Solver | `/dss/configuration` | `Select`, `Table`, `Dialog`, `Alert` | `GET /dss/configs`, `POST /dss/calculate-bwm`, `POST /dss/save-config`, `PUT /dss/configs/:id/activate`, `DELETE /dss/configs/:id` |
| **Layar C4** | Decision Records & History | `/dss/history` | `Table`, `Sheet`, `Badge`, `Calendar` | `GET /dss/history`, `GET /dss/history/:id`, `GET /dss/history/zone/:zone_id` |

---

## 2. Arsitektur Antarmuka & UX Persona

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          DSS WORKSPACE & SOLVER PRINCIPLES                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🧠 DEKOMPOSISI KRITERIA TRANSPARAN: Menampilkan skor relatif Vi dan rincian kriteria   │
│    C1 (Densitas POI), C2 (Diversitas POI), C3 (Crowd Waktu), C4 (Cuaca & Akses Jalan), │
│    C5 (Jarak Tempuh), C6 (Penalti Kompetitor) secara manusiawi tanpa kode teknis UUID. │
│ 🎚️ WHAT-IF SIMULATOR: Menggunakan Radix Slider untuk menggeser persentase bobot        │
│    kriteria secara interaktif dan menampilkan tabel perbandingan ranking side-by-side. │
│ ⚖️ BWM CONSISTENCY GATE: Pengujian perbandingan berpasangan (Best-to-Others &         │
│    Others-to-Worst) mengunci tombol simpan jika Nilai Konsistensi CR > 0.10.           │
│ 📜 IMMUTABLE AUDIT TRAIL: Catatan keputusan historis tersimpan permanen sebagai        │
│    'Decision Record' untuk auditabilitas manajerial dan kepatuhan sistem.             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi TDD (Test-Driven Development)

### 3.1 Berkas Uji yang Wajib Dibuat (`tests/flow-03/`)
1. `tests/flow-03/dssEvaluation.test.jsx`:
   - [x] Memilih parameter slot waktu, zona aktif, dan konfigurasi bobot BWM aktif.
   - [x] Mengeksekusi `POST /dss/evaluate` dan merender tabel ranking TOPSIS ($V_i$).
   - [x] Menguji interaksi ekspansi Radix `Accordion` untuk dekomposisi kriteria $C_1-C_6$.
2. `tests/flow-03/whatIfSimulator.test.jsx`:
   - [x] Menggeser nilai Radix `Slider` bobot kriteria.
   - [x] Memanggil endpoint `POST /dss/preview-impact` (tanpa mutasi database produksi).
   - [x] Memverifikasi tampilan komparasi perubahan posisi ranking (Eksisting vs Skenario).
3. `tests/flow-03/bwmCalibration.test.jsx`:
   - [x] Memilih kriteria *Best* dan *Worst*.
   - [x] Menginput skala perbandingan berpasangan (1–9).
   - [x] Memvalidasi kalkulasi LP solver BWM dan nilai *Consistency Ratio* ($CR$).
   - [x] Memastikan tombol simpan berstatus *disabled* dengan pesan peringatan jika $CR > 0.10$.
4. `tests/flow-03/dssHistory.test.jsx`:
   - [x] Merender riwayat eksekusi evaluasi DSS dengan filter tanggal.
   - [x] Membuka Radix `Sheet` saat salah satu baris riwayat diklik.

---

## 4. Rencana Implementasi Bertahap

```text
Langkah 1 (RED)   : Buat unit tests di tests/flow-03/ dengan skenario solver BWM (CR <= 0.10 vs CR > 0.10) & TOPSIS.
Langkah 2 (GREEN) : Bangun komponen DSS Workspace, What-If Simulator, Form BWM Solver, dan History Drawer.
Langkah 3 (VERIFY): Jalankan 'npx vitest run tests/flow-03/' dan pastikan 100% green.
Langkah 4 (REFACTOR): Optimalkan debouncing kalkulasi slider simulator & format angka desimal.
```
