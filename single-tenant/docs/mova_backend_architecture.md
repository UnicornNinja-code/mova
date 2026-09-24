# Arsitektur Backend Sistem MOVA Single Tenant

Dokumen ini menjelaskan struktur arsitektur sistem backend MOVA secara menyeluruh. Penjelasan disusun berbasis alur kerja fungsional yang mudah dipahami, menjabarkan bagaimana setiap modul saling terhubung mulai dari data mentah, validasi spasial, algoritma pendukung keputusan, hingga pelaksanaan operasional armada dan evaluasi penjualan di lapangan.

---

# 1. Ringkasan Eksekutif Arsitektur

🏛️ Filosofi Arsitektur:
Sistem backend MOVA bertindak sebagai Single Source of Truth (sumber kebenaran tunggal). Seluruh kalkulasi matematika pendukung keputusan (DSS), kalkulasi jarak spasial, dan validasi kepatuhan rute dijalankan sepenuhnya di sisi backend. Antarmuka frontend murni berperan menampilkan data dan mengirimkan instruksi pengguna.

⚙️ Teknologi Inti:
- Runtime: Node.js / Bun dengan Express framework.
- Basis Data Utama: PostgreSQL dengan ekstensi PostGIS untuk komputasi spasial geometris presisi tinggi.
- Manajemen Cache & Sesi: Redis untuk penyimpanan token sesi, status geofencing cepat, dan rate limiter terdistribusi.
- Antrean Pekerjaan Latar Belakang: BullMQ untuk pemrosesan sinkronisasi data peta dan notifikasi massal tanpa membebani thread utama API.
- Komunikasi Real-Time: Socket.io dengan arsitektur partisi ruangan (room segregation) terotentikasi JWT untuk telemetri LBS dan status operasional armada.
- Solver Optimasi Matematis: javascript-lp-solver untuk penyelesaian program linier (Linear Programming) penentuan bobot kriteria BWM.

---

# 2. Alur Arsitektur 6 Lapisan Utama

Diagram alur keterhubungan antar komponen backend MOVA:

```text
               ┌────────────────────────────────────────────────────────┐
               │         1. FONDASI IDENTITAS & KEAMANAN                │
               │   Autentikasi JWT, Kontrol Akses Role (RBAC), Audit    │
               │       Mesin Aturan Regulasi Dinamis (system_settings)  │
               └──────────────────────────┬─────────────────────────────┘
                                          │
               ┌──────────────────────────▼─────────────────────────────┐
               │            2. INTELIJEN DATA MASUKAN                   │
               │     POI, Pembatasan Jalan, Kompetitor, Cuaca H+1       │
               │       Jejak Audit Penarikan Data (data_sync_runs)      │
               └──────────────────────────┬─────────────────────────────┘
                                          │
               ┌──────────────────────────▼─────────────────────────────┐
               │           3. MESIN SPASIAL (POSTGIS & GIS)             │
               │ Poligon Zona, Titik Jualan Mikro, Buffer 10m Jalan     │
               │     Validasi Penahanan Geofencing, Deteksi LBS Realtime│
               └──────────────────────────┬─────────────────────────────┘
                                          │
               ┌──────────────────────────▼─────────────────────────────┐
               │       4. MESIN PENGAMBIL KEPUTUSAN (DSS ENGINE)        │
               │  Optimasi Linear Programming BWM & Perangkingan TOPSIS │
               │     Evaluasi Zona Makro & Titik Rekomendasi Mikro      │
               └──────────────────────────┬─────────────────────────────┘
                                          │
               ┌──────────────────────────▼─────────────────────────────┐
               │            5. OPERASIONAL & DISTRIBUSI ARMADA          │
               │  Penugasan Zona, Status Rider, Sesi Kerja Lapangan     │
               │    Katalog Produk Fisik & Kasir Transaksi (sales_logs) │
               └──────────────────────────┬─────────────────────────────┘
                                          │
               ┌──────────────────────────▼─────────────────────────────┐
               │          6. PUSAT KENDALI (MAPOPS) & EVALUASI          │
               │ Pemantauan Peta Langsung, Partisi Ruang Socket.io      │
               │     Evaluasi Keputusan vs Realitas (Decision vs Reality)│
               └────────────────────────────────────────────────────────┘
```

