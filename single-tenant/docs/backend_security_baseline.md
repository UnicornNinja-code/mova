# Dokumen Baseline Audit Keamanan Backend MOVA Single Tenant

Dokumen ini merupakan catatan Security Audit Baseline resmi sistem backend MOVA Single Tenant yang dikunci sebelum proses audit dan pengujian penetrasi mendalam dijalankan. Tujuannya adalah mendokumentasikan kondisi awal (kondisi before) secara objektif, lengkap, dan terukur agar dapat dibandingkan dengan hasil akhir (kondisi after).

---

# 1. Informasi Lingkungan & Versi Sistem

Metadata Lingkungan Operasional:
- Git Branch: main
- Commit Hash Baseline: ebd78ec (backlog update)
- Tanggal Freeze Baseline: 23 September 2026
- Runtime Bun: 1.4.0
- Runtime Node.js: v24.11.0
- Basis Data Utama: PostgreSQL 15+ dengan ekstensi spasial PostGIS 3.x
- Cache & Antrean: Redis 7.x (IoRedis & Redis Client)
- Mode Lingkungan: development, test, production (dikelola via src/config/env.js)

Daftar Versi Dependensi (package.json):
- express: ^5.2.1
- jsonwebtoken: ^9.0.3
- bcrypt: ^6.0.0
- cookie-parser: ^1.4.7
- cors: ^2.8.6
- helmet: ^8.3.0
- express-rate-limit: ^8.6.1
- rate-limit-redis: ^6.0.1
- ioredis: ^6.0.0
- redis: ^6.1.0
- bullmq: ^6.0.7
- pg: ^8.22.0
- pg-format: ^1.0.4
- javascript-lp-solver: ^1.0.3
- socket.io: ^4.8.3
- socket.io-client: ^4.8.3
- openmeteo: ^1.2.3
- nodemailer: ^9.0.5
- swagger-ui-express: ^5.0.1
- yamljs: ^0.3.0
- compression: ^1.8.1
- dotenv: ^17.4.2
- crypto: ^1.0.1
- nodemon (dev): ^3.1.14

Mekanisme Unggah Berkas:
- Tidak ada modul multipart/form-data (seperti multer atau busboy). Seluruh pengunggahan massal (bulk ingestion) diproses melalui payload JSON mentah berformat array.

Mekanisme Logging & Audit Trail:
- Audit Log Transaksional: AuditLogger.js menulis rekaman aksi secara asinkron ke tabel basis data audit_logs (kolom: user_id, user_role, action, entity_type, entity_id, details, ip_address, user_agent, status).
- Audit Riwayat ETL Data: syncRunRepository.js mencatat seluruh metrik penarikan data ke tabel data_sync_runs (kolom: data_type, source, status, records_extracted, records_inserted, records_updated, records_rejected, duration_ms, metadata).
- System Console: Logging standar Node/Bun untuk event siklus hidup HTTP server, Redis connection, dan WebSocket lifecycle.

---

# 2. Peta Arsitektur (Architecture Map)

Diagram hubungan struktural modul backend MOVA:

```text
[ Client Applications ]
  ├── Web Management (Superadmin, Management, Supervisor)
  └── Mobile / PWA App (Rider Lapangan)
           │
           ▼ (HTTPS / WSS)
[ Edge & Perimeter Guards ]
  ├── CORS & Helmet Headers
  ├── Cloudflare Turnstile Bot Filter
  └── Redis Distributed Rate Limiter
           │
           ▼
[ Lapisan 1: Identity, Auth & Global Config ]
  ├── authMiddleware (JWT Verification, RFC 6750 401 TOKEN_EXPIRED)
  ├── roleMiddleware (RBAC Guard: SUPERADMIN, MANAGEMENT, SUPERVISOR, RIDER)
  └── OperationalRuleService (Dynamic rules in system_settings)
           │
           ▼
[ Lapisan 2: Ingestion & Intelligence Data ]
  ├── POI Intelligence (Overpass OSM, Auto-cluster, 15m Deduplication)
  ├── Road Intelligence (Protocol & Toll Roads, PostGIS LineMerge)
  ├── Weather Intelligence (Open-Meteo H+1, 06.00-21.00 WIB Slot C4)
  ├── Competitor Intelligence (Survey & Proximity C6)
  └── Spatial Scope Guard (Batas Wilayah Kab. Sidoarjo)
           │
           ▼
[ Lapisan 3: PostGIS Spatial Engine ]
  ├── Poligon Zona Makro (Containment & Intersection, ST_Covers)
  ├── Titik Jualan Mikro (ST_Contains, Buffer 10m Jalan Terlarang, Anti-duplikasi 5m)
  └── LBS Real-Time Engine (COMPLIANT, DEVIATED, OUTSIDE_ZONE)
           │
           ▼
[ Lapisan 4: Decision Support Engine (DSS) ]
  ├── BWM Optimizer (javascript-lp-solver, Linear Programming, Consistency Ratio)
  └── TOPSIS Multi-Criteria Engine (Normalisasi Vektor, C1-C6, Ideal Solutions)
           │
           ▼
[ Lapisan 5: Operations, Distribution & Retail Sales ]
  ├── Fleet Readiness (Armada Status & Motorcycle Cart Unit)
  ├── Distribution Run (Waiting Queue, Zona Capacity FIFO / Manual)
  ├── Operational Session Lifecycle (Check-in, On-duty, Check-out)
  └── Retail Sales Pipeline (products catalog delete guard, sales_logs provenance)
           │
           ▼
[ Lapisan 6: Command Center MapOps & Evaluation ]
  ├── MapOps Unified Canvas (Real-time telemetry)
  ├── Socket.io Room Segregation (management_room, supervisors_room, riders_room)
  └── Performance Evaluation (Decision vs Reality: DSS Prediction vs Real Sales)
           │
           ▼
[ Layanan Latar Belakang (BullMQ Workers) ]
  ├── overpassSyncQueue / overpassWorker
  ├── armadaHoldQueue / armadaHoldWorker
  ├── notificationQueue / notificationWorker
  └── dssBatchQueue / dssBatchWorker
```

