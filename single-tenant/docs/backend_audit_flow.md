# Panduan Alur Audit Keamanan & Integritas Backend MOVA

Dokumen ini merupakan acuan audit teknis menyeluruh untuk backend MOVA Single Tenant. Struktur audit diselaraskan secara langsung dengan 6 lapisan arsitektur utama dan layanan pemrosesan latar belakang yang tertulis pada mova_backend_architecture.md.

Audit berfokus pada pencegahan kerentanan keamanan, perlindungan integritas logika komputasi spasial dan DSS, serta validasi transaksi operasional armada di lapangan.

---

# 1. Lapisan 1: Fondasi Identitas, Akses, dan Keamanan

🔐 Fokus Lapisan:
Memastikan setiap entitas yang berinteraksi dengan API terotentikasi secara sah, memiliki otorisasi peran yang sesuai, terlindungi dari serangan otomatis, dan pengelolaan aturan regulasi operasional berjalan aman.

Target Komponen & Sub-sistem:
- Alur Token Ganda: Access Token JWT (15 menit) dan Refresh Token HTTP-only cookie (7 hari).
- Kontrol Akses Berbasis Peran (RBAC): SUPERADMIN, MANAGEMENT, SUPERVISOR, RIDER.
- Manajemen Sesi Dinamis: Token versioning untuk pembatalan sesi instan saat hak akses berubah.
- Proteksi Endpoint: Cloudflare Turnstile CAPTCHA dan Redis Distributed Rate Limiter.
- Mesin Aturan Regulasi Dinamis: Pengaturan OPERATIONAL_RULE_PROTOCOL_ROAD dan OPERATIONAL_RULE_TOLL_ROAD pada tabel system_settings.

Skenario Ancaman & Vektor Serangan:
- Pengujian Bypass di Lingkungan Produksi: Penyerang memanfaatkan header bypass pengujian (seperti x-test-suite atau x-bypass-captcha) untuk menembus autentikasi atau rate limiter.
- Eskalasi Hak Akses (Privilege Escalation): Pengguna berstatus RIDER memanipulasi token atau memanggil endpoint milik MANAGEMENT atau SUPERVISOR.
- Manipulasi Aturan Operasional Global: Pengguna tanpa hak Superadmin mengirim permintaan perubahan parameter pembatasan jalan pada system_settings.
- Sesi Zombie: Pengguna yang sudah diturunkan jabatannya atau dinonaktifkan tetap dapat mengakses API karena masa berlaku access token belum habis dan sistem tidak memvalidasi token_version.
- Kebocoran Pesan Error Database: Respon HTTP 500 mengekspos rincian teknis PostgreSQL atau query PostGIS ke publik.

Checklist Verifikasi Integritas & Keamanan:
- Seluruh header pengujian bypass wajib dinonaktifkan secara ketat pada lingkungan produksi (NODE_ENV bernilai production).
- Setiap rute terlindungi wajib memanggil middleware autentikasi dan checkRole dengan daftar peran yang sah.
- Endpoint pengubahan konfigurasi system_settings wajib dikunci khusus untuk peran SUPERADMIN.
- Middleware autentikasi wajib memverifikasi kecocokan token_version antara payload token dan basis data secara real-time.
- Handler respon API wajib menyamarkan seluruh pesan galat basis data internal dan mengembalikan pesan error publik yang aman.

---

# 2. Lapisan 2: Intelijen Data Masukan (Data Intelligence)

🛰️ Fokus Lapisan:
Memastikan data mentah dari dunia luar (titik keramaian, rute jalan, kompetitor, dan cuaca) divalidasi, dibersihkan, dibatasi pada wilayah operasional resmi, serta tercatat riwayat perubahannya secara transparan.

