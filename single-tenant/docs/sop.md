# Prosedur Operasional Standar (SOP) Eksekusi Tugas Sistem MOVA

Dokumen ini adalah acuan praktis Standard Operating Procedure (SOP) dalam menjalankan setiap tugas teknis di proyek MOVA Single Tenant. Tujuannya adalah memastikan setiap pengerjaan kode, desain, arsitektur, dan pengujian mematuhi standar kualitas terbaik dengan memanfaatkan kapabilitas skill yang telah terpasang di sistem.

Setiap kali hendak mengeksekusi suatu tugas, gunakan panduan skenario di bawah ini untuk mengetahui kombinasi skill yang wajib dipanggil beserta contoh perintah cepatnya.

---

# 1. Kategori Desain & Implementasi Frontend UI/UX

Kategori ini mencakup pembuatan antarmuka baru, perombakan tata letak (redesign), penyesuaian estetika peta MapOps, komponen floating widgets, drawer, dan konsistensi visual constitution.

🎨 Skenario 1.1: Perombakan Tata Letak Halaman & Komponen Peta
- Deskripsi: Mengubah layout halaman spasial (misal: transisi ke horizontal view, penempatan floating widget di atas peta, perapihan panel kontrol, drawer detail).
- Rekomendasi Skill:
  - ui-ux-designer: Menentukan hierarki visual, whitespace, dan tata letak yang ergonomis.
  - react-ui-patterns: Mengatur state drawer, modal, floating action, dan transisi komponen yang modular.
  - web-design-guidelines: Memastikan kepatuhan kontras warna, aksesibilitas, dan keterbacaan data.
- Contoh Pemanggilan Cepat:
  /ui-ux-designer /react-ui-patterns /web-design-guidelines Saya ingin merombak tata letak halaman [Nama Halaman] menjadi horizontal view dengan floating widget di atas kanvas peta sesuai panduan mova_visual_constitution.md.

✨ Skenario 1.2: Standardisasi Gaya Visual & Token Desain
- Deskripsi: Memperbaiki styling komponen agar mematuhi palette dark mode KopiGo (Solid Carbon, border abu-abu gelap terukur, badge warna fungsional) tanpa warna neon atau elemen berlebihan.
- Rekomendasi Skill:
  - ui-ux-pro-max: Penajaman palet warna, tipografi Gilroy & Work Sans, dan detail mikro interaksi.
  - core-components: Pemanfaatan komponen inti yang reusable agar tidak terjadi duplikasi styling ad-hoc.
- Contoh Pemanggilan Cepat:
  /ui-ux-pro-max /core-components Terapkan prinsip visual constitution pada komponen [Nama Komponen] agar selaras dengan tema KopiGo.

🏛️ Skenario 1.3: Standar Perancangan Halaman & Pemanfaatan Komponen Primitives (Design System Adoption)
- Deskripsi: Panduan baku restrukturisasi dan modernisasi halaman aplikasi KopiGo menggunakan komponen primitives dan composites resmi tanpa membuat styling ad-hoc yang menumpuk.
- Rekomendasi Skill:
  - ui-ux-designer: Menentukan hierarki visual, spacing, dan layout 5-layer standar.
  - react-ui-patterns: Implementasi state management, filter terintegrasi, debouncing, dan dialog terpusat.
  - web-design-guidelines: Memastikan kepatuhan aksesibilitas, konsistensi token warna, dan zero-regression.

### Panduan Baku Anatomi Halaman KopiGo (5-Layer Architecture):
1. **Layer 1 - Header Halaman (Page Header)**:
   - Judul Halaman: Gunakan Gilroy Medium (`font-heading font-medium tracking-tight text-slate-900 dark:text-slate-100 text-xl`). Hindari penggunaan font-bold berlebihan.
   - Deskripsi Singkat: Gunakan Work Sans dengan warna sekunder (`text-xs text-slate-500 dark:text-slate-400 mt-0.5`).
   - Tombol Aksi Utama: Tombol varian `primary` dengan sudut `rounded-xl`, ikon pendukung dari `lucide-react`, dan transisi warna statis murni (`transition-colors duration-150`). Dilarang keras menggunakan animasi hover bergerak/melompat (`hover:-translate-y-*`).