---

# 3. Inventaris Endpoint Lengkap (Endpoint Inventory)

Berikut adalah daftar lengkap 24 berkas rute API beserta endpoint, metode HTTP, middleware keamanan, dan pengendali controller terkait:

1. Rute Autentikasi (src/routes/authRoutes.js):
   - POST /api/auth/register : Publik dengan Turnstile | authController.register
   - POST /api/auth/login : Publik dengan Turnstile & Rate Limiter | authController.login
   - POST /api/auth/refresh : Publik dengan Cookie Parser | authController.refreshToken
   - POST /api/auth/logout : Autentikasi Token | authController.logout
   - GET /api/auth/me : Autentikasi Token | authController.getMe
   - POST /api/auth/change-password : Autentikasi Token | authController.changePassword

2. Rute Manajemen Pengguna (src/routes/userRoutes.js):
   - GET /api/users : Token, RBAC (SUPERADMIN, MANAGEMENT) | userController.getUsers
   - GET /api/users/riders : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | userController.getRiders
   - GET /api/users/:id : Token, RBAC (SUPERADMIN, MANAGEMENT) | userController.getUserById
   - POST /api/users : Token, RBAC (SUPERADMIN) | userController.createUser
   - PUT /api/users/:id : Token, RBAC (SUPERADMIN) | userController.updateUser
   - DELETE /api/users/:id : Token, RBAC (SUPERADMIN) | userController.deleteUser

3. Rute Pengaturan Sistem (src/routes/systemSettingRoutes.js):
   - GET /api/system/settings : Token, RBAC (SUPERADMIN, MANAGEMENT) | systemSettingController.getSettings
   - PUT /api/system/settings : Token, RBAC (SUPERADMIN) | systemSettingController.updateSettings
   - GET /api/system/rules : Token, Semua Peran | systemSettingController.getOperationalRules
   - PUT /api/system/rules : Token, RBAC (SUPERADMIN) | systemSettingController.updateOperationalRules
   - GET /api/system/operational-scope : Publik / Terbuka | systemSettingController.getOperationalScope

4. Rute POI / Titik Keramaian (src/routes/poiRoutes.js):
   - GET /api/pois : Token, Semua Peran | poiController.getPois
   - GET /api/pois/:id : Token, Semua Peran | poiController.getPoiById
   - POST /api/pois : Token, RBAC (SUPERADMIN, SUPERVISOR) | poiController.createPoi
   - PUT /api/pois/:id : Token, RBAC (SUPERADMIN, SUPERVISOR) | poiController.updatePoi
   - DELETE /api/pois/:id : Token, RBAC (SUPERADMIN) | poiController.deletePoi
   - POST /api/pois/bulk : Token, RBAC (SUPERADMIN, SUPERVISOR) | poiController.bulkCreatePois
   - PATCH /api/pois/:id/approval : Token, RBAC (SUPERADMIN, SUPERVISOR) | poiController.updateApprovalStatus

