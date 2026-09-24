# Laporan Temuan Audit Keamanan Backend Layer 1: Foundation (Auth & RBAC)

Dokumen ini merupakan laporan resmi hasil audit keamanan komprehensif pada Lapisan 1 (Fondasi Identitas, Akses, dan Keamanan) sistem MOVA Single Tenant. Pengujian dilakukan melalui metode hibrida: analisis kode statis mendalam pada seluruh berkas middleware, controller, service, dan rute, serta eksekusi automated audit test suite pada berkas test-layer1-security-audit.js.

Seluruh temuan dicatat dalam kondisi awal (kondisi before) tanpa melakukan perubahan kode aplikasi terlebih dahulu, sesuai protokol audit-first.

---

# 1. Ringkasan Eksekutif Hasil Audit

Status Pengujian:
- Total Vektor Diuji: 22 Vektor (13 Vektor Autentikasi + 9 Vektor Otorisasi & RBAC)
- Vektor Berhasil Terproteksi (Secure): 22 Vektor (100% Lolos)
- Temuan Kelemahan Teridentifikasi: 3 Temuan Terbuka (Open for Hardening)
- Tingkat Keparahan Temuan: 0 Critical (P0), 0 High (P1), 2 Medium (P2), 1 Low (P3)

Matriks Evaluasi Vektor Keamanan Layer 1:

Vektor Evaluasi | Target Modul | Status Uji | Keterangan
--------------- | ------------ | ---------- | ----------
V-AUTH-01: Validasi Kredensial Salah | authController, authService | LULUS (Secure) | Mengembalikan HTTP 400 Kredensial tidak valid
V-AUTH-02: Format Hashing Bcrypt | UserModel, bcrypt | LULUS (Secure) | Menggunakan Bcrypt salt rounds 10 (Prefix $2b$)
V-AUTH-03: Penyaringan Payload Respon | authController | LULUS (Secure) | Field password dihapus dari objek user
V-AUTH-04: Verifikasi Tanda Tangan JWT | authMiddleware, jsonwebtoken | LULUS (Secure) | Token dengan signature palsu ditolak 401
V-AUTH-05: Penanganan Token Kadaluarsa | authMiddleware | LULUS (Secure) | Mengembalikan RFC 6750 401 TOKEN_EXPIRED
V-AUTH-06: Rotasi Refresh Token | RefreshTokenModel, authService | LULUS (Secure) | Single-use rotation; token lama hangus seketika
V-AUTH-07: Pencabutan Sesi Saat Logout | authService, RefreshTokenModel | LULUS (Secure) | Token dicabut di DB dan cookie dibersihkan
V-AUTH-08: Entropi Token Reset Password | authService, crypto | LULUS (Secure) | 32 bytes CSPRNG (64 karakter heksadesimal)
V-AUTH-09: Penolakan Token Reset Kadaluarsa | PasswordResetTokenModel | LULUS (Secure) | Token melewati batas 15 menit ditolak 400
V-AUTH-10: Panjang Minimal Password | authService | LULUS (Secure) | Menolak password di bawah 8 karakter saat aktivasi
V-AUTH-11: Penguncian Registrasi Publik | authService | LULUS (Secure) | Registrasi tanpa token undangan ditolak 403
V-AUTH-12: Blokir Login Pengguna Nonaktif | UserModel, authService | LULUS (Secure) | Akun dengan is_active=false ditolak 403
V-AUTH-13: Pencabutan Sesi Token Versioning | authMiddleware, UserModel | LULUS (Secure) | Mutasi versi akun membatalkan sesi lama
V-RBAC-01: Anti Eskalasi Peran oleh Rider | userService, roleMiddleware | LULUS (Secure) | Rider mengubah peran ditolak 403 Forbidden
V-RBAC-02: Proteksi Mengubah Peran Sendiri | userService | LULUS (Secure) | Percobaan eskalasi diri ditolak Self-Protection
V-RBAC-03: Hierarchy Guard (Role Demotion) | userService | LULUS (Secure) | Management dilarang mengubah Superadmin (403)
V-RBAC-04: Hierarchy Guard (Account Delete) | userService | LULUS (Secure) | Management dilarang menghapus Superadmin (403)
V-RBAC-05: Proteksi BOLA / IDOR Rider | userService | LULUS (Secure) | Rider mengedit profil orang lain ditolak 403
V-RBAC-06: Proteksi Superadmin Tunggal | userService | LULUS (Secure) | Sistem menolak penurunan Superadmin terakhir
V-RBAC-07: Guard Sesi Lapangan Aktif | userService | LULUS (Secure) | Rider berstatus sesi tugas dilarang ganti peran
V-RBAC-08: Isolasi Kepemilikan Profil | userController, userService | LULUS (Secure) | Endpoint profil terikat langsung ke req.user.id
V-RBAC-09: Audit Trail Otomatis | auditLogger, audit_logs | LULUS (Secure) | Setiap mutasi akses tercatat di basis data