2. **Layer 2 - Bar Metrik Interaktif (KPI Metric Cards)**:
   - Wajib menggunakan komponen resmi `MetricCard` dari `@/components/composites`.
   - Grid responsif: `grid grid-cols-2 lg:grid-cols-4 gap-4`.
   - Kartu harus interaktif: Tambahkan prop `onClick` dan `selected` agar klik pada kartu langsung memfilter data tabel (misal: Total, Aktif, Menunggu, Dinonaktifkan).
   - State aktif: Menampilkan border glow ring `ring-2 ring-[var(--brand-primary)]/20 border-[var(--brand-primary)]`.
   - Status ikon: Gunakan status warna fungsional (`neutral`, `success`, `warning`, `danger`, `brand`).

3. **Layer 3 - Area Notifikasi & Umpan Balik (Alerts)**:
   - Gunakan komponen `Alert` dari `@/components/primitives` dengan varian `success` atau `danger`.
   - Styling terpadu dengan sudut `rounded-xl` dan tombol tutup interaktif `onClose`.

4. **Layer 4 - Bar Filter & Pencarian (Filter & Search Bar)**:
   - Container kartu recessed: `bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/5 rounded-xl p-3 shadow-xs`.
   - Komponen Pencarian: Wajib menggunakan `SearchInput` dari `@/components/composites` yang sudah dilengkapi auto-debounce (300ms) dan tombol clear cepat (X). Dilarang membuat tag `<input>` pencarian manual ad-hoc.
   - Filter Kategori: Gunakan komponen `Select` dan `SelectItem` dari `@/components/primitives`.
   - Tombol Reset: Sediakan tombol `Reset Filter` otomatis saat ada filter atau kata kunci yang aktif.

5. **Layer 5 - Penyajian Data & Tabel (DataTable & Row Interaction)**:
   - Gunakan `DataTable` dari `@/components/composites` di dalam container `rounded-xl` yang bersih.
   - Interaksi Baris: Gunakan `onRowClick` untuk membuka modal inspeksi terpusat.
   - Status & Peran: Wajib menggunakan `StatusBadge` dan `Badge` varian `pill` dengan soft-tint background (10-15%) dan dot indikator warna status.
   - Tipografi Data: Gunakan `font-mono` untuk username, email, tanggal, nomor referensi, dan kuantitas.

### Standar Modal Dialog & Aksi Destruktif:
- **Inspeksi Profil/Detail**: Gunakan modal terpusat `Dialog` (`DialogContent maxWidth="md" className="rounded-2xl p-6"`) yang menampilkan inisial avatar brand coral, data terstruktur grid, dan tombol aksi cepat. Hindari penggunaan right-side drawer/sheet sempit untuk data primer.
- **Konfirmasi Aksi Destruktif (`ConfirmDialog`)**: Wajib menyertakan prop standar:
  - `open` & `onOpenChange`
  - `title` & `description`
  - `confirmLabel` (bukan `confirmText`)
  - `variant="danger"` atau `variant="primary"` (bukan `confirmVariant`)
  - `loading` & `onConfirm`

### Aturan Branding & Copywriting:
- Seluruh teks antarmuka dan pesan sistem wajib menggunakan nama produk **KopiGo** (bukan MOVA).
- Gunakan Bahasa Indonesia baku operasional yang ringkas dan profesional pada seluruh label, tombol, dan pesan dialog.

### Checklist Verifikasi Kualitas Pra-Selesai (Quality Gate):
1. [ ] Tidak ada penambahan styling inline/ad-hoc jika primitive resmi sudah ada.
2. [ ] Tidak ada tombol yang melompat saat di-hover (`hover:-translate-y-*` dibersihkan).
3. [ ] Tidak ada warning konsol (misal: refresh token tak berizin atau third-party storage tracking).
4. [ ] Jalankan `bun run vitest run` dan pastikan seluruh test suite (100%) berstatus passed.

- Contoh Pemanggilan Cepat:
  /ui-ux-designer /react-ui-patterns Terapkan standar SOP Desain Halaman KopiGo (5-Layer Architecture) pada halaman [Nama Halaman] menggunakan MetricCard interaktif, SearchInput debounced, dan Dialog terpusat.

---

# 2. Kategori Pengembangan & Arsitektur Backend API

Kategori ini mencakup pembuatan endpoint baru, refactoring service/repository, optimasi middleware, dan pengelolaan business logic.