5. Rute Kategori POI (src/routes/poiCategoryRoutes.js):
   - GET /api/poi-categories : Token, Semua Peran | poiCategoryController.getCategories
   - POST /api/poi-categories : Token, RBAC (SUPERADMIN) | poiCategoryController.createCategory
   - PUT /api/poi-categories/:id : Token, RBAC (SUPERADMIN) | poiCategoryController.updateCategory
   - PUT /api/poi-categories/crowd-scores : Token, RBAC (SUPERADMIN) | poiCategoryController.updateBulkCrowdScores
   - POST /api/poi-categories/time-scores/bulk : Token, RBAC (SUPERADMIN) | poiCategoryController.bulkUpdatePoiCategoryTimeScores

6. Rute Pembatasan Jalan (src/routes/roadRoutes.js):
   - GET /api/roads : Token, Semua Peran | roadController.getRoads
   - GET /api/roads/protocol : Token, Semua Peran | roadController.getProtocolRoads
   - GET /api/roads/toll : Token, Semua Peran | roadController.getTollRoads
   - POST /api/roads/sync/protocol : Token, RBAC (SUPERADMIN, SUPERVISOR) | roadController.syncProtocolRoads
   - POST /api/roads/sync/toll : Token, RBAC (SUPERADMIN, SUPERVISOR) | roadController.syncTollRoads

7. Rute Intelijen Kompetitor (src/routes/competitorRoutes.js):
   - GET /api/competitors : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | competitorController.getCompetitors
   - POST /api/competitors : Token, RBAC (SUPERADMIN, SUPERVISOR) | competitorController.createCompetitor
   - PUT /api/competitors/:id : Token, RBAC (SUPERADMIN, SUPERVISOR) | competitorController.updateCompetitor
   - DELETE /api/competitors/:id : Token, RBAC (SUPERADMIN) | competitorController.deleteCompetitor
   - POST /api/competitors/bulk : Token, RBAC (SUPERADMIN, SUPERVISOR) | competitorController.bulkCreateCompetitors

8. Rute Prakiraan Cuaca (src/routes/weatherRoutes.js):
   - GET /api/weather/current : Token, Semua Peran | weatherController.getCurrentWeather
   - GET /api/weather/forecast : Token, Semua Peran | weatherController.getForecast
   - GET /api/weather/hub : Token, Semua Peran | weatherController.getHubWeatherSummary
   - POST /api/weather/sync : Token, RBAC (SUPERADMIN) | weatherController.triggerWeatherSync

9. Rute Zona Operasional (src/routes/zoneRoutes.js):
   - GET /api/zones : Token, Semua Peran | zoneController.getZones
   - GET /api/zones/:id : Token, Semua Peran | zoneController.getZoneById
   - POST /api/zones : Token, RBAC (SUPERADMIN, SUPERVISOR) | zoneController.createZone
   - PUT /api/zones/:id : Token, RBAC (SUPERADMIN, SUPERVISOR) | zoneController.updateZone
   - DELETE /api/zones/:id : Token, RBAC (SUPERADMIN) | zoneController.deleteZone

10. Rute Titik Jualan Mikro (src/routes/candidateSellingLocationRoutes.js):
    - GET /api/candidate-selling-locations/zone/:zoneId : Token, Semua Peran | candidateSellingLocationController.getByZoneId
    - POST /api/candidate-selling-locations : Token, RBAC (SUPERADMIN, SUPERVISOR) | candidateSellingLocationController.createCandidate
    - POST /api/candidate-selling-locations/:id/evaluate : Token, RBAC (SUPERADMIN, SUPERVISOR) | candidateSellingLocationController.evaluateCandidate
    - POST /api/candidate-selling-locations/zone/:zoneId/evaluate : Token, RBAC (SUPERADMIN, SUPERVISOR) | candidateSellingLocationController.evaluateZoneCandidates

11. Rute Sistem Pendukung Keputusan / DSS (src/routes/dssRoutes.js):
    - GET /api/dss/criteria : Token, Semua Peran | dssController.getCriteria
    - POST /api/dss/bwm/weights : Token, RBAC (SUPERADMIN, SUPERVISOR) | dssController.calculateBwmWeights
    - POST /api/dss/topsis/recommendations : Token, RBAC (SUPERADMIN, SUPERVISOR) | dssController.calculateTopsisRecommendations
    - GET /api/dss/histories : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | dssController.getDssHistories
    - GET /api/dss/histories/:id : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | dssController.getDssHistoryById

12. Rute Manajemen Distribusi (src/routes/distributionRoutes.js):
    - GET /api/distribution/overview : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | distributionController.getOverview
    - POST /api/distribution/auto : Token, RBAC (SUPERADMIN, SUPERVISOR) | distributionController.autoDistribute
    - POST /api/distribution/manual : Token, RBAC (SUPERADMIN, SUPERVISOR) | distributionController.manualDistribute
    - POST /api/distribution/duty/confirm : Token, RBAC (RIDER) | distributionController.confirmDuty
    - GET /api/distribution/duty/status : Token, RBAC (RIDER) | distributionController.getRiderStatus