Ringkasan 6 Lapisan Backend:

- Lapisan 1: Fondasi Keamanan & Konfigurasi (Keamanan akun, kontrol role, proteksi sesi, dan mesin aturan regulasi dinamis).
- Lapisan 2: Intelijen Data Masukan (Pengumpulan data dasar titik keramaian, jalan terlarang, cuaca, pesaing, dan audit riwayat ETL).
- Lapisan 3: Mesin Spasial Geografis (Analisis poligon zona makro, evaluasi kandidat titik jualan mikro berbuffer 10 meter, dan pelacakan GPS).
- Lapisan 4: Mesin Pengambil Keputusan Cerdas (Penyelesaian Linear Programming BWM dan perangkingan multi-kriteria TOPSIS).
- Lapisan 5: Operasional Lapangan & Ritel (Distribusi armada, sesi kerja rider, katalog produk, dan pencatatan transaksi penjualan).
- Lapisan 6: Pusat Kendali dan Evaluasi (Pemantauan MapOps real-time, isolasi kanal WebSocket, dan evaluasi hasil komersial aktual).

---

# 3. Penjelasan Rinci Komponen per Lapisan

## Lapisan 1: Fondasi Identitas, Akses, dan Keamanan

🔐 Tanggung Jawab Utama:
Memastikan setiap akses ke sistem teridentifikasi, memiliki izin resmi, terlindungi dari ancaman penyusupan, serta mengelola konfigurasi operasional global secara terpusat.

Fitur dan Alur Kerja:
1. Autentikasi Ganda (Dual-Token Flow):
   - Access token JWT dengan masa berlaku pendek (15 menit) untuk otorisasi setiap request API.
   - Refresh token dengan masa berlaku panjang (7 hari) yang disimpan dalam cookie HTTP-only aman untuk pembaruan sesi otomatis tanpa membuat pengguna login berulang kali.
2. Kontrol Akses Berbasis Peran (RBAC):
   - SUPERADMIN: Kendali penuh sistem, konfigurasi server, manajemen pengguna, dan audit log menyeluruh.
   - MANAGEMENT: Pemantauan laporan eksekutif, analisis penjualan ritel, dan perencanaan armada.
   - SUPERVISOR: Penugasan zona operasional harian, kurasi titik jualan mikro, dan pemantauan pergerakan armada.
   - RIDER: Akses aplikasi mobile lapangan untuk melihat instruksi zona, mencatat transaksi jualan, dan mengirim koordinat lokasi.
3. Keamanan Sesi Dinamis (Auth Versioning):
   - Ketika hak akses atau role pengguna diubah oleh administrator, nomor token version akun dinaikkan seketika. Sesi lama di seluruh perangkat langsung gugur dan pengguna diwajibkan login ulang.
4. Perlindungan Endpoint:
   - Integrasi Cloudflare Turnstile CAPTCHA untuk menangkal serangan bot pada proses autentikasi.
   - Rate limiting terdistribusi berbasis Redis untuk mencegah brute force dan serangan denial-of-service.
5. Mesin Aturan Regulasi Dinamis (Dynamic Operational Rules Engine):
   - Mengelola parameter pembatasan operasional di tabel system_settings, seperti OPERATIONAL_RULE_PROTOCOL_ROAD dan OPERATIONAL_RULE_TOLL_ROAD.
   - Memungkinkan pengelola menyalakan atau mematikan larangan rute tertentu secara dinamis.
   - Setiap perubahan aturan langsung memicu evaluasi ulang PostGIS terhadap keabsahan zona dan titik jualan terkait.

---

## Lapisan 2: Intelijen Data Masukan (Data Intelligence)

🛰️ Tanggung Jawab Utama:
Mengumpulkan, membersihkan, dan menstandarisasi data lingkungan luar yang menjadi bahan baku analisis penentuan lokasi terbaik, dengan audit penelusuran penuh.

