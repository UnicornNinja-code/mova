# Checklist Backlog Sistem MOVA Single Tenant
## Alur Eksekusi: Sequential Strict (Backend Ready First & Optimized -> Frontend Structured Blueprint -> E2E Deployment)

Dokumen ini memetakan seluruh daftar pekerjaan, checklist pengembangan fitur, serta tahapan audit sistem MOVA Single Tenant dalam bahasa yang sederhana, praktis, dan operasional, merujuk langsung pada [e2e_implementation_roadmap.md](file:///d:/project/mova-new/mova/single-tenant/docs/e2e_implementation_roadmap.md).

### Keterangan Status:
- ✅ : **Selesai** (fitur, perbaikan, atau audit telah selesai diimplementasikan dan diverifikasi)
- 🔄 : **Dalam Pengerjaan** (sedang berlangsung atau butuh penyempurnaan)
- 📋 : **Belum Dikerjakan** (siap masuk antrean eksekusi)

---

# 🚀 TAHAP 1: BACKEND 100% READY, OPTIMIZED & DOCUMENTED

> **Prinsip**: Seluruh endpoint API, skema database, indeks PostGIS/SQL, pengujian keamanan, dan dokumentasi OpenAPI 3.0 diselesaikan tuntas sebelum frontend dibangun.

---

### A. Core Auth, Kontrol Akses (RBAC) & Keamanan Sesi
1. ✅ **Pengamanan Perubahan Role dan Jabatan User**
   - Menaikkan versi token autentikasi pengguna saat role diubah sehingga sesi lama langsung batal seketika.
2. ✅ **Penanganan Refresh Token dan Pemulihan Sesi**
   - Penyelarasan refresh token dengan cookie HTTP-only dan sesi Redis agar tidak logout mendadak saat refresh browser.
3. ✅ **Penguncian Header Pengujian di Production**
   - Header `x-test-suite` dan `x-bypass-captcha` dikunci total pada mode production.
4. ✅ **Standarisasi Respons Token Kadaluarsa (RFC 6750)**
   - Token expired mengembalikan HTTP 401 dengan indikator `TOKEN_EXPIRED` untuk memicu silent refresh otomatis.
5. ✅ **Penyamaran Pesan Error Database di Lingkungan Produksi**
   - Pesan error internal PostgreSQL dimasking agar tidak membocorkan nama tabel atau struktur kolom.
6. 📋 **Audit & Pengujian Eskalasi Hak Akses (RBAC & BOLA)**
   - Akun RIDER atau SUPERVISOR ditolak dengan HTTP 403 Forbidden saat mencoba mengakses endpoint konfigurasi sistem atau memodifikasi akun lain.
7. 📋 **Audit & Pengujian Pembatalan Sesi Instan (Token Versioning)**
   - Validasi bahwa perubahan versi token di database langsung menggagalkan request berikutnya dari token lama.

### B. Validasi Ingestion Spasial & External API Resilience
1. ✅ **Konfigurasi Tunggal Batas Wilayah Operasional**
   - Penetapan variabel terpusat untuk batas koordinat resmi wilayah kerja Kabupaten Sidoarjo.
2. ✅ **Endpoint Informasi Wilayah Operasional**
   - Penyediaan endpoint `/api/system/operational-scope` untuk membaca batas wilayah aktif.
3. ✅ **Penyaringan Spasial Dua Lapis pada Ingestion OSM**
   - Query Overpass dan backend membuang seluruh data POI dan jalan di luar batas resmi Sidoarjo.
4. 📋 **Uji Ketahanan Batas Wilayah Ingestion (Spatial Scope Guard)**
   - Simulasi penarikan koordinat luar wilayah (misal Surabaya/Mojokerto) untuk memastikan data otomatis dibuang.
5. 📋 **Penanganan Timeout dan Retry External API**
   - Mekanisme retry bertahap (exponential backoff) pada API Overpass & Open-Meteo dengan timeout 3 menit dan pencatatan riwayat di `data_sync_runs`.
6. 📋 **Deduplikasi Entitas POI 15 Meter**
   - Pengecekan PostGIS `ST_DWithin` 15 meter agar penarikan data baru tidak menghasilkan entitas duplikat di database.

### C. Komputasi Geometri PostGIS, Topologi Zona & Buffer Pembatasan
1. ✅ **Penyatuan Segmen Jalan Bernama Sama (PostGIS LineString)**
   - Penggabungan potongan ruas jalan bernama sama menggunakan `ST_LineMerge` dan `ST_Dump` menjadi satu garis kontinu.
2. ✅ **Penanganan Ruas Jalan Tanpa Nama**
   - Pemberian label default *Ruas Jalan Tanpa Nama* dan *Ruas Jalan Tol* dengan geometri asli tetap utuh.
3. 📋 **Validasi Topologi Poligon Zona Makro**
   - Penolakan poligon zona yang bersilangan sendiri (*self-intersecting*) atau memiliki luas di luar batas 1.000 m² – 5.000.000 m².
4. 📋 **Proteksi Buffer 10 Meter Titik Mikro vs Jalan Terlarang**
   - Titik jualan mikro otomatis ditolak (`REJECTED`) jika berada dalam radius $\le 10\text{ m}$ dari jalan protokol atau jalan tol terlarang.
5. 📋 **Pencegahan Duplikasi Titik Mikro dalam Zona**
   - Penolakan titik mikro baru yang berjarak $< 5\text{ m}$ dari titik mikro yang sudah ada di zona yang sama.

### D. Mesin Analisis Keputusan DSS (BWM & TOPSIS)
1. 📋 **Solver Pemrograman Linier BWM (javascript-lp-solver)**
   - Perhitungan bobot optimal kriteria non-negatif ($\sum w_j = 1.0$) dan Consistency Ratio (CR) akurat pada matriks inkonsistensi ekstrem.
2. 📋 **Pencegahan Pembagian dengan Nol pada Normalisasi TOPSIS**
   - Mesin normalisasi vektor menangani penyebut nol ($\sqrt{\sum x_{ij}^2} = 0$) secara aman tanpa menghasilkan nilai `NaN` atau server crash.
3. 📋 **Proteksi Rekayasa Bobot & Ranking dari Klien (Anti-Tampering)**
   - Backend mengabaikan ranking/bobot buatan dari body request dan selalu melakukan kalkulasi independen di server.
4. 📋 **Immutability Snapshot Riwayat Evaluasi DSS**
   - Tabel `dss_histories` dan snapshot evaluasi dikunci agar menolak modifikasi/penghapusan data (*read-only audit trail*).

### E. Transaksi Operasional Armada, Sesi Kerja, Kasir POS & Real-Time LBS
1. 📋 **Pencegahan Kondisi Balapan (Race Condition) pada Alokasi Armada**
   - Transaksi database ber-isolasi `SERIALIZABLE` / `SELECT ... FOR UPDATE` untuk mencegah rider dialokasikan ke lebih dari satu zona secara bersamaan.
2. 📋 **State Machine Sesi Operasional Harian**
   - Transisi status sesi wajib berurutan: `CREATED` $\rightarrow$ `CHECKED_IN` $\rightarrow$ `ACTIVE` $\rightarrow$ `COMPLETED` (maksimal 1 sesi aktif per rider).
3. 📋 **Integritas Harga Penjualan Ritel Kasir (sales_logs)**
   - Backend selalu mengunci harga satuan (`unit_price`) dari master tabel `products` di server saat pencatatan transaksi penjualan.
4. 📋 **Proteksi Penghapusan Produk (Product Delete Guard)**
   - Penolakan penghapusan permanen produk (HTTP 409 Conflict) jika produk memiliki riwayat transaksi penjualan.
5. 📋 **Isolasi Ruangan WebSocket Socket.io (Room Segregation)**
   - Server menolak socket client akun RIDER yang mencoba mendengarkan room pimpinan (`management_room`/`supervisors_room`).
6. 📋 **Pencegahan Pemalsuan Koordinat GPS (GPS Spoofing & Identity Guard)**
   - Koordinat telemetri diikat hanya ke `user.id` dari token handshake JWT, mengabaikan `rider_id` palsu pada payload.
7. 📋 **Deterministik Status Kepatuhan LBS PostGIS**
   - Server PostGIS menghitung posisi rider terhadap zona tugas: `COMPLIANT`, `DEVIATED`, atau `OUTSIDE_ZONE` dan memicu alert jika menyimpang.

### F. Background Workers (BullMQ) & Resilience
1. 📋 **Ketahanan dari Racun Antrean (Queue Poisoning & Worker Crash)**
   - Penanganan error aman pada worker penarikan data dan pengalihan job korup ke Dead Letter Queue (DLQ) tanpa mematikan proses daemon.
2. 📋 **Pelepasan Otomatis Masa Tahanan Armada (Armada Hold Auto-Release)**
   - Worker terjadwal secara otomatis mengembalikan armada berstatus `HELD` menjadi `AVAILABLE` saat melewati waktu `release_at`.
3. 📋 **Pencatatan Provenance Siklus ETL di data_sync_runs**
   - Pencatatan status akhir, durasi waktu komputasi, dan jumlah baris data yang diproses pada setiap eksekusi worker.

### G. Optimasi Query SQL, Indeks Database & Dokumentasi OpenAPI
1. 📋 **Pembuatan Indeks B-Tree & Spasial PostGIS GIST**
   - Pemasangan indeks spasial `GIST` pada kolom `geom` tabel `roads`, `pois`, `zones`, `candidate_selling_locations`, `competitor_locations`.
   - Pemasangan indeks `B-Tree` & composite pada tabel `users`, `operational_sessions`, `sales_logs`, `audit_logs`.
2. 📋 **Deep Query Profiling (EXPLAIN ANALYZE)**
   - Benchmarking query spasial dan agregasi data terberat sistem untuk menjamin query menggunakan *Index Scan*.
3. 📋 **Dokumentasi Lengkap OpenAPI 3.0 / Swagger UI**
   - Seluruh endpoint API (100%) terdokumentasi rapi di `docs/openapi.yaml` dan dapat diuji langsung via Swagger UI.

---

# 🖥️ TAHAP 2: FRONTEND 100% READY (REFACTOR IKON & 8 PRIORITAS HALAMAN)

> **Prinsip**: Dibangun setelah seluruh API Backend Tahap 1 berstatus 100% siap dan terdokumentasi. Menggunakan sistem ikon semantik terpusat dan komponen tabel universal dengan auto-sorting.

---

### A. Pondasi: Refactor Sistem Ikon Semantik & Universal UI Primitives
1. 📋 **Pusat Ikon Semantik (`frontend/src/components/icons/index.js`)**
   - Membungkus paket `lucide-react` ke dalam token semantik (`UserIcon`, `PoiIcon`, `DssIcon`, `ZoneIcon`, `FleetIcon`, `MapOpsIcon`, `SortAscIcon`, dll.) dengan ukuran dan ketebalan garis seragam (1.75px).
2. 📋 **Komponen Tabel Universal (`DataTable.jsx`)**
   - Standardisasi seluruh tabel dengan fitur sortir otomatis naik/turun (**Auto-Sort ASC/DESC**), pagination terpadu, responsive sticky header, dan skeleton loading.
3. 📋 **Komponen Universal Drawer, Modal & Badges**
   - `DetailDrawer` animasi halus dengan backdrop blur, `ActionModal` dialog konfirmasi, dan `StatusBadge` warna semantik.

### B. Prioritas 1: Halaman Manajemen Pengguna & Role (`/admin/users`)
1. ✅ **Penyesuaian Posisi Menu Aksi Titik Tiga pada Tabel Pengguna**
   - Menu aksi titik tiga di baris bawah otomatis membuka ke atas agar tidak terpotong layar.
2. ✅ **Halaman Profil Pengguna & Ketahanan Sesi Refresh**
   - Halaman profil mandiri untuk melihat akun, ganti password, dan auto-refresh token saat browser di-refresh.
3. 📋 **Integrasi DataTable Auto-Sort & Drawer Profil Pengguna Lengkap**
   - Tabel pengguna dengan pencarian instan, filter role/status, form tambah user tervalidasi Zod, dan drawer detail user dengan tombol aksi *Force Logout (Bump Token Version)*.

### C. Prioritas 2: Halaman Master Data Suite (`/data/pois`, `/data/roads`, `/data/competitors`)
1. ✅ **Fitur Inti Master Data POI, Cuaca & Pembatasan Jalan**
   - Tabel POI dengan filter kategori, layout peta horizontal jalan protokol/tol dengan batas tunggu sinkronisasi 3 menit, panel 3 kolom ringkasan jalan, dan kartu toggle cuaca.
2. 📋 **Penataan Ulang Layout Halaman POI & Visualisasi Mini-Map Drawer**
   - Pembaruan antarmuka data titik keramaian dengan drawer detail yang memuat **Peta Mini Leaflet** untuk preview visual titik koordinat.
3. 📋 **Halaman Analisis dan Monitoring Survei Kompetitor**
   - Antarmuka visual untuk memetakan sebaran titik penjualan kompetitor, unggah massal hasil survei lapangan, dan analisis tingkat kepadatan persaingan.

### D. Prioritas 3: Halaman DSS Intelligence & Laporan (`/intelligence/dss`, `/intelligence/reports`)
1. 📋 **Antarmuka Konfigurasi Bobot BWM**
   - Slider dan input perbandingan kriteria terbaik & terburuk dengan indikator kelayakan Consistency Ratio (CR) instan.
2. 📋 **Dashboard Hasil Perangkingan TOPSIS**
   - Tabel rekomendasi alternatif zona terbaik dengan skor preferensi $C_i^+$, visualisasi radar chart multi-kriteria, dan penjelasan dampak cuaca/kompetitor.
3. 📋 **Halaman Riwayat Evaluasi DSS (Immutable Audit View)**
   - Tampilan snapshot keputusan historis yang tidak dapat diubah untuk audit transparansi keputusan pimpinan.

### E. Prioritas 4: Halaman Manajemen Zona & Topologi Spasial (`/operations/zones`)
1. 📋 **Editor Poligon Zona Makro**
   - Kanvas peta Leaflet untuk menggambar dan mengedit poligon zona dengan validasi luas (1.000–5.000.000 m²) dan penolakan garis bersilangan.
2. 📋 **Pemilih Titik Jualan Mikro dengan Visualisasi Buffer 10 Meter**
   - Pemilihan titik mikro dengan indikator visual **lingkaran buffer merah 10m** di sekitar jalan terlarang untuk mencegah pelanggaran titik jualan.
3. 📋 **Visualisasi Layer Batas Wilayah Operasional Resmi di Peta**
   - Garis batas wilayah kerja Kabupaten Sidoarjo dengan garis putus-putus (*dashed line*) dan tombol kontrol layer aktif/nonaktif.

### F. Prioritas 5: Halaman Operasional Armada & Kasir POS Ritel (`/operations/riders`, `/operations/sessions`, POS View)
1. 📋 **Tabel Manajemen Status Armada & Rider**
   - Monitoring ketersediaan armada (`AVAILABLE`, `ASSIGNED`, `HELD`, `MAINTENANCE`) dan antrean rider.
2. 📋 **Wizard Alokasi Distribusi Harian**
   - Antarmuka alokasi zona & armada ke rider dengan proteksi transaksi anti balapan.
3. 📋 **Pelacak Sesi Kerja Lapangan**
   - Timeline progres sesi harian rider (`CREATED` $\rightarrow$ `CHECKED_IN` $\rightarrow$ `ACTIVE` $\rightarrow$ `COMPLETED`).
4. 📋 **Antarmuka Kasir Ritel POS (Rider / Supervisor View)**
   - Kasir pencatatan penjualan cepat dengan kalkulasi otomatis dan penguncian harga satuan resmi dari server.

### G. Prioritas 6: Halaman Pengaturan Sistem & FAQ Interaktif (`/admin/settings`, `/faq`)
1. 🔄 **Modul Tanya Jawab FAQ Interaktif pada Menu Sistem**
   - Komponen Accordion FAQ seputar panduan operasional dengan fitur pencarian cepat kata kunci.
2. 📋 **Aksi Tombol Hubungi Superadmin**
   - Penyempurnaan tombol bantuan untuk memicu modal kontak resmi bantuan teknis Superadmin.
3. 📋 **Halaman Konfigurasi Parameter Wilayah & Shift Operasional**
   - Form pengaturan batas koordinat resmi Sidoarjo, titik pusat koordinat hub, dan jadwal 4 shift kerja operasional.

### H. Prioritas 7: Halaman Audit Log Sistem (`/admin/audit-logs`)
1. ✅ **Sinkronisasi Query Parameter Laporan Audit Log**
   - Perbaikan indeks parameter query dinamis pada backend agar jumlah filter selalu presisi.
2. 📋 **Antarmuka Tabel Audit Log dengan Multi-Filter Dinamis**
   - Tabel audit log interaktif (filter: Rentang Tanggal, Aktor Pengguna, Modul/Entitas, Tipe Aksi) dan modal JSON Viewer untuk detail perubahan data.

### I. Prioritas 8: Halaman Live Command Center Map Ops Telemetry (`/operations/mapops`)
1. 📋 **Peta Telemetri Real-Time Armada (WebSocket Socket.io)**
   - Kanvas peta interaktif layar penuh dengan animasi pergerakan marker rider secara langsung via koneksi WebSocket.
2. 📋 **Indikator Visual Kepatuhan Lokasi LBS**
   - Pewarnaan marker dinamis: 🟢 Hijau (Compliant), 🟡 Kuning (Deviated), 🔴 Merah (Outside Zone).
3. 📋 **Panel Peringatan Deviasi & Pengalih Layer Spasial**
   - Notifikasi deviasi seketika saat rider keluar zona tugas dan panel toggle layer (Batas Sidoarjo, Poligon Zona, Jalan Terlarang, POI, Kompetitor).

---

# 📦 TAHAP 3: E2E INTEGRATION TESTING, CLEAN CODE & DOCKER CI/CD DEPLOYMENT

> **Prinsip**: Pengujian alur sistem utuh, pembersihan sisa kode debug, optimasi bundle, dan kontainerisasi multi-service untuk deployment produksi.

---

### A. Pengujian Integrasi E2E Menyeluruh
1. 📋 **Uji Alur Skenario Autentikasi & Mutasi Akses Pengguna**
   - Simulasi Login $\rightarrow$ Token Silent Refresh $\rightarrow$ Perubahan Role $\rightarrow$ Pemutusan Sesi Instan.
2. 📋 **Uji Alur Ingestion Spasial & Deduplikasi POI**
   - Simulasi Sinkronisasi OSM $\rightarrow$ Penyaringan Batas Sidoarjo $\rightarrow$ Deduplikasi 15m $\rightarrow$ Tampilan Peta.
3. 📋 **Uji Alur DSS Rekomendasi & Evaluasi Snapshot**
   - Simulasi Input Bobot BWM $\rightarrow$ Kalkulasi TOPSIS $\rightarrow$ Rekomendasi Zona $\rightarrow$ Immutability Snapshot.
4. 📋 **Uji Alur Alokasi Armada $\rightarrow$ Telemetri LBS $\rightarrow$ Transaksi POS**
   - Simulasi Alokasi Distribusi $\rightarrow$ Check-In Rider $\rightarrow$ Pengecekan Kepatuhan LBS $\rightarrow$ Input Penjualan Kasir.

### B. Clean Code Audit & Optimasi Bundle Build Vite
1. 📋 **Pembersihan Log Debug & Audit 6-Lapisan Backend**
   - Memastikan Controller, Service, Repository terisolasi sempurna tanpa circular dependencies dan bebas console log debug.
2. 📋 **Optimasi Bundle Frontend (Code Splitting & Lazy Loading)**
   - Konfigurasi Vite `manualChunks`, tree-shaking ikon `lucide-react`, dan lazy loading pada seluruh rute `AppRoutes.jsx`.

### C. Kontainerisasi Multi-Service Docker & CI/CD Deployment
1. 📋 **Pembuatan Multi-Stage Dockerfile Backend & Frontend**
   - `backend/Dockerfile` (Node.js Alpine non-root) dan `frontend/Dockerfile` (Multi-stage Vite $\rightarrow$ Nginx Alpine).
2. 📋 **Konfigurasi Docker Compose Produksi (`docker-compose.production.yml`)**
   - Orkestrasi multi-service: PostgreSQL PostGIS, Redis, Backend API, BullMQ Worker, dan Frontend Nginx Reverse Proxy.
3. 📋 **Automasi Pipeline CI/CD GitHub Actions (`deploy.yml`)**
   - Otomasi linting, eksekusi test suite unit/security, pembuatan Docker image, dan deployment zero-downtime ke server produksi.