13. Rute Sesi Operasional Rider (src/routes/riderOperationalRoutes.js):
    - POST /api/rider-operational/check-in : Token, RBAC (RIDER) | riderOperationalController.checkIn
    - POST /api/rider-operational/check-out : Token, RBAC (RIDER) | riderOperationalController.checkOut
    - GET /api/rider-operational/current-session : Token, RBAC (RIDER) | riderOperationalController.getCurrentSession
    - POST /api/rider-operational/sales : Token, RBAC (RIDER) | riderOperationalController.recordSale

14. Rute Lokasi & LBS (src/routes/lbsRoutes.js):
    - POST /api/lbs/ping : Token, RBAC (RIDER) | lbsController.processLocationPing
    - GET /api/lbs/riders/latest : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | lbsController.getLatestRidersPositions
    - GET /api/lbs/riders/:riderId/history : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | lbsController.getRiderLocationHistory

15. Rute Manajemen Armada (src/routes/armadaRoutes.js):
    - GET /api/armadas : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | armadaController.getArmadas
    - POST /api/armadas : Token, RBAC (SUPERADMIN) | armadaController.createArmada
    - PUT /api/armadas/:id : Token, RBAC (SUPERADMIN) | armadaController.updateArmada
    - PATCH /api/armadas/:id/status : Token, RBAC (SUPERADMIN, SUPERVISOR) | armadaController.updateArmadaStatus

16. Rute Katalog Produk (src/routes/productRoutes.js):
    - GET /api/products : Token, Semua Peran | productController.getProducts
    - GET /api/products/:id : Token, Semua Peran | productController.getProductById
    - POST /api/products : Token, RBAC (SUPERADMIN, MANAGEMENT) | productController.createProduct
    - PUT /api/products/:id : Token, RBAC (SUPERADMIN, MANAGEMENT) | productController.updateProduct
    - PATCH /api/products/:id/status : Token, RBAC (SUPERADMIN, MANAGEMENT) | productController.updateProductStatus
    - DELETE /api/products/:id : Token, RBAC (SUPERADMIN, MANAGEMENT) | productController.deleteProduct

17. Rute Laporan Penjualan (src/routes/salesRoutes.js):
    - GET /api/sales/overview : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | salesController.getSalesOverview
    - GET /api/sales/my-sales : Token, RBAC (RIDER) | salesController.getMySales

18. Rute Dasbor Eksekutif (src/routes/dashboardRoutes.js):
    - GET /api/dashboard/summary : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | dashboardController.getSummary
    - GET /api/dashboard/zone-performance : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | dashboardController.getZonePerformance

19. Rute Analitik Kinerja (src/routes/analyticsRoutes.js):
    - GET /api/analytics/dss-performance : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | analyticsController.getDssPerformance
    - GET /api/analytics/rider-productivity : Token, RBAC (SUPERADMIN, MANAGEMENT, SUPERVISOR) | analyticsController.getRiderProductivity

20. Rute Laporan & Ekspor Data (src/routes/reportRoutes.js):
    - GET /api/reports/sales : Token, RBAC (SUPERADMIN, MANAGEMENT) | reportController.getSalesReport
    - GET /api/reports/sales/export : Token, RBAC (SUPERADMIN, MANAGEMENT) | reportController.exportSalesReport
    - GET /api/reports/audit-logs : Token, RBAC (SUPERADMIN) | reportController.getAuditLogsReport

21. Rute Jejak Audit Sistem (src/routes/auditRoutes.js):
    - GET /api/audit/logs : Token, RBAC (SUPERADMIN) | auditController.getAuditLogs

22. Rute Sinkronisasi & Riwayat (src/routes/syncRoutes.js):
    - GET /api/sync/runs : Token, RBAC (SUPERADMIN, SUPERVISOR) | syncController.getSyncRuns
    - POST /api/sync/poi : Token, RBAC (SUPERADMIN, SUPERVISOR) | syncController.triggerPoiSync

23. Rute Pemicu Cron Manual (src/routes/cronRoutes.js):
    - POST /api/cron/poi-detection : Token, RBAC (SUPERADMIN) | cronController.triggerPoiDetection
    - POST /api/cron/weather-update : Token, RBAC (SUPERADMIN) | cronController.triggerWeatherUpdate

24. Rute Notifikasi Sistem (src/routes/notificationRoutes.js):
    - GET /api/notifications : Token, Semua Peran | notificationController.getMyNotifications
    - PATCH /api/notifications/:id/read : Token, Semua Peran | notificationController.markAsRead

---

# 4. Peta Autentikasi (Authentication Map)

