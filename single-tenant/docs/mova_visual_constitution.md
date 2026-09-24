# Konstitusi Desain Visual MOVA Single Tenant

Dokumen ini merupakan panduan baku tata visual, hierarki antarmuka, dan standar pengalaman pengguna aplikasi MOVA. Seluruh halaman dan komponen visual wajib mematuhi prinsip dalam dokumen ini agar sistem tetap utuh, konsisten, dan berfungsi sebagai perangkat lunak operasional tingkat enterprise.

---

# 1. Filosofi Inti dan North Star

🏛️ Prinsip Dasar:
Carbon memiliki bahasa visual, MOVA memiliki perilaku operasional. Desain MOVA berakar pada Carbon Design System yang diadaptasi khusus untuk kebutuhan operasional armada lapangan dan analisis spasial cerdas.

🎯 Karakter Visual Utama:
Dense but Calm (Padat namun Tenang).
- Bukan halaman kosong dengan terlalu banyak ruang putih yang minim informasi.
- Bukan menumpuk semua data mentah sekaligus tanpa struktur.
- Informasi disajikan cukup padat untuk efisiensi kerja operator, tetapi tetap teratur dengan hierarki visual yang jelas dan tenang di mata.

---

# 2. Hierarki Informasi dan Alur Pengungkapan Bertahap

🧭 Pertanyaan Penuntun Setiap Halaman:
Setiap layar antarmuka harus langsung menjawab pertanyaan utama pengguna secara berurutan:
1. Apa objek atau kondisi yang paling penting dilihat sekarang?
2. Berapa jumlah atau besaran dampaknya?
3. Di mana lokasinya secara geografis?
4. Apa rincian spesifik saat objek dipilih?
5. Apa metadata teknis pendukungnya?

🔍 Alur Progressive Disclosure:
Informasi kompleks disajikan bertingkat agar tidak membebani pengguna:
- Tingkat 1: Ringkasan Global (Contoh: Total ruas jalan terlarang dan peta wilayah).
- Tingkat 2: Pencarian dan Filter Cepat (Pencarian nama jalan atau penyaringan kategori).
- Tingkat 3: Objek Terpilih (Menyorot satu jalan atau satu zona di peta).
- Tingkat 4: Rincian Operasional (Nama jalan, status pembatasan, waktu pembaruan).
- Tingkat 5: Rincian Teknis (ID OpenStreetMap, tipe geometri, status PostGIS yang diletakkan dalam akordion detail).

---

# 3. Larangan Gaya Visual AI Generik (0% AI-Looking UI)

🚫 Batasan Ketat:
MOVA adalah perangkat lunak operasional profesional, bukan produk demo kecerdasan buatan. Hindari seluruh elemen dekoratif bergaya futuristik yang mengalihkan fokus kerja:
- Tanpa efek kilau bintang (sparkles).
- Tanpa efek cahaya neon atau glow.
- Tanpa efek kaca buram (glassmorphism).
- Tanpa tampilan bergaya sci-fi HUD atau cyber.
- Tanpa kartu yang melayang berlebihan dengan bayangan tebal.
- Tanpa gradien warna dekoratif yang tidak memiliki arti fungsi.
- Tanpa badge atau label AI yang tidak memberikan nilai operasional.

---

# 4. Semantik Warna dan Tipografi

🎨 Warna adalah Informasi, Bukan Hiasan:
Warna hanya digunakan untuk menyampaikan status dan arti fungsional:
- Merah: Bahaya, pembatasan ketat jalan tol, atau error kritis.
- Oranye / Amber: Peringatan, jalan protokol terlarang, atau status tertunda.
- Hijau: Operasi normal, zona layak, atau aksi sukses.
- Biru / Carbon Primary: Elemen terpilih, fokus kamera, atau aksi utama.
- Netral (Abu-abu / Carbon Slate): Struktur latar, divider, dan teks sekunder.

📐 Tipografi yang Jelas dan Terbaca:
- Kepadatan informasi dicapai melalui tata letak dan pengelompokan yang rapi, bukan dengan mengecilkan ukuran teks secara ekstrem.
- Hindari penggunaan teks ukuran 10-11px secara luas.
- Gunakan keluarga huruf IBM Plex Sans atau Inter untuk antarmuka utama. Font monospace hanya digunakan pada data koordinat, ID transaksi, atau kode log teknis.

---

# 5. Geometri Produktif dan Anti Card Soup

📦 Struktur Tata Letak Produktif:
- Gunakan sudut persegi (rectangular productive geometry) dengan radius sudut kecil dan tegas (2px hingga 6px).
- Hindari sudut kartu yang terlalu melengkung lebar (pill-shape atau rounded ekstrem) yang menyerupai aplikasi konsumen.