Fitur dan Alur Kerja:
1. Titik Keramaian (POI Intelligence):
   - Penarikan otomatis data tempat menarik dari OpenStreetMap melalui Overpass API.
   - Auto-clustering kategori titik ke dalam klasifikasi bisnis MOVA.
   - Deduplikasi spasial otomatis: titik dengan nama dan lokasi berdekatan (kurang dari 15 meter) disatukan menjadi satu entitas kanonikal.
   - Menghasilkan nilai kepadatan (C1), keanekaragaman (C2), dan skor keramaian berbasis waktu (C3).
2. Pembatasan Rute Jalan Protokol dan Tol:
   - Pendataan jalan yang dilarang dijadikan tempat operasional berjualan bagi armada motor MOVA.
   - Penggabungan potongan ruas jalan bernama sama menjadi garis kontinu menggunakan PostGIS ST_LineMerge.
3. Intelijen Kompetitor:
   - Pencatatan lokasi dan jenis produk pesaing dari hasil survei lapangan.
   - Perhitungan kedekatan spasial kompetitor terhadap zona yang menjadi faktor biaya persaingan (C6).
4. Intelijen Cuaca (Weather Intelligence):
   - Pengambilan data prakiraan cuaca otomatis dari Open-Meteo untuk hari ini dan besok (H+1).
   - Perhitungan probabilitas hujan pada jam kerja operasional (06.00 hingga 21.00 WIB) yang menjadi kriteria penalti cuaca (C4).
5. Pembatas Wilayah Operasional Resmi (Spatial Scope Guard):
   - Seluruh data masukan disaring ketat berdasarkan batas administratif wilayah kerja kabupaten Sidoarjo yang didefinisikan secara terpusat di environment backend.
6. Jejak Audit dan Riwayat Penarikan Data (Data Provenance & Traceability Engine):
   - Setiap eksekusi penarikan data (POI, cuaca, jalan protokol, dan jalan tol) dicatat ke dalam tabel data_sync_runs.
   - Menyimpan informasi run ID, tipe data, sumber penarikan, waktu mulai, waktu selesai, durasi milidetik, jumlah rekaman yang ditarik, dimasukkan, diperbarui, dan ditolak, serta metadata kegagalan untuk kemudahan penelusuran.

---

## Lapisan 3: Mesin Spasial Geografis (PostGIS Engine)

🐘 Tanggung Jawab Utama:
Menyediakan kemampuan perhitungan geometris presisi tinggi untuk memvalidasi posisi poligon zona makro, titik jualan mikro, dan pelacakan pergerakan armada.

Fitur dan Alur Kerja:
1. Geometri PostGIS Standar (SRID 4326):
   - Seluruh data geografis disimpan dalam koordinat bujur dan lintang standar WGS84.
2. Validasi Batas Zona Makro (Containment & Intersection):
   - Menggunakan fungsi ST_Covers untuk memastikan batasan operasional berada di dalam cakupan wilayah resmi.
   - Menggunakan fungsi ST_Intersects untuk memastikan zona tidak menabrak rute terlarang yang sedang aktif.
3. Sub-sistem Titik Jualan Mikro (Candidate Selling Locations):
   - Selain zona makro, MOVA mendukung penetapan titik jualan mikro spesifik di dalam poligon zona.
   - Setiap titik jualan mikro diverifikasi melalui pipa validasi spasial deterministik:
     - Wajib berada tepat di dalam poligon zona aktif menggunakan fungsi ST_Contains.
     - Wajib memenuhi jarak aman dengan tidak memotong buffer 10 meter dari jalan protokol dan jalan tol terlarang menggunakan fungsi ST_Buffer geografi dan ST_Intersects.
     - Memiliki filter pencegahan duplikasi kandidat titik dalam radius 5 meter di zona yang sama.
4. Perhitungan Jarak Realistis:
   - Menggunakan fungsi ST_Distance berbasis geografi bumi untuk menghitung jarak nyata antara posisi rider dengan pangkalan Hub (kriteria C5) maupun titik jualan.