Target Komponen & Sub-sistem:
- Titik Keramaian (POI): Penarikan Overpass API OpenStreetMap, auto-clustering kategori, dan deduplikasi spasial 15 meter.
- Pembatasan Rute Jalan: PostGIS ST_LineMerge untuk penyatuan segmen jalan bernama sama menjadi garis kontinu.
- Intelijen Kompetitor: Survei lapangan, pencatatan koordinat, dan kriteria biaya persaingan C6.
- Intelijen Cuaca: Prakiraan Open-Meteo H+1, probabilitas hujan jam operasional, dan kriteria penalti C4.
- Pembatas Lingkup Spasial: Filter administratif wilayah kerja kabupaten Sidoarjo.
- Audit Riwayat Penarikan Data (Data Provenance): Tabel data_sync_runs untuk pelacakan alur ETL.

Skenario Ancaman & Vektor Serangan:
- Pencemaran Data Spasial: Data titik keramaian atau rute dari luar kabupaten Sidoarjo berhasil masuk ke basis data karena ketiadaan filter batas administratif.
- Serangan Denial of Service via External API: Permintaan sinkronisasi data yang tidak dibatasi frekuensinya memicu pemblokiran IP oleh server OpenStreetMap Overpass.
- Manipulasi Titik Kompetitor: Injeksi data kompetitor fiktif untuk menurunkan peringkat zona tertentu secara curang.
- Kegagalan Sinkronisasi Tanpa Jejak: Sinkronisasi data berhenti di tengah jalan tanpa mencatat status kegagalan, menyebabkan inkonsistensi data antar tabel.

Checklist Verifikasi Integritas & Keamanan:
- Setiap titik koordinat yang masuk melalui proses sinkronisasi atau penambahan manual wajib lolos validasi batas administratif wilayah operasional resmi Sidoarjo.
- Modul pemanggil Overpass API wajib menerapkan mekanisme batas waktu (timeout), jeda bertahap (retry backoff), dan pelindung frekuensi eksekusi.
- Data titik keramaian hasil penarikan wajib melalui alur kurasi status (approval_status) sebelum diaktifkan ke perhitungan DSS.
- Setiap proses sinkronisasi data wajib membuat entri pada data_sync_runs yang mencatat run ID, status eksekusi (RUNNING, SUCCESS, FAILED), durasi milidetik, jumlah rekaman, dan rincian metadata kegagalan.
- Endpoint pemicu sinkronisasi data hanya dapat diakses oleh peran SUPERVISOR dan SUPERADMIN.

---

# 3. Lapisan 3: Mesin Spasial Geografis (PostGIS Engine)

🐘 Fokus Lapisan:
Menjamin seluruh operasi geometris dan geografi berjalan presisi, bebas dari celah penyalahgunaan komputasi spasial berat, dan aturan pembatasan fisik ditaati secara deterministik.

Target Komponen & Sub-sistem:
- Standarisasi Geometri: PostGIS SRID 4326 (WGS84).
- Batasan Poligon Zona Makro: Fungsi ST_Covers, ST_Contains, dan ST_Intersects.
- Titik Jualan Mikro (Candidate Selling Locations): Validasi ketercakupan zona, buffer 10 meter jalan terlarang (ST_Buffer, ST_Intersects), dan pencegahan duplikasi titik dalam radius 5 meter.
- Komputasi Jarak Nyata: Perhitungan jarak berbasis geografi bumi ST_Distance ke Hub pangkalan armada (kriteria C5).
- Pelacakan Lokasi (LBS Real-Time): Klasifikasi status kepatuhan rider (COMPLIANT, DEVIATED, OUTSIDE_ZONE).

Skenario Ancaman & Vektor Serangan:
- Serangan Geometri Rusak (Malformed Polygon): Penyerang mengirimkan poligon dengan garis bersilangan sendiri (self-intersecting) yang memicu kegagalan fungsi topologi PostGIS.
- Beban Komputasi Ekstrem (Spatial Query DoS): Permintaan pencarian dengan radius sangat besar atau tanpa batas paginasi yang memaksa server memindai seluruh tabel spasial tanpa indeks GiST.
- Pemalsuan Titik Jualan Mikro: Pendaftaran titik jualan di atas badan jalan tol atau jalan protokol arteri tanpa terdeteksi oleh sistem.
- Manipulasi Koordinat LBS (GPS Spoofing): Rider mengirimkan koordinat palsu melalui payload HTTP request untuk mengelabui status kepatuhan zona saat berada di lokasi lain.