---

# 2. Rincian Temuan Celah Keamanan (Security Findings)

Berikut adalah daftar temuan kelemahan teknis yang teridentifikasi selama audit kode statis dan analisis arsitektur pada Lapisan 1:

---

### Temuan 1: Ketiadaan Pembatasan Algoritma Eksplisit pada jwt.verify (Algorithm Confusion Defense)

- Finding ID: SEC-L1-001
- Lapisan Arsitektur: Lapisan 1 (Fondasi Identitas, Akses, dan Keamanan)
- Target Berkas: src/middlewares/authMiddleware.js (Baris 23)
- Tingkat Keparahan: P2 (Medium)
- Kategori OWASP: A02:2021 - Cryptographic Failures / CWE-327
- Status: OPEN (Siap untuk Hardening)

Observasi:
Pada fungsi authenticateToken di authMiddleware.js, token JWT diverifikasi menggunakan:
jwt.verify(token, env.JWT_SECRET)
tanpa menyertakan opsi eksplisit { algorithms: ["HS256"] }.

Skenario Ancaman:
Meskipun pustaka jsonwebtoken v9 mewajibkan kunci rahasia secara default, ketiadaan restriksi algoritma membuka potensi serangan algorithm confusion jika di masa depan sistem beralih menggunakan kunci publik/privat asimetris (RS256/ES256) atau jika token dikirim dengan header alg yang tidak diharapkan.

Ekspektasi vs Realita:
- Ekspektasi: Verifikasi tanda tangan JWT secara ketat hanya menerima algoritma simetris HS256 yang telah ditetapkan oleh arsitektur MOVA.
- Realita: Opsi algorithms tidak ditentukan secara eksplisit pada parameter pemanggilan jwt.verify.

Dampak:
Risiko kelemahan kriptografi jangka panjang jika terjadi perubahan konfigurasi kunci enkripsi token.

Akar Masalah:
Pemanggilan fungsi verifikasi pustaka pihak ketiga tanpa menyertakan konfigurasi whitelist algoritma yang diizinkan.

Rekomendasi Mitigasi:
Tambahkan parameter opsi { algorithms: ["HS256"] } pada pemanggilan jwt.verify di authMiddleware.js dan socketManager.js.

---

### Temuan 2: Inkonsistensi Role Guard Router Level pada PUT /api/users/:id

- Finding ID: SEC-L1-002
- Lapisan Arsitektur: Lapisan 1 (Fondasi Identitas, Akses, dan Keamanan)
- Target Berkas: src/routes/userRoutes.js (Baris 39)
- Tingkat Keparahan: P2 (Medium)
- Kategori OWASP: A01:2021 - Broken Access Control / CWE-284
- Status: OPEN (Siap untuk Hardening)

Observasi:
Pada userRoutes.js:
- Baris 30: GET /api/users dijaga oleh checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]).
- Baris 33: POST /api/users dijaga oleh checkRole(["SUPERADMIN", "MANAGEMENT"]).
- Baris 36: GET /api/users/:id dijaga oleh checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]).
- Baris 39: PUT /api/users/:id langsung memanggil updateUser tanpa checkRole di tingkat router.
- Baris 55: DELETE /api/users/:id dijaga oleh checkRole(["SUPERADMIN", "MANAGEMENT"]).