5. Mesin Pelacakan Lokasi (LBS Real-Time):
   - Menerima pembaruan koordinat GPS rider secara berkala.
   - Mengklasifikasikan status posisi rider ke dalam 3 kondisi:
     - COMPLIANT: Rider berada tepat di dalam zona tugasnya.
     - DEVIATED: Rider berada di luar zona dalam batas toleransi radius penyimpangan.
     - OUTSIDE_ZONE: Rider meninggalkan area tugas resmi sehingga memicu peringatan ke supervisor.

---

## Lapisan 4: Mesin Pengambil Keputusan Cerdas (DSS Engine)

🧠 Tanggung Jawab Utama:
Mengolah berbagai kriteria terukur menjadi perangkingan rekomendasi zona dan titik jualan terbaik dengan kepastian matematika yang konsisten.

Metodologi yang Diterapkan:
Kombinasi metode BWM (Best-Worst Method) berbasis Linear Programming dan TOPSIS (Technique for Order Preference by Similarity to Ideal Solution).

Fitur dan Alur Kerja:
1. Optimasi Bobot BWM dengan Linear Programming Solver:
   - Supervisor menentukan kriteria terbaik (paling penting) dan kriteria terburuk (paling tidak diinginkan).
   - Backend memodelkan masalah perbandingan berpasangan ke dalam formulasi matematika program linier (Linear Programming).
   - Komputasi diselesaikan menggunakan library javascript-lp-solver untuk meminimalkan deviasi maksimum nilai xi* (Consistency Index).
   - Menghasilkan bobot optimal kriteria (w1 hingga w6) dan nilai Consistency Ratio (CR) yang terverifikasi konsisten secara matematis.
2. Perangkingan Zona dan Titik Mikro dengan TOPSIS:
   - Membentuk matriks keputusan terukur dari seluruh alternatif aktif pada slot waktu tertentu (pagi, siang, sore, malam).
   - Melakukan normalisasi vektor matriks dan mengalikannya dengan bobot optimal hasil BWM.
   - Menentukan solusi ideal positif (kondisi terbaik) dan solusi ideal negatif (kondisi terburuk).
   - Menghitung jarak Euclidean setiap alternatif terhadap kedua solusi ideal.
   - Menghasilkan nilai preferensi akhir bernilai 0 hingga 1. Semakin mendekati 1, semakin direkomendasikan zona atau titik jualan tersebut.
3. 6 Kriteria Keputusan Terintegrasi:
   - C1 (Kepadatan POI): Banyaknya titik keramaian bernilai tinggi (Tipe Benefit).
   - C2 (Keanekaragaman POI): Keragaman variasi fasilitas di sekitar zona (Tipe Benefit).
   - C3 (Daya Tarik Waktu): Kesesuaian jam buka fasilitas dengan slot waktu operasional (Tipe Benefit).
   - C4 (Kondisi Cuaca): Curah hujan dan risiko cuaca buruk (Tipe Cost).
   - C5 (Jarak Tempuh Armada): Jarak tempuh dari Hub pangkalan untuk efisiensi bahan bakar (Tipe Cost).
   - C6 (Kepadatan Kompetitor): Kepadatan pesaing sejenis dalam radius jangkauan (Tipe Cost).

---

## Lapisan 5: Manajemen Operasional, Distribusi, dan Transaksi Ritel

🛵 Tanggung Jawab Utama:
Menjembatani rekomendasi analitis dengan operasional armada di lapangan serta mengelola alur transaksi komersial produk secara terstruktur.

Fitur dan Alur Kerja:
1. Pengelolaan Kesiapan Armada (Fleet Readiness):
   - Pencatatan status fisik unit motor gerobak MOVA (Tersedia, Bertugas, Perbaikan, atau Ditahan).
   - Pemasangan relasi rider dengan kendaraan operasional.
2. Alokasi dan Distribusi Tugas (Distribution Run):
   - Mengambil daftar antrean rider siap tugas (waiting queue) dan mencocokkannya dengan kapasitas tampung zona terbaik hasil DSS.
   - Menerapkan alokasi otomatis berurutan (FIFO) maupun penyesuaian manual oleh supervisor dengan pencatatan riwayat penugasan resmi.