Checklist Verifikasi Integritas & Keamanan:
- Seluruh input koordinat latitude dan longitude wajib divalidasi tipe data numerik dan rentang batas geografis yang valid sebelum diteruskan ke query PostGIS.
- Setiap geometri poligon zona baru wajib diverifikasi keabsahannya menggunakan ST_IsValid dan memiliki luas wilayah dalam rentang minimum 1.000 m² hingga maksimum 5.000.000 m².
- Titik jualan mikro wajib melewati pemeriksaan buffer 10 meter terhadap jalan protokol dan tol terlarang serta ditolak otomatis jika terjadi irisan spasial.
- Pencegahan duplikasi titik jualan mikro wajib berjalan aktif untuk mendeteksi kandidat lain dalam radius 5 meter pada zona yang sama.
- Endpoint pengiriman koordinat LBS wajib mengambil identitas rider langsung dari token JWT yang terverifikasi, bukan dari body request client.
- Status kepatuhan COMPLIANT, DEVIATED, dan OUTSIDE_ZONE wajib dihitung secara independen di sisi server melalui komputasi PostGIS.

---

# 4. Lapisan 4: Mesin Pengambil Keputusan Cerdas (DSS Engine)

🧠 Fokus Lapisan:
Menjamin objektivitas, determinisme, dan integritas perhitungan analitis BWM dan TOPSIS, sehingga hasil rekomendasi peringkat lokasi tidak dapat dimanipulasi dari sisi klien.

Target Komponen & Sub-sistem:
- Optimasi Pemrograman Linier BWM: Integrasi javascript-lp-solver untuk minimalisasi deviasi maksimum rasio konsistensi kriteria.
- Uji Konsistensi Matematis: Perhitungan Consistency Ratio (CR) berbasis tabel Rezaei.
- Mesin Perangkingan TOPSIS: Normalisasi matriks, pembobotan, penentuan solusi ideal positif dan negatif, serta perhitungan kedekatan relatif.
- 6 Kriteria Keputusan Terpadu: C1 (Kepadatan POI), C2 (Keanekaragaman), C3 (Daya Tarik Waktu), C4 (Cuaca), C5 (Jarak Hub), dan C6 (Kompetitor).
- Evaluasi Multi-Level: Rekomendasi zona makro dan evaluasi titik jualan mikro per slot waktu operasional.

Skenario Ancaman & Vektor Serangan:
- Intervensi Bobot dari Klien (Client-Side Weight Injection): Frontend mengirimkan nilai bobot kriteria final hasil manipulasi untuk memenangkan zona tertentu.
- Pembagian dengan Nol (Division by Zero): Manipulasi skor kriteria alternatif bernilai nol atau identik yang mengakibatkan galat matematika pada proses normalisasi TOPSIS.
- Modifikasi Riwayat Evaluasi: Perubahan data pada tabel snapshot riwayat DSS untuk merekayasa pertanggungjawaban keputusan masa lalu.
- Permintaan Kalkulasi Serentak: Pemicuan kalkulasi matriks berulang-ulang dalam waktu singkat yang membebani kapasitas pemrosesan CPU server.

Checklist Verifikasi Integritas & Keamanan:
- Seluruh kalkulasi optimasi BWM dan kalkulasi matriks TOPSIS wajib dieksekusi 100 persen di sisi backend; input dari klien murni berupa matriks perbandingan berpasangan.
- Solver Linear Programming wajib memiliki mekanisme penanganan batas (boundary handler) untuk mencegah crash jika matriks menghasilkan kondisi tidak terdefinisi.
- Nilai Consistency Ratio (CR) hasil BWM wajib divalidasi berada di bawah ambang batas konsistensi (CR <= 0.3) sebelum bobot dapat digunakan.
- Input kriteria C1 sampai C6 wajib ditarik langsung dari fungsi internal terpercaya (bukan parameter terbuka dari request body).
- Setiap putaran evaluasi DSS wajib disimpan sebagai snapshot historis permanen yang tidak dapat diubah (immutable record).

