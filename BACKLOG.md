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
  - Perbaikan animasi Meteocons: menghilangkan efek fade yang mengganggu ✅





- penambahan FAQ pada halaaman system ⚠️
- perbaikan hubungi superadmin di halaman FAQ

- pembuatan halaman master poi 

- pembuatan halaman map ops 
- pembuatan halaman jalan protocol & TOL
- pembuatan halaman Kompetitor 

- pembuatan halaman 
	