Alur Kerja Autentikasi Pengguna:

1. Handshake Login:
   - Pengguna mengirim kredensial (email, password) dan turnstile_token ke POST /api/auth/login.
   - turnstileMiddleware memvalidasi token bot ke Cloudflare Turnstile API.
   - rateLimiterMiddleware memeriksa batasan frekuensi login berdasarkan IP (maksimal 5 percobaan per menit).
   - authController memverifikasi email dan membandingkan hash kata sandi menggunakan bcrypt (salt rounds 10).
   - Jika valid, server menghasilkan Access Token JWT (berlaku 15 menit) dan Refresh Token terenkripsi acak (berlaku 7 atau 30 hari).
   - Refresh token disimpan dalam basis data/Redis dan dikirim ke klien melalui cookie HTTP-only dengan flag Secure, SameSite=Strict.

2. Verifikasi Token pada Rute Terproteksi:
   - authMiddleware mengekstrak token dari header Authorization: Bearer <token>.
   - Memverifikasi tanda tangan JWT menggunakan JWT_SECRET.
   - Memeriksa klaim token_version terhadap token_version pengguna yang ada di basis data. Jika terjadi ketidakcocokan versi, permintaan ditolak seketika (sesi dibatalkan).
   - Jika token kadaluarsa, middleware mengembalikan HTTP 401 TOKEN_EXPIRED sesuai spesifikasi RFC 6750.

3. Silent Refresh Flow:
   - Frontend menangkap error HTTP 401 TOKEN_EXPIRED melalui Axios response interceptor.
   - Frontend memanggil POST /api/auth/refresh dengan membawa cookie HTTP-only.
   - Server memvalidasi keabsahan refresh token dan menerbitkan pasangan Access Token baru tanpa meminta pengguna login ulang.

4. Autentikasi Handshake WebSocket (Socket.io):
   - SocketManager mengimplementasikan middleware io.use((socket, next) => ...).
   - Membaca token dari socket.handshake.auth.token atau header Authorization.
   - Menolak koneksi socket seketika jika token tidak valid atau kadaluarsa (AUTH_EXPIRED atau AUTH_INVALID).

---

# 5. Matriks Otorisasi Berbasis Peran (Authorization Matrix)

Tabel hak akses peran terhadap kelompok fitur backend:

Kelompok Fitur / Resource | SUPERADMIN | MANAGEMENT | SUPERVISOR | RIDER
------------------------- | ---------- | ---------- | ---------- | -----
Manajemen Pengguna & Akun | Penuh (CRUD) | Baca Saja (R) | Terbatas (Rider) | Profil Sendiri
Konfigurasi Sistem Global | Penuh (CRUD) | Baca Saja (R) | Tertutup | Tertutup
Aturan Regulasi Operasi   | Penuh (CRUD) | Baca Saja (R) | Baca Saja (R) | Baca Saja (R)
Master Data POI & Kategori| Penuh (CRUD) | Baca Saja (R) | Kurasi (CRU) | Tertutup
Jalan Protokol & Tol      | Penuh & Sync | Baca Saja (R) | Pemicu Sync | Baca Saja (R)
Survei Kompetitor         | Penuh (CRUD) | Baca Saja (R) | Kurasi (CRU) | Tertutup
Prakiraan Cuaca           | Penuh & Sync | Baca Saja (R) | Baca Saja (R) | Baca Saja (R)
Poligon Zona Makro        | Penuh (CRUD) | Baca Saja (R) | Kelola (CRU) | Baca Saja (R)
Titik Jualan Mikro        | Penuh & Eval | Baca Saja (R) | Kelola & Eval| Baca Saja (R)
Kalkulasi DSS (BWM/TOPSIS)| Penuh (CRU)  | Riwayat (R)  | Penuh (CRU)  | Tertutup
Distribusi Armada Harian  | Penuh (CRU)  | Pantau (R)   | Eksekusi (CRU)| Konfirmasi Tugas
Sesi Operasional Lapangan | Pantau (R)   | Pantau (R)   | Pantau (R)   | Penuh (Check-in/out)
Pelacakan Telemetri LBS   | Pantau Live  | Pantau Live  | Pantau Live  | Kirim Ping Lokasi
Katalog Produk            | Penuh (CRUD) | Penuh (CRUD) | Baca Saja (R) | Baca Saja (R)
Pencatatan Penjualan Kasir| Pantau Lap   | Pantau Lap   | Pantau Lap   | Input Penjualan
Dasbor Eksekutif & Kinerja| Penuh (R)    | Penuh (R)    | Ringkasan (R)| Tertutup
Laporan & Ekspor Finansial| Penuh & Unduh| Penuh & Unduh| Tertutup     | Tertutup
Audit Log & Sync Runs     | Penuh (R)    | Tertutup     | Sync Runs (R)| Tertutup
WebSocket Management Room | Bergabung    | Bergabung    | Tertutup     | Tertutup
WebSocket Supervisor Room | Bergabung    | Bergabung    | Bergabung    | Tertutup
WebSocket Rider Room      | Tertutup     | Tertutup     | Tertutup     | Bergabung Privat

