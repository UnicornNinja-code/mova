daftar backlog aplikasi mova 
- perbaikan tata letak ui dialog hover pada halaman users, issue : saat aku hover mouse ke titik tiga di urutan daftar user paling Bawah, dialog atau card yang muncul agak tenggelam, seharusnya card atau dialog tersebut bisa menyesuaikan posisi munculnya di mana ✅ 	

- perbaikan dan penambahan halaman user profile, untuk bisa update password dll ✅

- perbaikan visualisasi email pengguna pada modal kecil di pojok kanan atas tempat user info, seharusnya menampilkan full domain emailnya juga, bukan hanya menampilkan nama depan emailnya saja ✅

- perbaikan behavior perubahan jabatan perubahan role pada user yang sedang online sebaiknya diperlakukan sebagai security state change, bukan sekadar perubahan data.✅

- bug refresh browser yang harus mengahruskan login dari awal ✅
- audit halaman cuaca ✅
- audit alur data cuaca ✅
- perbaikan halaman pusat cuaca & resiko matriks Armada ✅
- perbaikan svg yang terlalu sempit sehingga menyebabkan annimasi terpotong ✅
- perbaikan animasi meteocons dengan menghilangkan efek fade ✅
- audit alur data cuaca & backend overhaul: ✅
  - Dukungan prakiraan cuaca H+1 (date=today/tomorrow) pada Hub Overview & Multi-Zona ✅
  - Agregasi makro timeline Hub (06:00-21:00 WIB) & kalkulasi 4 shift kriteria C4 ✅
  - Penanganan request zone 'all'/'zone-all' tanpa memicu error 404 ✅
- [FRONTEND] Perbaikan Halaman Pusat Cuaca & Risiko Matriks Armada: ✅
  - Sinkronisasi penuh toggle 'Hari Ini' vs 'Besok' (H+1) pada Hero Card, Timeline 06:00-21:00, 4-Slot Kriteria C4, dan Tabel Multi-Zona ✅
  - Konsumsi data terpadu dari Hub endpoint tanpa pemanggilan dummy `zone-all` / `zone-default` ✅
  - Perbaikan SVG Meteocons: pelebaran viewBox agar animasi ikon tidak terpotong ✅
- audit dan penyelarasan config backend & multi-stack connection (CWD-independent env resolver): ✅
  - Multi-level dynamic .env path resolver di env.js ✅
  - Standarisasi konfigurasi terpusat (env.DB, env.REDIS, env.JWT, env.SMTP) ✅
  - Script uji diagnostik multi-stack (test-stack-connections.js / npm run test:stack) ✅
- [BACKEND] Master POI & Rekonsiliasi Kompetitor Module Overhaul: ✅
  - Endpoint CRUD manual POI (`POST /api/pois`, `GET /api/pois/:id`, `PUT /api/pois/:id`, `DELETE /api/pois/:id`) ✅
  - Bulk ingestion POI dengan auto-clustering kategori & spatial deduplication (`POST /api/pois/bulk`) ✅
  - Integrasi evaluasi kriteria spasial DSS $C_1, C_2, C_3$ & $C_6$ (Kepadatan Kompetitor) ✅
  - Endpoint Rekonsiliasi Kompetitor vs Canonical POI (`POST /api/competitors/:id/reconcile`, `POST /api/competitors/:id/unlink`) ✅
  - Test suite lengkap (`test-poi-crud.test.js`, `test-poi-contract.test.js`, `test-competitor-contract.test.js`) 100% PASS ✅

- penambahan FAQ pada halaaman system ⚠️
- perbaikan hubungi superadmin di halaman FAQ 

- [FRONTEND] Pembuatan Halaman Master POI: ✅
  - Table & search/filter (kategori, status, keyword)
  - Detail Inspection Drawer (koordinat, sumber data OSM/manual, status operasional)
  - Modal Tambah Manual, Edit, dan Bulk Import JSON/CSV dengan auto-clustering
  - Integrasi aksi Overpass Sync & Re-cluster dengan ConfirmDialog
  - Role-based capabilities (Superadmin & Supervisor)

- perbaikan halaman master data poi : Layoutnya kurang rapi dan tidak UI Friendly
- perbaikan pada semua tema table yang ada di aplikasi mova ini agar sesuai dengan table default dan menerapkan sort ascending dan descending secara default ke tampilan table pada atributnya 
- perbaikan pada parameter penarikan data Kota agar tidak terjadi over scope misal HUb ada di kota sidoarjo dan sistem akan secara strict menampilkan dan menarik data poi, jalan protokol, jalan tol , kompetitor pada kota sidoarjo saja bukan seindonesia
- perbaikan pada penyatuan line string jalan protokol dan jalan tol agar tidak ada ruas jalan yang terpotong dan tidak sesuai panjang pada peta
- perbaikan pada handling jalan protokol yang tidak ada nama jalannya 
- perbaikan pada handling jalan tol yang tidak ada namanya  
- perbaikan layout halaman data jalan protokol dan jalan tol 
- penambahan visualisasi map letak poi pada modal detail data poi
- pe

- pembuatan frontend halaman map ops 
- pembuatan frontend halaman jalan protocol & TOL
- pembuatan frontend halaman Kompetitor 
