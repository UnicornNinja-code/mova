# PART 07 — INTEGRASI E2E, AUDIT AKSESIBILITAS & VERIFIKASI AKHIR

> **Status Dokumen**: 🏛️ **E2E VERIFICATION & ACCEPTANCE BLUEPRINT**  
> **Referensi SSOT**: [`MAPING_UI_UX.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/docs/MAPING_UI_UX.md) (End-to-End Operational Lifecycle)  
> **Prinsip Panduan**: [`radix-ui-design-system`](file:///f:/01_Projects/apps/mova-app/.agents/skills/radix-ui-design-system/SKILL.md), [`web-design-guidelines`](file:///f:/01_Projects/apps/mova-app/.agents/skills/web-design-guidelines/SKILL.md), [`ui-ux-pro-max`](file:///f:/01_Projects/apps/mova-app/.agents/skills/ui-ux-pro-max/SKILL.md), [`test-driven-development`](file:///f:/01_Projects/apps/mova-app/.agents/skills/test-driven-development/SKILL.md)

---

## 1. Tujuan Verifikasi Sistem

Memastikan seluruh **26 Layar Logis** dan **167 Endpoint REST API** yang telah diimplementasikan dari `PART_00` hingga `PART_06` berfungsi secara harmonis, bebas dari regresi, memenuhi standar aksesibilitas WCAG 2.1 AA, dan tahan uji dalam skenario operasional lapangan nyata.

---

## 2. Rangkaian Pengujian End-to-End (Playwright)

### 2.1 E2E Skenario 1 — Siklus Lengkap Shift Rider Lapangan (`e2e/riderLifecycle.spec.js`)
* **Langkah 1**: Login sebagai Rider pada viewport Mobile PWA ($375\times667\text{ px}$).
* **Langkah 2**: Konfirmasi kesiapan shift dan masuk ke antrean reservasi armada.
* **Langkah 3**: Pilih unit armada gerobak kopi $\to$ kunci sementara 5 menit $\to$ klaim armada.
* **Langkah 4**: Simulasi perpindahan GPS mendekati zona target $\to$ eksekusi geofence check-in.
* **Langkah 5**: Kunci titik jualan mikro (*Spot Lock*) $\to$ catat 3 transaksi penjualan kopi di kasir POS.
* **Langkah 6**: Eksekusi rekonsiliasi checkout akhir shift $\to$ rilis armada $\to$ verifikasi status sesi *COMPLETED*.

### 2.2 E2E Skenario 2 — Field Control, Prakiraan Cuaca & FIFO Dispatch (`e2e/supervisorDispatch.spec.js`)
* **Langkah 1**: Login sebagai Supervisor pada viewport Desktop ($1440\times900\text{ px}$).
* **Langkah 2**: Buka layar `/operations/weather` $\to$ verifikasi timeline cuaca per jam dan risiko hujan zona target.
* **Langkah 3**: Buka layar `/distribution` $\to$ tinjau antrean FIFO rider standby $\to$ jalankan *Auto-Assign TOPSIS*.
* **Langkah 4**: Buka layar `/operations/live` $\to$ verifikasi posisi marker GPS rider dan deteksi deviasi geofence.

### 2.3 E2E Skenario 3 — BWM Solver, Simulasi What-If & Tata Kelola Zona (`e2e/superadminDss.spec.js`)
* **Langkah 1**: Login sebagai Superadmin $\to$ buka layar `/dss/configuration`.
* **Langkah 2**: Input perbandingan berpasangan BWM dengan $CR \le 0.10$ $\to$ simpan konfigurasi bobot.
* **Langkah 3**: Buka layar `/dss/impact` $\to$ geser slider simulasi What-If $\to$ verifikasi perbandingan ranking.
* **Langkah 4**: Buka layar `/zones` $\to$ gambar poligon baru dengan validasi PostGIS bebas tumpang tindih (*overlap*).

---

## 3. Standar Audit Aksesibilitas (WCAG 2.1 AA)

Pengujian otomatis menggunakan `@axe-core/playwright`:
- [x] **Color Contrast**: Rasio kontras teks utama terhadap background minimal $4.5:1$.
- [x] **Focus Indicators**: Seluruh elemen interaktif Radix memiliki *visible focus ring* (`focus-visible:ring-2`).
- [x] **Keyboard Ergonomics**: Navigasi lengkap tanpa mouse menggunakan tombol `Tab`, `Shift+Tab`, `Arrow Keys`, `Enter`, dan `Escape`.
- [x] **Touch Target**: Minimal $44\times44\text{ px}$ pada seluruh tombol di viewport mobile PWA Rider.
- [x] **Form Labels**: Seluruh input form memiliki tag `<label>` yang terikat secara semantik.

---

## 4. Tolok Ukur Kinerja (*Performance Benchmarks*)

| Metrik Kinerja | Target Standar | Metode Validasi |
|---|---|---|
| **First Contentful Paint (FCP)** | $< 1.2\text{ detik}$ | Lighthouse Audit / Web Vitals |
| **Largest Contentful Paint (LCP)** | $< 2.0\text{ detik}$ | Code-splitting `React.lazy()` pada modul peta |
| **Cumulative Layout Shift (CLS)** | $< 0.05$ | Reservasi ruang skeleton loading prediktif |
| **Memory Leak Protection** | $0\text{ memory leak}$ | Profiling streaming polling LBS 30 detik pada Chrome DevTools |

---

## 5. Definition of Done (DoD) Checklist

- [ ] Seluruh unit & component tests lulus 100% (`vitest run`).
- [ ] Seluruh skenario pengujian E2E lulus 100% (`playwright test`).
- [ ] Nol pelanggaran aksesibilitas kritis pada audit Axe-core.
- [ ] 26 Layar logis terhubung ke backend tanpa *orphan endpoint*.
- [ ] Build produksi frontend sukses tanpa error atau peringatan linting (`npm run build`).
