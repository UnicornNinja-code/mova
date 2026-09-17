# PART 05 — FLOW-05: PENGALAMAN LAPANGAN RIDER MOBILE PWA (LAYAR G1–G3)

> **Status Dokumen**: 🏛️ **FLOW-05 RECONSTRUCTION BLUEPRINT**  
> **Referensi SSOT**: [`MAPING_UI_UX.md`](file:///f:/01_Projects/apps/mova-app/mova_app/single-tenant/frontend/docs/MAPING_UI_UX.md) (Layar G1, G2, G3 & Mobile PWA Guidelines)  
> **Prinsip Panduan**: [`radix-ui-design-system`](file:///f:/01_Projects/apps/mova-app/.agents/skills/radix-ui-design-system/SKILL.md), [`web-design-guidelines`](file:///f:/01_Projects/apps/mova-app/.agents/skills/web-design-guidelines/SKILL.md), [`ui-ux-pro-max`](file:///f:/01_Projects/apps/mova-app/.agents/skills/ui-ux-pro-max/SKILL.md), [`test-driven-development`](file:///f:/01_Projects/apps/mova-app/.agents/skills/test-driven-development/SKILL.md)

---

## 1. Lingkup & Sasaran Layar

Fase ini merekonstruksi antarmuka *Mobile PWA* khusus peran **Rider** untuk menjalankan seluruh siklus operasional harian di lapangan:

| Kode Layar | Nama Layar | Rute URL | Komponen Radix UI | Endpoint API Terintegrasi |
|---|---|---|---|---|
| **Layar G1** | Rider Mobile Command | `/rider` | `Card`, `Badge`, `Button`, `Progress` | `GET /rider-operational/active-session`, `GET /rider-operational/duty-status`, `POST /rider-operational/confirm-availability`, `GET /rider-operational/my-zone` |
| **Layar G2** | Fleet Hold & Geo Check-in | `/rider/armada`<br>`/rider/check-in` | `Dialog`, `Progress`, `Alert`, `Button` | `GET /rider-operational/available-armada`, `POST /rider-operational/reserve-armada`, `POST /rider-operational/claim-armada`, `POST /rider-operational/cancel-reservation`, `POST /rider-operational/check-in` |
| **Layar G3** | Spot Lock, POS & Settlement | `/rider/selling`<br>`/rider/checkout` | `Card`, `Dialog`, `Button`, `Toast`, `ScrollArea` | `GET /rider-operational/candidate-spots`, `POST /rider-operational/lock-spot`, `GET /products`, `POST /rider-operational/record-sale`, `GET /rider-operational/my-sales`, `GET /rider-operational/checkout-summary`, `POST /rider-operational/checkout`, `POST /rider-operational/release-armada` |

---

## 2. Arsitektur Antarmuka & UX Persona

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         RIDER MOBILE PWA ERGONOMIC PARADIGM                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 📱 MOBILE-FIRST & TOUCH TARGET: Seluruh tombol interaksi memiliki dimensi >= 44x44 px. │
│ 🎯 ONE DECISION PER SCREEN: Antarmuka terpandu langkah demi langkah (Step-by-Step).     │
│ ⏱️ 5-MINUTE ARMADA HOLD: Kunci reservasi unit sementara 5 menit dengan countdown timer │
│    interaktif sebelum konfirmasi klaim fisik.                                         │
│ 📍 PROXIMITY GEOFENCE CHECK-IN: Visualisasi jarak meter aktual ke poligon zona target. │
│ ☕ QUICK POS CART: Kasir satu sentuhan (One-tap POS), tombol + / - instan, dan slip   │
│    rekonsiliasi omzet akhir shift sebelum pengembalian unit armada.                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi TDD (Test-Driven Development)

### 3.1 Berkas Uji yang Wajib Dibuat (`tests/flow-05/`)
1. `tests/flow-05/riderShiftStarter.test.jsx`:
   - [x] Merender status sesi aktif rider, informasi zona alokasi, dan briefing cuaca.
   - [x] Menjalankan fungsi konfirmasi kesiapan shift `POST /rider-operational/confirm-availability`.
2. `tests/flow-05/armadaHoldClaim.test.jsx`:
   - [x] Memilih unit armada yang tersedia dan mengunci sementara via `POST /rider-operational/reserve-armada`.
   - [x] Memvalidasi *countdown timer* 5 menit (300 detik).
   - [x] Mengeksekusi klaim permanen `POST /rider-operational/claim-armada` atau pembatalan reservasi.
3. `tests/flow-05/geofenceCheckIn.test.jsx`:
   - [x] Membaca koordinat geolokasi browser rider.
   - [x] Menampilkan status di luar batas zona jika jarak $> 0\text{ meter}$.
   - [x] Mengizinkan tombol check-in saat rider berada di dalam area poligon zona.
4. `tests/flow-05/riderPosSelling.test.jsx`:
   - [x] Mengunci titik jualan mikro via `POST /rider-operational/lock-spot`.
   - [x] Merender katalog menu produk dengan kontrol kuantitas cepat.
   - [x] Menyimpan transaksi kasir `POST /rider-operational/record-sale` dan memperbarui ringkasan omzet.
   - [x] Mengeksekusi checkout akhir shift dan pelepasan armada `POST /rider-operational/release-armada`.

---

## 4. Rencana Implementasi Bertahap

```text
Langkah 1 (RED)   : Buat test suite di tests/flow-05/ mencakup siklus hidup shift rider lapangan.
Langkah 2 (GREEN) : Bangun komponen Shift Card, Countdown Timer Hook, Geofence Radius Gauge, POS Cart, dan Settlement Modal.
Langkah 3 (VERIFY): Jalankan 'npx vitest run tests/flow-05/' dan pastikan 100% lulus.
Langkah 4 (REFACTOR): Optimalkan offline service worker caching & feedback sentuhan haptic PWA.
```