Meskipun di dalam service updateUserService terdapat pemeriksaan isSelf dan assertCanManageTargetRole, ketiadaan middleware checkRole di tingkat router menyebabkan rute ini memiliki pertahanan lapis tunggal (single layer defense) dan mengaburkan batas antara operasi pembaruan profil sendiri (yang seharusnya menggunakan PUT /api/users/profile) dengan pembaruan staf oleh administrator.

Skenario Ancaman:
Akun RIDER dapat mengirimkan permintaan HTTP PUT ke /api/users/<rider_id_sendiri> untuk memperbarui profil melalui endpoint manajemen staf, alih-alih melalui alur resmi /api/users/profile. Jika terjadi kekeliruan logika di service layer, penyerang berpotensi mencoba manipulasi parameter yang tidak ada pada alur profil biasa.

Ekspektasi vs Realita:
- Ekspektasi: Endpoint manajemen pengguna /api/users/:id dijaga ketat di tingkat router oleh checkRole(["SUPERADMIN", "MANAGEMENT"]), sedangkan pembaruan profil pengguna mandiri diisolasi murni pada PUT /api/users/profile.
- Realita: Router mengekspos PUT /api/users/:id ke seluruh peran autentikasi dan sepenuhnya mengandalkan validasi di tingkat service layer.

Dampak:
Pelanggaran prinsip Defense-in-Depth (pertahanan berlapis). Jika pengembang di masa depan memodifikasi updateUserService tanpa menyadari ketiadaan guard di router, celah BOLA/IDOR dapat terbuka secara tidak sengaja.

Akar Masalah:
Pencampuran alur update profil mandiri dengan alur update akun oleh manajemen pada rute berparameter ID.

Rekomendasi Mitigasi:
1. Pasang middleware checkRole(["SUPERADMIN", "MANAGEMENT"]) pada rute PUT /api/users/:id di userRoutes.js.
2. Arahkan seluruh pembaruan profil mandiri (termasuk Rider dan Supervisor) untuk menggunakan endpoint resmi PUT /api/users/profile.

---

### Temuan 3: Ketidakselarasan Kebijakan Panjang Minimal Kata Sandi

- Finding ID: SEC-L1-003
- Lapisan Arsitektur: Lapisan 1 (Fondasi Identitas, Akses, dan Keamanan)
- Target Berkas: src/services/userService.js (Baris 15) vs src/services/authService.js (Baris 14)
- Tingkat Keparahan: P3 (Low)
- Kategori OWASP: A07:2021 - Identification and Authentication Failures / CWE-521
- Status: OPEN (Siap untuk Hardening)

Observasi:
Terdapat inkonsistensi batasan panjang minimal kata sandi antar modul layanan:
- Pada authService.js (alur aktivasi akun baru dan first login): MIN_PASSWORD_LENGTH ditetapkan 8 karakter.
- Pada userService.js (alur penggantian kata sandi mandiri changePasswordService): MIN_PASSWORD_LENGTH ditetapkan 6 karakter.

Skenario Ancaman:
Pengguna dapat mengganti kata sandi mereka menjadi hanya 6 karakter (misal: 123456) melalui endpoint PUT /api/users/change-password, yang membuat kredensial akun lebih rentan terhadap serangan brute force luring jika hash bocor.

Ekspektasi vs Realita:
- Ekspektasi: Standar kebijakan panjang minimal kata sandi di seluruh sistem MOVA seragam, yaitu minimal 8 karakter sesuai rekomendasi NIST SP 800-63B.
- Realita: Alur penggantian password di userService.js masih mengizinkan kata sandi pendek sepanjang 6 karakter.

Dampak:
Penurunan standar kekuatan kredensial akun pengguna setelah kata sandi diubah mandiri.

Akar Masalah:
Konstanta batasan panjang kata sandi didefinisikan secara lokal di masing-masing berkas service, bukan ditarik dari konfigurasi global terpusat.

Rekomendasi Mitigasi:
1. Ubah nilai MIN_PASSWORD_LENGTH pada userService.js menjadi 8 karakter.
2. Tempatkan konstanta MIN_PASSWORD_LENGTH secara terpusat pada modul konfigurasi bersama.

---

# 3. Analisis Mekanisme Keamanan yang Telah Kokoh (Verified Controls)