---

# 5. Lapisan 5: Manajemen Operasional, Distribusi, dan Transaksi Ritel

🛵 Fokus Lapisan:
Menjaga konsistensi status fisik armada, keadilan distribusi tugas rider, kepatuhan alur kerja operasional harian, serta integritas pencatatan transaksi penjualan produk di lapangan.

Target Komponen & Sub-sistem:
- Status Kesiapan Armada Fisik: Unit motor gerobak (Tersedia, Bertugas, Perbaikan, Ditahan).
- Mesin Distribusi Armada: Pencocokan antrean rider siap tugas terhadap kapasitas daya tampung zona terbaik hasil DSS.
- Alur Sesi Kerja Harian: Siklus check-in, penugasan aktif, dan check-out.
- Katalog Produk Ritel: Manajemen data produk melalui tabel products dengan proteksi penghapusan.
- Pencatatan Transaksi Penjualan: Tabel sales_logs dengan relasi sesi, koordinat penjualan, dan status kepatuhan lokasi.

Skenario Ancaman & Vektor Serangan:
- Kondisi Balapan (Race Condition) Distribusi: Dua supervisor menjalankan distribusi serentak yang menyebabkan satu rider atau satu kendaraan operasional teralokasikan dua kali.
- Manipulasi Sesi Kerja: Rider mengubah status sesi kerja tanpa melalui alur check-in atau check-out yang sah.
- Pemalsuan Harga Penjualan Ritel: Rider mengirimkan nominal harga satuan produk yang lebih rendah pada payload penjualan kasir.
- Penghapusan Produk Bersejarah: Administrator menghapus produk master yang telah memiliki riwayat penjualan di masa lalu, merusak integritas laporan keuangan.
- Pencatatan Transaksi di Luar Sesi: Penjualan dicatat tanpa terikat pada sesi kerja aktif yang valid.

Checklist Verifikasi Integritas & Keamanan:
- Logika penugasan dan distribusi armada wajib dijalankan di dalam blok transaksi database dengan penguncian data (row-level lock) atau constraint unik untuk mencegah alokasi ganda.
- Seorang rider hanya diizinkan memiliki tepat satu sesi operasional aktif pada satu waktu.
- Input penjualan pada sales_logs wajib mengambil harga satuan resmi langsung dari tabel products di database (mengabaikan harga yang dikirim klien).
- Tabel products wajib memiliki proteksi penghapusan (delete guard) yang menolak penghapusan entitas produk jika sudah pernah tercatat pada sales_logs.
- Setiap entri transaksi penjualan wajib mengikat session_id aktif, koordinat GPS saat transaksi, serta status kepatuhan spasial (compliance_at_sale).

---

# 6. Lapisan 6: Pusat Kendali (MapOps) dan Evaluasi Kinerja

📊 Fokus Lapisan:
Menjamin transparansi pemantauan langsung seluruh aktivitas lapangan, menjaga kerahasiaan kanal telemetri real-time melalui partisi ruangan yang ketat, dan memvalidasi keakuratan evaluasi kinerja bisnis.

Target Komponen & Sub-sistem:
- Pusat Kendali MapOps: Visualisasi komprehensif seluruh layer operasional (zona, titik mikro, POI, jalan terlarang, posisi armada bergerak).
- Partisi Ruangan Komunikasi Socket.io: Isolasi kanal telemetri (management_room, supervisors_room, riders_room, dan user_[id]).
- Sistem Peringatan Real-Time: Notifikasi instan saat terjadi deviasi OUTSIDE_ZONE atau peringatan cuaca buruk mendadak.
- Evaluasi Keputusan vs Realitas (Decision vs Reality): Korelasi analitis antara skor rekomendasi DSS dan pendapatan riil dari sales_logs.