Keterangan:
- C: Create (Membuat data baru)
- R: Read (Membaca / melihat data)
- U: Update (Memperbarui data)
- D: Delete (Menghapus data)

---

# 6. Peta Aliran Data Lintas Modul (Data Flow Map)

Alur pergerakan data dari masukan eksternal hingga evaluasi komersial:

1. Aliran Intelijen & ETL Masukan:
   - Overpass API / Open-Meteo -> roadOverpassSyncService / poiSyncService -> Spatial Scope Guard (Batas Sidoarjo) -> Normalisasi & PostGIS Deduplikasi -> Tabel protocol_roads / pois / weather_records -> Pencatatan riwayat ke tabel data_sync_runs.

2. Aliran Pendukung Keputusan (DSS Chain):
   - Tabel pois + zones + weather_records + competitor_records -> POITimeCrowdService / POIWeatherService / POIDistanceService -> Matriks Keputusan -> BwmWeightService (javascript-lp-solver) -> TopsisEngineService -> Perangkingan Preferensi Alternatif -> Snapshot Riwayat ke tabel dss_histories.

3. Aliran Distribusi & Sesi Operasional:
   - Hasil Rangking dss_histories + Antrean rider_duty_queues -> DistributionService -> Tabel zone_assignments -> Notifikasi WebSocket ke rider -> Rider Check-in via OperationalSessionService -> Tabel operational_sessions.

4. Aliran Telemetri Lokasi (LBS Flow):
   - Klien Rider Mobile -> WSS / HTTP LBS Ping -> jwt.verify -> lbsHandler -> PostGIS ST_Contains & ST_DWithin terhadap poligon zona -> Klasifikasi status (COMPLIANT, DEVIATED, OUTSIDE_ZONE) -> Simpan ke latest_rider_positions & rider_telemetry_logs -> Broadcast telemetri ke supervisors_room.

5. Aliran Kasir Ritel & Evaluasi (Decision vs Reality):
   - Rider input penjualan di lapangan -> RiderOperationalService.recordSale -> Ambil harga resmi dari tabel products -> Validasi status kepatuhan lokasi saat transaksi -> Simpan ke sales_logs -> Agregasi DSSPerformanceService -> Komparasi skor prediksi DSS terhadap nominal rupiah aktual pada tabel dss_performance_evaluations.

---

# 7. Peta Dependensi Eksternal (External Dependency Map)

Daftar seluruh integrasi pihak ketiga dan infrastruktur eksternal:

1. OpenStreetMap Overpass API:
   - Endpoint: https://overpass-api.de/api/interpreter
   - Fungsi: Pengunduhan geometri koridor jalan arteri protokol, rute jalan tol, dan fasilitas POI publik.
   - Titik Kritis: Ketergantungan jaringan internet, risiko gateway timeout (HTTP 504), dan rate limiting publik.

2. Open-Meteo Weather API:
   - Modul: npm package openmeteo
   - Fungsi: Pengambilan prakiraan cuaca per jam (probabilitas presipitasi, temperatur) untuk kriteria penalti C4.
   - Titik Kritis: Ketersediaan koneksi internet dan pemformatan zona waktu WIB (UTC+7).

3. Cloudflare Turnstile API:
   - Endpoint: https://challenges.cloudflare.com/turnstile/v0/siteverify
   - Fungsi: Verifikasi token CAPTCHA pada form pendaftaran dan login.
   - Titik Kritis: Rahasia kunci TURNSTILE_SECRET_KEY wajib terlindungi dan verifikasi tidak boleh di-bypass di produksi.

4. Layanan Surat Elektronik (SMTP / Nodemailer):
   - Komponen: nodemailer transport
   - Fungsi: Pengiriman tautan aktivasi akun staf baru dan notifikasi darurat.
   - Titik Kritis: Konfigurasi port, TLS, dan proteksi kredensial SMTP_USER dan SMTP_PASS.

5. Basis Data PostgreSQL & PostGIS:
   - Host: PostgreSQL Server (Port 5432)
   - Fungsi: Penyimpanan relasional seluruh entitas bisnis dan komputasi geometris spasial.
   - Titik Kritis: Konfigurasi pool koneksi (DB_POOL_MIN, DB_POOL_MAX) dan indexing GiST.