⚙️ Skenario 2.1: Pembuatan atau Refactoring Endpoint API
- Deskripsi: Menambahkan endpoint REST baru, restrukturisasi controller dan service layer, validasi skema request, dan standardisasi envelope respon JSON.
- Rekomendasi Skill:
  - backend-patterns: Pola Clean Architecture, pemisahan router-controller-service-repository yang konsisten.
  - api-patterns: Penamaan endpoint RESTful, pagination standar, dan penanganan HTTP status code yang tepat.
  - clean-code: Penulisan logika bisnis yang ringkas, mudah dibaca, dan bebas dari duplikasi kode.
- Contoh Pemanggilan Cepat:
  /backend-patterns /api-patterns /clean-code Buat endpoint baru untuk [Nama Fitur] dengan memisahkan controller, service, dan repository sesuai arsitektur backend MOVA.

🔐 Skenario 2.2: Pengelolaan Autentikasi & Otorisasi Pengguna
- Deskripsi: Penanganan siklus token JWT (access token & refresh token), middleware verifikasi role RBAC, dan pembatasan sesi pengguna.
- Rekomendasi Skill:
  - backend-security-coder: Penanganan token berbasis HTTP-only cookies dan validasi payload kriptografis.
  - nodejs-best-practices: Penanganan asynchronous error yang aman pada alur otentikasi.
- Contoh Pemanggilan Cepat:
  /backend-security-coder /nodejs-best-practices Tinjau dan perbaiki alur otorisasi role pada rute [Nama Rute] agar terlindungi dari eskalasi hak akses.

---

# 3. Kategori Komputasi Geografis, Database Spasial & PostGIS

Kategori ini mencakup query spasial PostgreSQL, indexing GiST, kalkulasi jarak geografi, interseksi rute terlarang, validasi poligon zona, dan pipeline ETL data peta.

🐘 Skenario 3.1: Query Spasial PostGIS & Validasi Geometri
- Deskripsi: Menulis atau mengoptimasi query geometri/geografi untuk pengecekan containment zona (ST_Contains/ST_Covers), buffer jalan terlarang (ST_Buffer, ST_Intersects), dan penggabungan ruas (ST_LineMerge).
- Rekomendasi Skill:
  - postgresql: Praktik terbaik perancangan schema, tipe data geometry SRID 4326, dan constraint database.
  - database-design: Penentuan foreign key, indexing spasial GiST, dan integritas relasional antar tabel.
- Contoh Pemanggilan Cepat:
  /postgresql /database-design Optimasi query PostGIS pada [Nama File] untuk validasi interseksi buffer 10 meter terhadap jalan protokol dan jalan tol.

🛰️ Skenario 3.2: Pipeline ETL & Sinkronisasi Eksternal
- Deskripsi: Mengambil data dari Overpass API (OpenStreetMap) atau Open-Meteo, deduplikasi entitas berdekatan, penyatuan ruas jalan, dan pencatatan riwayat ke data_sync_runs.
- Rekomendasi Skill:
  - backend-patterns: Penanganan timeout, backoff retry bertahap, dan pemrosesan chunk data besar.
  - sql-pro: Penulisan query aggregation spasial dan bulk upsert yang efisien.
- Contoh Pemanggilan Cepat:
  /backend-patterns /sql-pro Perbaiki alur ingestion data peta Overpass pada [Nama File] agar menangani timeout jaringan dan menyatukan ruas jalan sejenis secara kontinu.

---

# 4. Kategori Audit Keamanan, Penetration Testing & Hardening

Kategori ini mencakup pemeriksaan celah keamanan, mitigasi injection, sanitasi input, rate limiting, dan perlindungan kebocoran informasi teknis.

🛡️ Skenario 4.1: Pengujian Autentikasi & Akses Ilegal (Auth Hardening)
- Deskripsi: Memeriksa dan menutup celah bypass autentikasi pada header pengujian, memastikan rate limiter aktif di mode produksi, dan memvalidasi masa berlaku token sesi.
- Rekomendasi Skill:
  - backend-security-coder: Mengamankan alur otentikasi, validasi signature JWT, dan sanitasi header.
  - api-security-best-practices: Memastikan prinsip least privilege pada kontrol role RBAC dan proteksi endpoint sensitif.
- Contoh Pemanggilan Cepat:
  /backend-security-coder /api-security-best-practices Lakukan audit keamanan pada middleware autentikasi dan pastikan tidak ada header bypass pengujian yang lolos di environment produksi.

💉 Skenario 4.2: Pencegahan SQL Injection & Masking Error Internal
- Deskripsi: Memastikan seluruh query database menggunakan prepared statements berparameter terpisah dan menyamarkan pesan error teknis database pada respon publik.
- Rekomendasi Skill:
  - vulnerability-scanner: Analisis pola celah keamanan pada input dinamis dan query builder.
  - backend-security-coder: Penerapan parameterized query aman dan masking stack trace internal.