Skenario Ancaman & Vektor Serangan:
- Penyadapan Kanal WebSocket (Eavesdropping): Pengguna dengan akun RIDER menyusup ke dalam supervisors_room atau management_room untuk memantau data rahasia seluruh armada atau pendapatan perusahaan.
- Injeksi Pesan Palsu via Socket: Pengguna mengirimkan event telemetri palsu tanpa melalui verifikasi token handshake.
- Paparan Data Berlebih (Excessive Information Exposure): Endpoint laporan dashboard mengekspos informasi diagnostik internal, kredensial, atau data pribadi yang tidak relevan.
- Manipulasi Hasil Evaluasi Kinerja: Akses tidak sah ke endpoint analitik yang memungkinkan pengubahan angka pencapaian target penjualan.

Checklist Verifikasi Integritas & Keamanan:
- Setiap koneksi masuk WebSocket wajib melewati middleware verifikasi token JWT pada fase handshake sebelum diizinkan terhubung.
- Pengelompokan ruangan (socket.join) wajib ditentukan secara eksklusif oleh server berdasarkan peran pengguna yang terverifikasi di token (bukan permintaan dari klien).
- Klien hanya diizinkan mengirimkan event koordinat posisi LBS; seluruh event instruksi dan notifikasi bersifat satu arah dari server ke klien.
- Endpoint ringkasan MapOps dan laporan eksekutif wajib dibatasi hanya untuk peran SUPERADMIN, MANAGEMENT, dan SUPERVISOR.
- Komparasi Decision vs Reality wajib dihitung murni dari agregasi data historis terpercaya tanpa kemungkinan intervensi manual dari parameter eksternal.

---

# 7. Layanan Pendukung dan Pemrosesan Latar Belakang

🔄 Fokus Lapisan:
Memastikan seluruh proses komputasi asinkron yang dijalankan oleh BullMQ worker tetap stabil, tidak membebani kapasitas memori, terlindung dari racun antrean (queue poisoning), dan dapat dipulihkan secara otomatis jika terjadi kegagalan sistem.

Target Komponen & Sub-sistem:
- Overpass Sync Worker: Antrean pengunduhan data spasial berkala (overpassSyncQueue).
- Armada Hold Worker: Antrean pelepasan otomatis masa tahanan unit armada (armadaHoldQueue).
- Notification Worker: Antrean pengiriman email aktivasi akun dan peringatan sistem (notificationQueue).
- DSS Batch Worker: Antrean kalkulasi rekomendasi zona massal terjadwal pada jam persiapan pagi hari (dssBatchQueue).

Skenario Ancaman & Vektor Serangan:
- Keracunan Antrean Pekerjaan (Queue Poisoning): Data payload pekerjaan yang rusak atau disengaja dimasukkan ke antrean Redis sehingga memicu kegagalan berulang (infinite crash loop) pada proses worker.
- Eksekusi Pekerjaan Bersamaan (Race Conditions in Workers): Dua instance worker memproses pembaruan status armada atau kalkulasi zona yang sama secara paralel tanpa koordinasi.
- Kebocoran Memori (Memory Leak): Pekerjaan pengolahan ribuan geometri peta yang tidak membersihkan variabel referensi di memori, menyebabkan thread worker kehabisan RAM.

Checklist Verifikasi Integritas & Keamanan:
- Setiap fungsi worker wajib memvalidasi struktur data payload pekerjaan sebelum menjalankan operasi bisnis di database.
- Seluruh fungsi worker wajib dibungkus di dalam blok penanganan error yang menangkap exception dan menandai status pekerjaan secara tepat tanpa mematikan proses utama.
- Operasi pengubahan data kritis pada worker wajib menggunakan transaksi database atomik untuk mencegah status setengah jadi.
- Pekerjaan sinkronisasi data spasial wajib mendokumentasikan hasil akhirnya ke tabel data_sync_runs dan menghormati jeda batas panggilan API pihak ketiga.
- Sistem wajib menyediakan batas maksimal percobaan ulang (max retries) dan antrean kegagalan (Dead Letter Queue) untuk pekerjaan yang gagal permanen.