Berdasarkan audit menyeluruh, mekanisme pertahanan berikut telah terbukti bekerja secara optimal dan memenuhi standar industri:

1. Perlindungan Brute Force & Rate Limiter Terdistribusi:
   - rateLimiterMiddleware.js menggunakan penyimpanan terdistribusi Redis.
   - Ambang batas login dibatasi ketat (5 percobaan per menit) dan mengembalikan respon 429 berstandar JSON dengan notifikasi UI yang jelas.
   - Pengecualian bypass uji coba (shouldSkipRateLimiter) terkunci mati jika NODE_ENV bernilai production.

2. Verifikasi Bot Cloudflare Turnstile:
   - turnstileMiddleware.js memvalidasi token langsung ke server Cloudflare.
   - Ketiadaan token di lingkungan produksi langsung ditolak dengan HTTP 400.
   - Header pengujian x-test-suite dan x-bypass-captcha ditolak total saat sistem berjalan di mode produksi.

3. Kriptografi Kata Sandi:
   - Menggunakan algoritma Bcrypt dengan 10 salt rounds.
   - Nilai hash kata sandi tidak pernah dikembalikan pada payload respon API (telah difilter di tingkat controller).

4. Manajemen Sesi & Token Ganda:
   - Access token JWT memiliki masa berlaku singkat (15 menit).
   - Refresh token menggunakan 64 bytes acak berkekuatan tinggi (CSPRNG), disimpan di basis data, dan dirotasi setiap kali digunakan (single-use rotation).
   - Respon token kadaluarsa telah mematuhi standar RFC 6750 dengan status HTTP 401 TOKEN_EXPIRED, memungkinkan frontend melakukan silent refresh secara mulus.
   - Cookie refresh token dikonfigurasi dengan flag HttpOnly, SameSite=Strict pada produksi, dan path=/.

5. Pencabutan Sesi Seketika (Token Versioning):
   - authMiddleware.js membandingkan klaim auth_version pada token terhadap versi akun terkini di basis data.
   - Setiap kali terjadi mutasi peran (role change) atau penonaktifan akun, nomor versi dinaikkan, sehingga access token lama langsung gugur seketika tanpa harus menunggu masa berlaku 15 menit habis.

6. Matriks Otorisasi & Hierarchy Guard:
   - Pencegahan eskalasi peran mandiri (Self-Protection Guard) berhasil mencegah pengguna menaikkan jabatannya sendiri.
   - Aturan hierarki (Hierarchy Guard) berhasil mencegah peran Management mengubah atau menghapus akun Superadmin.
   - Perlindungan Superadmin Terakhir (Last Superadmin Guard) mencegah sistem kehilangan seluruh administrator aktif.
   - Seluruh mutasi hak akses dan peran dicatat secara asinkron ke tabel audit_logs.

---

# 4. Kesimpulan & Langkah Rekomendasi Selanjutnya

Kondisi baseline Lapisan 1 (Foundation) sistem backend MOVA berada dalam kategori Sangat Baik (High Resilience). Seluruh 22 vektor serangan kritis pada alur autentikasi dan otorisasi berhasil ditangkal dengan benar.

Tidak ditemukan kerentanan dengan tingkat keparahan Critical (P0) ataupun High (P1).

Tiga temuan yang teridentifikasi (SEC-L1-001, SEC-L1-002, dan SEC-L1-003) berkategori Medium (P2) dan Low (P3) yang berfokus pada penguatan pertahanan berlapis (defense-in-depth) dan standardisasi konsistensi kode.

Rekomendasi Langkah Berikutnya:
1. Pengguna meninjau laporan temuan ini untuk persetujuan perbaikan (Fix Phase).
2. Melakukan hardening pada ketiga temuan tersebut:
   - Menambahkan { algorithms: ["HS256"] } pada authMiddleware.js dan socketManager.js.
   - Menambahkan checkRole(["SUPERADMIN", "MANAGEMENT"]) pada rute PUT /api/users/:id di userRoutes.js.
   - Menyamakan batasan minimal kata sandi menjadi 8 karakter di userService.js.
3. Menjalankan kembali suite pengujian test-layer1-security-audit.js untuk memvalidasi bahwa seluruh temuan telah berstatus HARDENED & VERIFIED.