3. Siklus Sesi Kerja Harian:
   - Check-in: Rider membuka sesi operasional harian di aplikasi mobile dan menerima target penugasan.
   - On-duty: Pemantauan telemetri GPS aktif selama armada beroperasi melayani pelanggan.
   - Check-out: Rider menutup sesi kerja harian, menginput ringkasan operasional, dan melepaskan unit armada.
4. Katalog Produk Fisik & Transaksi Kasir Lapangan (Product & Sales Pipeline):
   - Manajemen katalog produk melalui tabel products: harga jual, kategori menu, dan status ketersediaan.
   - Perlindungan integritas: produk yang telah memiliki riwayat penjualan dilindungi dari penghapusan permanen.
   - Pencatatan penjualan ritel langsung oleh rider melalui tabel sales_logs:
     - Setiap item yang terjual dicatat dengan kuantitas, harga satuan, dan total pendapatan.
     - Setiap transaksi terikat langsung dengan sesi kerja operasional (session_id), koordinat GPS transaksi, serta status kepatuhan lokasi saat transaksi (compliance_at_sale).

---

## Lapisan 6: Pusat Kendali (MapOps) dan Evaluasi Kinerja

📊 Tanggung Jawab Utama:
Menyediakan pusat kendali visual waktu nyata untuk pemantauan seluruh armada serta mengevaluasi akurasi keputusan lokasi terhadap hasil penjualan riil.

Fitur dan Alur Kerja:
1. Command Center MapOps:
   - Tampilan peta komprehensif yang memadukan poligon zona aktif, sebaran titik POI, jalan terlarang, kandidat titik mikro, dan posisi seluruh armada yang bergerak.
   - Pembaruan telemetri otomatis tanpa jeda melalui WebSocket.
2. Arsitektur Partisi Ruangan Komunikasi Real-Time (Socket.io Room Architecture):
   - Server WebSocket mengelompokkan koneksi klien ke dalam ruangan (rooms) terisolasi berdasarkan token JWT:
     - management_room: Khusus untuk peran Superadmin dan Management guna menerima ringkasan metrik eksekutif.
     - supervisors_room: Untuk para supervisor lapangan guna memantau sebaran armada, pergerakan LBS, dan peringatan pelanggaran rute.
     - riders_room & rider_{id}_room: Ruang privat per rider untuk menerima pembaruan penugasan personal tanpa membocorkan informasi penugasan rider lain.
     - user_{id}: Ruang privat untuk notifikasi langsung ke akun tertentu.
3. Sistem Peringatan Cepat (Alerts & Notifications):
   - Pemberitahuan otomatis seketika saat rider terdeteksi berada di luar area tugas resmi (OUTSIDE_ZONE).
   - Peringatan dini potensi hujan atau cuaca ekstrem pada zona tertentu.
4. Pelaporan Kinerja Penjualan (Decision vs Reality):
   - Mengagregasi data penjualan riil dari sales_logs per zona dan per rider.
   - Mengkorelasikan angka penjualan aktual terhadap skor preferensi DSS yang telah direkomendasikan sebelumnya.
   - Evaluasi ini membantu manajemen memahami apakah zona berperingkat tinggi benar-benar menghasilkan transaksi penjualan yang optimal di lapangan.

---

# 4. Layanan Pendukung dan Pemrosesan Latar Belakang

🔄 Pemrosesan Asinkron (BullMQ Background Workers):
Beberapa tugas komputasi berat dipisahkan dari alur utama API agar sistem tetap responsif:
- Overpass Sync Worker: Menangani pengunduhan dan pemrosesan ribuan data spasial dari OpenStreetMap secara bertahap dengan audit run di data_sync_runs.
- Armada Hold Worker: Memeriksa dan melepaskan armada yang selesai masa tahanan operasional secara terjadwal.
- Notification Worker: Mengirimkan email aktivasi akun dan notifikasi sistem tanpa memperlambat proses transaksi pengguna.
- DSS Batch Worker: Menjalankan kalkulasi matriks zona secara berkala saat jam persiapan operasional pagi hari.