6. In-Memory Store Redis & BullMQ:
   - Host: Redis Server (Port 6379)
   - Fungsi: Manajemen cache sesi, distributed rate limiter, dan antrean asinkron latar belakang.
   - Titik Kritis: Ketersediaan memori RAM dan proteksi kata sandi REDIS_PASSWORD.

---

# 8. Inventaris Rahasia & Variabel Lingkungan (Environment Variables)

Daftar seluruh variabel konfigurasi yang dikelola pada src/config/env.js:

Kategori | Nama Variabel | Sifat Kerahasiaan | Deskripsi Fungsional
-------- | ------------- | ----------------- | --------------------
Server   | PORT          | Terbuka           | Port listen HTTP Express (default 8090)
Server   | NODE_ENV      | Terbuka           | Mode runtime (development, test, production)
Basis Data | DB_HOST     | Sensitif Internal | Alamat host PostgreSQL
Basis Data | DB_PORT     | Sensitif Internal | Port PostgreSQL (default 5432)
Basis Data | DB_USER     | Sensitif Internal | Nama user database
Basis Data | DB_PASSWORD | Rahasia Kritis    | Kata sandi autentikasi PostgreSQL
Basis Data | DB_NAME     | Sensitif Internal | Nama basis data MOVA (default mova_db)
Basis Data | DB_POOL_MAX | Terbuka           | Batas maksimal koneksi pool (default 20)
Basis Data | DB_POOL_MIN | Terbuka           | Batas minimal koneksi pool (default 4)
Redis    | REDIS_HOST    | Sensitif Internal | Alamat host Redis
Redis    | REDIS_PORT    | Sensitif Internal | Port Redis (default 6379)
Redis    | REDIS_PASSWORD| Rahasia Kritis    | Kata sandi autentikasi Redis
Keamanan | JWT_SECRET    | Rahasia Kritis    | Kunci enkripsi tanda tangan token JWT (minimal 32 karakter)
Keamanan | JWT_EXPIRES   | Terbuka           | Masa berlaku access token (default 15m / 1d)
Keamanan | REFRESH_TOKEN_DAYS | Terbuka      | Masa berlaku refresh token (default 30 hari)
CORS     | FRONTEND_URL  | Sensitif Internal | Alamat asal aplikasi frontend yang diizinkan
CORS     | ADDITIONAL_ALLOWED_ORIGINS | Internal | Daftar domain tambahan yang diizinkan
SMTP     | SMTP_HOST     | Sensitif Internal | Alamat server surat SMTP
SMTP     | SMTP_PORT     | Sensitif Internal | Port server SMTP (default 587)
SMTP     | SMTP_USER     | Sensitif Internal | User akun pengirim email
SMTP     | SMTP_PASS     | Rahasia Kritis    | Kata sandi akun email
SMTP     | SMTP_FROM     | Terbuka           | Header nama dan alamat email pengirim
Bot Shield | TURNSTILE_ENABLED | Terbuka     | Toggle verifikasi CAPTCHA (true/false)
Bot Shield | TURNSTILE_SECRET_KEY | Rahasia Kritis | Kunci rahasia server Cloudflare Turnstile
Spasial  | OPERATIONAL_CITY | Terbuka        | Batas kota operasional resmi (Sidoarjo)
Spasial  | OPERATIONAL_PROVINCE | Terbuka    | Batas provinsi (Jawa Timur)
Spasial  | OPERATIONAL_COUNTRY | Terbuka     | Batas negara (Indonesia)
Spasial  | OPERATIONAL_ADMIN_LEVEL | Terbuka | Tingkat hierarki administrasi OSM (Level 5)
Spasial  | OPERATIONAL_BBOX_* | Terbuka      | Batas koordinat kotak pembatas geografis
Spasial  | OPERATIONAL_CENTER_* | Terbuka    | Titik koordinat pusat visualisasi peta

---

# 9. Catatan Isu Keamanan Dikenal (Known Security Issues)

Bagian ini memetakan kondisi celah keamanan yang telah ditangani (Hardened Baseline) dan daftar area potensi risiko aktif yang siap diaudit secara mendalam (Open for Audit).

## A. Isu yang Telah Diperbaiki (Hardened Baseline)
1. Penutupan Celah Bypass Test Headers di Mode Produksi
   - Status: SELESAI (Hardened)
   - Deskripsi: Pengabaian header x-test-suite dan x-bypass-captcha pada lingkungan produksi telah dipasang pada turnstileMiddleware dan rateLimiterMiddleware sehingga tidak dapat dieksploitasi untuk membypass bot protection.