- Contoh Pemanggilan Cepat:
  /vulnerability-scanner /backend-security-coder Audit seluruh file repository dan controller laporan untuk memastikan bebas dari celah SQL injection dan error database tidak bocor ke publik.

---

# 5. Kategori Pengujian Otomatis, QA & Test-Driven Development (TDD)

Kategori ini mencakup pembuatan unit test, pengujian integrasi contract API, verifikasi alur operasional, dan regresi otomatis.

🧪 Skenario 5.1: Implementasi Fitur Baru Berbasis TDD
- Deskripsi: Menulis skenario uji gagal terlebih dahulu (Red), menulis implementasi minimal yang meloloskan tes (Green), dan merapikan struktur kode (Refactor).
- Rekomendasi Skill:
  - test-driven-development: Panduan disiplin siklus TDD menyeluruh.
  - tdd-workflow: Langkah konkret pembuatan test fixture, assertions, dan refactoring aman.
  - unit-testing-test-generate: Pembuatan test case yang mencakup edge cases dan validasi nilai batas.
- Contoh Pemanggilan Cepat:
  /test-driven-development /tdd-workflow /unit-testing-test-generate Terapkan siklus TDD untuk membuat fungsi kalkulasi skor kriteria DSS baru pada [Nama Service].

🚦 Skenario 5.2: Pengujian Integrasi & Kontrak API (Frontend & Backend Parity)
- Deskripsi: Memverifikasi keselarasan skema respon backend terhadap ekspektasi komponen frontend, memastikan tidak ada properti undefined atau tipe data yang mismatch.
- Rekomendasi Skill:
  - webapp-testing: Pengujian end-to-end integrasi aplikasi dan verifikasi payload HTTP.
  - testing-patterns: Pola mock service, setup data pengujian, dan assertion payload JSON.
- Contoh Pemanggilan Cepat:
  /webapp-testing /testing-patterns Jalankan pengujian integrasi antara endpoint [Nama Endpoint] dan komponen frontend [Nama Komponen] untuk memastikan kompatibilitas payload data.

---

# 6. Kategori Investigasi Masalah, Debugging & Perbaikan Bug

Kategori ini mencakup pelacakan error asinkron, perbaikan kegagalan test suite, penanganan timeout jaringan, dan penyelarasan state reaktif.

🔍 Skenario 6.1: Pelacakan Error & Root Cause Analysis
- Deskripsi: Menginvestigasi penyebab error terminal atau kegagalan request yang gejalanya tidak langsung terlihat, memeriksa log historis, dan menentukan akar masalah secara sistematis.
- Rekomendasi Skill:
  - systematic-debugging: Pendekatan diagnosa terstruktur berbasis hipotesis dan bukti kode sebelum menyentuh file.
  - debugger: Pelacakan trace error, titik henti data, dan nilai variabel state yang anomali.
- Contoh Pemanggilan Cepat:
  /systematic-debugging /debugger Telusuri akar masalah mengapa terjadi error 500 saat request ke [Nama Endpoint] dan berikan rencana perbaikan sebelum mengubah kode.

🔧 Skenario 6.2: Perbaikan Test Suite yang Gagal (Test Fixing)
- Deskripsi: Memperbaiki unit test atau integration test yang broken setelah adanya perubahan skema database atau penyesuaian logika bisnis.
- Rekomendasi Skill:
  - test-fixing: Pengelompokan cerdas error pengujian dan resolusi bertahap sampai seluruh suite hijau (pass).
  - clean-code: Menjaga agar kode pengujian tetap bersih, mandiri, dan tidak meninggalkan data sampah di database.
- Contoh Pemanggilan Cepat:
  /test-fixing Jalankan suite pengujian [Nama File Test] dan perbaiki kegagalan assertion yang terjadi hingga 100 persen lulus.

---

# 7. Kategori Perencanaan Fitur, Spesifikasi & Penataan Backlog

Kategori ini mencakup penyusunan rencana implementasi sebelum pengerjaan proyek besar, pemecahan tugas ke item backlog terukur, dan penentuan kriteria selesai.