🧩 Menghindari Penumpukan Kartu (Card Soup):
Jangan membungkus setiap elemen ke dalam kartu mengambang yang terpisah-pisah. Gunakan pembagian ruang yang bervariasi:
- Pembatas garis tipis (dividers).
- Panel samping terintegrasi (side panels / drawers).
- Tata letak kisi struktural (structured grid).
- Tabel data modular.
- Tab navigasi kontekstual.

---

# 6. Bahasa Domain Operasional

💬 Istilah Bisnis Menggantikan Istilah Teknis:
Antarmuka harus berkomunikasi menggunakan istilah operasional armada yang dipahami operator:
- Gunakan: Jalan Protokol (bukan: protocol_roads atau highway=primary).
- Gunakan: Jalan Tol (bukan: PROHIBITED_TOLL_ROAD atau highway=motorway).
- Gunakan: Pembaruan Data (bukan: Overpass Sync Ingestion).
- Gunakan: Area Operasional (bukan: Bounding Box EPSG:4326).
- Gunakan: Titik Keramaian (bukan: pois_raw table).

---

# 7. Pola Desain Berbasis Tujuan Layar

🎯 Satu Pekerjaan Utama per Halaman:
Tata letak ditentukan oleh tujuan utama pengguna datang ke halaman tersebut:
- Halaman Pembatasan Jalan: Berorientasi peta penuh (Map-First) karena konteks spasial jalan adalah inti informasi.
- Halaman Kompetitor: Berorientasi peta penuh (Map-First) untuk melihat konsentrasi sebaran pesaing.
- Halaman Master POI: Berorientasi tabel data dengan peta pendamping (Table/Data-First) karena operator lebih sering mencari, memeriksa, dan menyortir data.
- Halaman Cuaca: Berorientasi ringkasan matriks risiko dan lini masa jam kerja armada.
- Halaman DSS Rekomendasi: Berorientasi hasil analisis, perangkingan zona, dan simulasi penugasan.

---

# 8. Manajemen Status dan Ketiadaan Data Palsu

⚡ Desain Status Lengkap (State-Aware UI):
Setiap layar wajib mengantisipasi seluruh kemungkinan kondisi sistem:
- Kondisi Memuat (Loading): Gunakan kerangka placeholder (skeleton) yang tenang.
- Kondisi Kosong (Empty): Tampilkan pesan jelas mengenai langkah yang perlu dilakukan.
- Kondisi Gagal (Error): Sampaikan pesan dalam bahasa manusia yang ramah, sertakan tombol coba lagi, dan simpan pesan teknis di bagian rincian.
- Kondisi Data Lama (Stale): Berikan penanda waktu pembaruan terakhir.

🛡️ Larangan Keras Data Tiruan (Zero Mock Data):
- Tidak boleh ada data statis palsu (dummy/mock array) di dalam kode frontend hanya agar tampilan tampak terisi.
- Seluruh data wajib mengalir dari API contract backend dan database riil.
- Jika fitur backend belum siap, tampilkan status tunggu kontrak API yang jelas.

---

# 9. Aksesibilitas dan Gerakan Antarmuka

👁️ Aksesibilitas Terintegrasi:
- Rasio kontras teks terhadap latar belakang memenuhi standar keterbacaan tinggi.
- Status tidak hanya ditandai oleh warna, melainkan juga dilengkapi label teks atau ikon penjelas.
- Seluruh aksi tombol dan menu dapat dioperasikan melalui keyboard.

⚡ Animasi Fungsional dan Subtil:
- Animasi hanya digunakan untuk umpan balik interaksi (hover halus, transisi pembukaan panel, indikator proses).
- Hindari animasi dekoratif yang memantul, melayang terus-menerus, atau memperlambat respon aplikasi.

---

# 10. Perbedaan Desain Supervisor Desktop vs Rider Mobile

🖥️ Antarmuka Desktop (Supervisor dan Manajemen):
- Kepadatan data tinggi untuk pengawasan multi-zona.
- Layar kerja terintegrasi dengan tabel, grafik metrik, dan kanvas peta besar.
- Fitur analisis mendalam, filter multisegi, dan kontrol audit.

📱 Antarmuka Mobile (Rider Lapangan):
- Area sentuh besar dan ramah jari saat berada di atas sepeda motor.
- Kontras visual sangat tinggi untuk keterbacaan di bawah sinar matahari.
- Satu keputusan utama per layar untuk meminimalkan beban kognitif saat berkendara.
- Navigasi ringkas tanpa tabel yang padat atau menu bersarang.