2. Penyelarasan Respon Token Expired Sesuai RFC 6750
   - Status: SELESAI (Hardened)
   - Deskripsi: authMiddleware kini secara deterministik mengembalikan status HTTP 401 dengan header WWW-Authenticate dan payload bertanda TOKEN_EXPIRED untuk menjamin kelancaran silent refresh token di frontend.
3. Masking Pesan Error Database Internal
   - Status: SELESAI (Hardened)
   - Deskripsi: Fungsi respon standar apiResponse.js telah menyaring dan menyamarkan seluruh detail teknis PostgreSQL dari output respon HTTP di lingkungan produksi.
4. Perbaikan Parameter Index Prepared Statement pada Laporan Audit
   - Status: SELESAI (Hardened)
   - Deskripsi: Pemisahan array parameter query antara kalkulasi count data dan query paging di reportService.js telah menghilangkan risiko parameter mismatch dan SQL error.
5. PostGIS LineString Continuance
   - Status: SELESAI (Hardened)
   - Deskripsi: Penggabungan ruas jalan bernama sama menggunakan ST_LineMerge(ST_Collect(geom)) telah mencegah anomali query spasial pada data jalan yang terfragmentasi.

## B. Daftar Potensi Risiko Aktif Siap Diaudit (Open for Audit)

1. Potensi Eskalasi Hak Akses & Manipulasi Kepemilikan (BOLA / IDOR)
   - Estimasi Severity: P1 (High)
   - Area: Seluruh endpoint yang menerima parameter ID (userRoutes, competitorRoutes, zoneRoutes, candidateSellingLocationRoutes).
   - Vektor Uji: Memastikan bahwa user dengan peran lebih rendah tidak dapat memodifikasi resource milik entitas lain atau menaikkan jabatannya sendiri.

2. Ketahanan Integritas Parameter Komputasi BWM & TOPSIS
   - Estimasi Severity: P1 (High)
   - Area: dssRoutes.js dan candidateSellingLocationRoutes.js.
   - Vektor Uji: Menguji apakah pengiriman input kriteria ekstrim, nilai nol seragam, atau manipulasi bobot dari sisi klien dapat mendistorsi perangkingan zona atau memicu division by zero pada normalisasi vektor.

3. Kerentanan Balapan (Race Condition) pada Penugasan Distribusi Armada
   - Estimasi Severity: P1 (High)
   - Area: distributionRoutes.js dan armadaRoutes.js.
   - Vektor Uji: Menjalankan eksekusi penugasan otomatis atau manual secara serentak (concurrency test) untuk memverifikasi apakah ada satu rider atau motor gerobak yang teralokasikan ganda.

4. Integritas Penetapan Harga Ritel pada Kasir Lapangan
   - Estimasi Severity: P2 (Medium)
   - Area: riderOperationalRoutes.js (/sales).
   - Vektor Uji: Memverifikasi apakah rider dapat mengirimkan harga satuan (unit_price) yang dimanipulasi lebih rendah dari master katalog produk pada saat mencatat transaksi di sales_logs.

5. Ketahanan Pemeriksaan Buffer 10 Meter Titik Jualan Mikro
   - Estimasi Severity: P2 (Medium)
   - Area: candidateSellingLocationService.js dan spatialRestrictionService.js.
   - Vektor Uji: Menguji koordinat titik jualan mikro yang berjarak sangat tipis (misal 9.9 meter) dari jalan tol atau jalan protokol untuk memastikan penolakan otomatis berjalan deterministik.

6. Pengujian Kebocoran Ruangan WebSocket (Socket Room Eavesdropping)
   - Estimasi Severity: P2 (Medium)
   - Area: socketManager.js dan lbsHandler.js.
   - Vektor Uji: Menguji apakah koneksi socket klien akun RIDER dapat bergabung atau mendengarkan event rahasia pada management_room atau supervisors_room.

7. Ketahanan Pemrosesan Antrean BullMQ terhadap Racun Payload (Queue Poisoning)
   - Estimasi Severity: P2 (Medium)
   - Area: Seluruh worker latar belakang (overpassWorker, armadaHoldWorker, notificationWorker, dssBatchWorker).
   - Vektor Uji: Mengirimkan pekerjaan dengan payload tidak valid ke antrean Redis untuk memverifikasi apakah worker mengalami crash loop atau berhasil menangani galat secara terisolasi.

8. Evaluasi Kebocoran Data pada Endpoint Peta dan Analisis (Excessive Data Exposure)
   - Estimasi Severity: P3 (Low)
   - Area: dashboardRoutes.js, analyticsRoutes.js, reportRoutes.js.
   - Vektor Uji: Memeriksa apakah payload JSON respon mengandung field sensitif yang tidak diperlukan oleh tampilan pengguna (seperti hash password, kunci token, atau variabel diagnostik server).