📋 Skenario 7.1: Penyusunan Rencana Kerja (Implementation Plan)
- Deskripsi: Membuat dokumen perencanaan teknis untuk fitur baru yang kompleks atau refactoring arsitektural lintas modul frontend dan backend.
- Rekomendasi Skill:
  - writing-plans: Penyusunan rencana bertahap dengan dependensi jelas, mitigasi risiko, dan rencana verifikasi.
  - concise-planning: Pembuatan checklist actionable yang fokus pada substansi tanpa narasi bertele-tele.
- Contoh Pemanggilan Cepat:
  /writing-plans /concise-planning Buat implementation plan untuk penambahan fitur [Nama Fitur] yang memetakan perubahan backend, skema database, dan antarmuka frontend.

📌 Skenario 7.2: Penataan & Sinkronisasi Backlog
- Deskripsi: Memperbarui daftar tugas pada backlog.md, memisahkan ranah backend dan frontend, serta menandai status progress dengan ikon visual yang jelas.
- Rekomendasi Skill:
  - track-management: Pengelolaan siklus hidup tugas, penentuan prioritas, dan pelacakan status kerja.
  - kaizen: Prinsip continuous improvement, standardisasi proses, dan pencegahan degradasi kualitas.
- Contoh Pemanggilan Cepat:
  /track-management /kaizen Perbarui dokumen backlog.md untuk mencerminkan status progress terkini pada modul [Nama Modul] dengan tetap menjaga format tanpa bolding.

---

# 8. Kategori Deployment, Monitoring & Evaluasi Kinerja Sistem

Kategori ini mencakup optimasi kecepatan render frontend, efisiensi query database, monitoring worker latar belakang (BullMQ), dan kesiapan rilis produksi.

🚀 Skenario 8.1: Optimasi Kinerja Web & Kecepatan Muat
- Deskripsi: Mengurangi beban render kanvas peta, memoization data berat, virtualisasi daftar item, dan optimasi Core Web Vitals pada antarmuka pengguna.
- Rekomendasi Skill:
  - web-performance-optimization: Penanganan render pipeline, optimasi bundle JavaScript, dan penekanan layout shifts.
  - performance-profiling: Pengukuran waktu eksekusi fungsi kritis dan identifikasi bottleneck komputasi.
- Contoh Pemanggilan Cepat:
  /web-performance-optimization /performance-profiling Analisis dan optimasi performa render komponen peta [Nama Komponen] saat memuat ribuan titik koordinat.

📦 Skenario 8.2: Kesiapan Lingkungan Produksi & Deployment
- Deskripsi: Verifikasi variabel environment (.env), konfigurasi server Node/Bun, kesiapan migrasi schema database, dan checklist verifikasi pra-rilis.
- Rekomendasi Skill:
  - deployment-procedures: Prosedur verifikasi deployment yang aman dan strategi rollback jika terjadi insiden.
  - server-management: Konfigurasi proses latar belakang, koneksi Redis, dan pemantauan thread server.
- Contoh Pemanggilan Cepat:
  /deployment-procedures /server-management Lakukan audit kesiapan deployment untuk modul backend MOVA dan pastikan seluruh konfigurasi environment telah memenuhi standar rilis.

---

# Ringkasan Matriks Referensi Cepat

Berikut adalah panduan cepat pemilihan skill berdasarkan kata kunci kebutuhan kerja:

1. Kebutuhan: Redesign Halaman / Buat Komponen UI Baru / Standar 5-Layer SOP
   - Skill Utama: ui-ux-designer, react-ui-patterns, web-design-guidelines, core-components

2. Kebutuhan: Buat Endpoint RESTful / Business Logic
   - Skill Utama: backend-patterns, api-patterns, clean-code

3. Kebutuhan: Query Spasial / Geometri PostGIS / ETL Peta
   - Skill Utama: postgresql, database-design, sql-pro

4. Kebutuhan: Cek Celah Keamanan / Hardening Auth / SQL Injection
   - Skill Utama: backend-security-coder, api-security-best-practices, vulnerability-scanner

5. Kebutuhan: Buat Unit Test / TDD / Test Integrasi
   - Skill Utama: test-driven-development, tdd-workflow, webapp-testing

6. Kebutuhan: Debugging Error / Test Gagal / Investigasi Bug
   - Skill Utama: systematic-debugging, debugger, test-fixing

7. Kebutuhan: Bikin Rencana Fitur / Rombak Arsitektur / Backlog
   - Skill Utama: writing-plans, concise-planning, track-management

8. Kebutuhan: Optimasi Loading / Profiling Memori / Kesiapan Rilis
   - Skill Utama: web-performance-optimization, performance-profiling, deployment-procedures
