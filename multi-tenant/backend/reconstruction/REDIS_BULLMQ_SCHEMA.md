# REDIS DATA STORE & BULLMQ QUEUE ARCHITECTURE SPECIFICATION (SSOT)

## 1. Objective & Architectural Scope
Dokumen ini merupakan **Single Source of Truth (SSOT)** untuk seluruh manajemen *state* non-relasional, *distributed lock*, *geospatial stream tracking*, *caching*, dan *background job processing* pada backend sistem MOVA (MantaKopi Decision Intelligence & Mobile POS Platform).

---

## BAB 1: Key Naming Convention & Prefix Guidelines

Seluruh kunci (*keys*) yang disimpan pada Redis database wajib mematuhi konvensi penamaan hierarkis berformat:

```text
mova:<domain>:<subdomain/entity>:<identifier>:<attribute>
```

### Aturan Baku Penamaan:
1. **Namespace Prefix:** Seluruh key menggunakan prefix global `mova:` untuk memisahkan data MOVA dari database/aplikasi lain dalam instance Redis bersama.
2. **Separator:** Menggunakan karakter titik dua (`:`) sebagai pembatas level hierarki logika (kompatibel dengan *Redis Commander* dan *Redis Insight tree grouping*).
3. **Casing:**
   - Bagian statis/namespace menggunakan huruf kecil (`lowercase`, misal: `armada`, `hold`, `live`).
   - Bagian dinamis/variabel menggunakan format `snake_case` atau `UUID` persis dari database relasional (misal: `armada_id`, `rider_id`, `cron_key`).
4. **No Naked Keys:** Dilarang membuat key tanpa prefix domain (misal `12345` atau `session`).

---

## BAB 2: Redis Data Store & Key Inventory Matrix

Berikut adalah inventaris komprehensif seluruh kunci Redis yang aktif di dalam sistem backend MOVA:

| Key Pattern | Tipe Data Redis | TTL (Time-To-Live) | Ownership (Writer / Reader) | Fungsi & Perilaku Sistem |
|---|---|---|---|---|
| `mova:armada:hold:<armada_id>` | `String` (JSON) | 180 detik (3 menit) | **W:** `ArmadaService`<br>**R:** `ArmadaService`, `armadaHoldWorker` | **Distributed Mutex Lock (View-Triggered):** Mengunci armada selama 3 menit saat rider membuka detail armada di mobile UI untuk inspeksi fisik. Jika key ada, rider lain mendapat HTTP 409. |
| `mova:rider:active_hold:<rider_id>` | `String` (UUID) | 180 detik (3 menit) | **W:** `ArmadaService`<br>**R:** `ArmadaService` | **Single Reservation Guard:** Menjamin 1 rider hanya boleh memiliki 1 reservasi aktif. Menyimpan `armada_id` yang sedang di-hold. |
| `mova:lbs:riders:live` | `Geospatial` (ZSET) | `No TTL` (Siklus Shift) | **W:** `LbsGeofenceService`<br>**R:** `LbsGeofenceService`, Socket Handler | **Live Telemetry Stream:** Menyimpan koordinat GPS terkini rider aktif (`GEOADD`). Saat rider checkout (`POST /api/rider/checkout`), dieksekusi `ZREM mova:lbs:riders:live <rider_id>` untuk pembersihan. |
| `mova:lbs:rider:telemetry:<rider_id>` | `Hash` | 3600 detik (1 jam) | **W:** `LbsGeofenceService`<br>**R:** `LbsGeofenceService`, Supervisor API | **Metadata Telemetri:** Menyimpan detail akurasi GPS, kecepatan (`speed`), sisa baterai perangkat (`battery`), dan timestamp update terakhir. |
| `mova:cron:lock:<cron_key>` | `String` (JSON) | Dinamis (Job TTL + Auto-Renewal) | **W:** `CronManagerService`<br>**R:** `CronManagerService` | **Cron Concurrency Mutex:** Mencegah eksekusi ganda pada cron scheduler terdistribusi. Key memuat `instance_id` dan `started_at`. |
| `mova:cache:hub:context` | `String` (JSON) | 60 detik (1 menit) | **W:** `OperationalContextService`<br>**R:** Seluruh Domain Services | **Operational Hub SSOT Cache:** Cache koordinat titik pusat kota, nama kota hub, dan radius operasional maksimum. Di-invalidate saat setting diubah. |
| `mova:cache:weather:zone:<zone_id>` | `String` (JSON) | 1800 detik (30 menit) | **W:** `WeatherService`<br>**R:** `DssEngineService`, `WeatherService` | **Open-Meteo Cache:** Cache parameter cuaca lokal per zona (suhu, curah hujan, kode WMO) untuk menghemat limit API eksternal. |
| `mova:ratelimit:<ip_or_user_id>` | `String` (Counter) | 60 detik (Sliding Window) | **W:** `express-rate-limit` / Redis Store<br>**R:** Rate Limit Middleware | **DDoS & Brute-Force Guard:** Menghitung jumlah request per menit untuk proteksi endpoint autentikasi dan mutasi berisiko tinggi. |

---

### Atomic Reservation Double-Locking via Lua Script

Untuk mencegah *race condition* atau *partial lock acquisition* saat rider mengklik detail armada, pembuatan kunci `mova:armada:hold:<armada_id>` dan `mova:rider:active_hold:<rider_id>` WAJIB dieksekusi secara atomik menggunakan Lua Script:

```lua
-- KEYS[1]: mova:armada:hold:<armada_id>
-- KEYS[2]: mova:rider:active_hold:<rider_id>
-- ARGV[1]: json_payload, ARGV[2]: armada_id, ARGV[3]: ttl_seconds (180)
if redis.call("EXISTS", KEYS[1]) == 1 then
    return 409 -- Armada sedang di-hold rider lain (Conflict)
end
if redis.call("EXISTS", KEYS[2]) == 1 then
    return 400 -- Rider sudah memiliki hold aktif di unit lain (Bad Request)
end
redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[3])
redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3])
return 200
```

---

### Payload Data Schema (TypeScript Interfaces)

#### 1. Armada Hold Lock Payload (`mova:armada:hold:<armada_id>`)
```typescript
export interface ArmadaHoldLockPayload {
  armada_id: string;
  rider_id: string;
  rider_name: string;
  reservation_id: string;
  acquired_at: string;     // ISO 8601 UTC
  expires_at: string;      // ISO 8601 UTC
  ttl_seconds: number;     // 180 (3 menit)
}
```

#### 2. Rider Telemetry Hash Payload (`mova:lbs:rider:telemetry:<rider_id>`)
```typescript
export interface RiderTelemetryHash {
  rider_id: string;
  latitude: string;        // Stored as string in Redis Hash
  longitude: string;
  accuracy_meters: string;
  speed_kmh: string;
  battery_level_pct: string;
  last_updated_at: string; // ISO 8601 UTC
}
```

#### 3. Cron Lock Payload (`mova:cron:lock:<cron_key>`)
```typescript
export interface CronLockPayload {
  cron_key: string;
  instance_id: string;     // Pod / Server hostname
  job_id: string;
  started_at: string;
  max_execution_sec: number;
}
```

#### 4. Operational Hub Context Payload (`mova:cache:hub:context`)
```typescript
export interface OperationalHubContextCache {
  hub_city_name: string;
  central_hub_lat: number;
  central_hub_lng: number;
  operational_radius_km: number;
  cached_at: string;
}
```

---

### Eviction & Expiration Reconciliation Policy

1. **Redis Key Expiration (Fast Path):**
   - Ketika TTL `mova:armada:hold:<armada_id>` habis (180s), Redis otomatis menguapkan (*evict*) key tersebut.
   - BullMQ delayed worker mengeksekusi job pelepasan hold di PostgreSQL.
2. **Lazy Expiration Reconciliation (Fail-Safe Path):**
   - Jika Redis me-restart atau BullMQ worker mengalami downtime, query `GET /api/rider/hub-armadas` dan `POST /api/rider/hold-armada` mengeksekusi rekonsiliasi pembersih SQL:
   ```sql
   UPDATE armadas 
   SET status = 'ACTIVE' 
   WHERE status = 'RESERVED' 
     AND id IN (
       SELECT armada_id FROM fleet_reservations 
       WHERE status = 'HOLD' AND expires_at < NOW()
     );
   ```

---

## BAB 3: BullMQ Queue & Worker Architecture

Backend MOVA mengoperasikan **4 BullMQ Workers** terisolasi yang berjalan pada dedicated background threads/processes:

```
===================================================================================
                                 BULLMQ WORKER PIPELINE
===================================================================================
  1. Queue: "overpass-sync"         ──► Worker: overpassWorker.ts
  2. Queue: "armada-hold-release"   ──► Worker: armadaHoldWorker.ts
  3. Queue: "notification-dispatch" ──► Worker: notificationWorker.ts
  4. Queue: "dss-batch-evaluate"    ──► Worker: dssBatchWorker.ts
===================================================================================
```

---

### 1. Queue: `overpass-sync`
* **Canonical Queue Name:** `overpass-sync`
* **Worker File:** `src/workers/overpassWorker.ts`
* **Tujuan:** Mengunduh dan menyinkronkan data spasial POI (Point of Interest) dan jalan protokol dari OpenStreetMap via Overpass API ke PostgreSQL PostGIS.
* **Payload Interface:**
  ```typescript
  export interface OverpassSyncJobData {
    job_id: string;
    dataset_type: "poi" | "protocol_roads";
    hub_lat: number;
    hub_lng: number;
    radius_km: number;
    triggered_by_user_id?: string;
  }
  ```
* **Retry & DLQ Strategy:**
  - `attempts: 3`
  - `backoff: { type: 'exponential', delay: 5000 }`
  - `removeOnComplete: 100` (Simpan 100 riwayat sukses terakhir)
  - `removeOnFail: 500` (Simpan 500 riwayat gagal untuk audit DLQ tanpa membebani memori)
* **Lock Duration & Auto-Renewal:**
  - `lockDuration: 60000` (60 detik)
  - `lockRenewTime: 20000` (Auto-heartbeat diperpanjang setiap 20 detik selama ETL berlangsung agar job tidak terinterupsi).

---

### 2. Queue: `armada-hold-release`
* **Canonical Queue Name:** `armada-hold-release`
* **Worker File:** `src/workers/armadaHoldWorker.ts`
* **Tujuan:** Mengeksekusi rilis status armada otomatis jika masa hold 3 menit (180 detik) kedaluwarsa tanpa klaim checklist fisik oleh rider.
* **Payload Interface:**
  ```typescript
  export interface ArmadaHoldReleaseJobData {
    reservation_id: string;
    armada_id: string;
    rider_id: string;
    expires_at: string;
  }
  ```
* **Deterministic Job ID & Scheduling:**
  - Job dijadwalkan dengan deterministik ID: `jobId: "hold-release:" + reservation_id`.
  - Delay: `delay: 180000` (180.000 ms / 3 menit).
  - **Instant Cancellation:** Jika rider membatalkan reservasi via `POST /api/rider/cancel-hold-armada` atau mengonfirmasi klaim via `POST /api/rider/claim-armada`, job aktif di antrean BullMQ langsung dibatalkan secara instan $O(1)$:
    ```typescript
    const job = await armadaHoldQueue.getJob(`hold-release:${reservationId}`);
    if (job) await job.remove();
    ```
* **Retry & DLQ Strategy:**
  - `attempts: 3`
  - `backoff: { type: 'fixed', delay: 1000 }`
  - `removeOnComplete: true`
  - `removeOnFail: 500`

---

### 3. Queue: `notification-dispatch`
* **Canonical Queue Name:** `notification-dispatch`
* **Worker File:** `src/workers/notificationWorker.ts`
* **Tujuan:** Mengirimkan notifikasi in-app dan push event via Socket.IO kepada pengguna terkait (misal: alert kerusakan armada kritis ke SuperAdmin/Supervisor).
* **Payload Interface:**
  ```typescript
  export interface NotificationDispatchJobData {
    user_id?: string;            // Kosong jika broadcast
    target_role?: string;        // "SUPERADMIN" | "SUPERVISOR" | "RIDER"
    title: string;
    message: string;
    action_url?: string;
    target_entity?: {
      type: "ARMADA" | "ZONE" | "ASSIGNMENT" | "SYSTEM";
      id: string;
    };
    created_at: string;
  }
  ```
* **Retry & DLQ Strategy:**
  - `attempts: 5`
  - `backoff: { type: 'exponential', delay: 2000 }`
  - `removeOnComplete: 200`
  - `removeOnFail: 500`

---

### 4. Queue: `dss-batch-evaluate`
* **Canonical Queue Name:** `dss-batch-evaluate`
* **Worker File:** `src/workers/dssBatchWorker.ts`
* **Tujuan:** Menghitung evaluasi ranking TOPSIS berkala (jadwal pagi/siang/malam) untuk seluruh zona operasional aktif.
* **Payload Interface:**
  ```typescript
  export interface DssBatchEvaluateJobData {
    batch_run_id: string;
    time_slot: "pagi" | "siang" | "sore" | "malam";
    active_bwm_config_id: string;
    zone_ids: string[];
    triggered_at: string;
  }
  ```
* **Retry & DLQ Strategy:**
  - `attempts: 2`
  - `backoff: { type: 'fixed', delay: 5000 }`
  - `removeOnComplete: 50`
  - `removeOnFail: 500`
* **Lock Duration:**
  - `lockDuration: 45000` (45 detik dengan perpanjangan dinamis).

---

## BAB 4: Connection Resiliency & Fallback Strategy

Untuk menjaga ketersediaan sistem $99.9\%$ (*High Availability*), backend menerapkan strategi *graceful degradation* saat Redis terputus atau mengalami latensi ekstrem:

```
===================================================================================
                     RESILIENCY & FAIL-SAFE ESCALATION MATRIX
===================================================================================
 Modul               Kondisi Normal (Redis OK)        Kondisi Gangguan (Redis Down)
───────────────────────────────────────────────────────────────────────────────────
 Autentikasi / JWT   Validasi blacklist di Redis      Fallback langsung ke PostgreSQL
                     dengan latensi < 2ms             users table (query SQL bypass)
───────────────────────────────────────────────────────────────────────────────────
 Armada 5-Min Hold   Atomic Redis SET NX EX 300       Fallback ke Database Row-Level
                     (Distributed Mutex Lock)         Lock: SELECT ... FOR UPDATE
───────────────────────────────────────────────────────────────────────────────────
 LBS Geofence GPS    Stream live ke Redis GEOADD      Bypass in-memory cache, langsung
                     & publish ke Socket.IO           validasi via PostGIS ST_Contains
───────────────────────────────────────────────────────────────────────────────────
 Scheduled Crons     Mutex Lock mova:cron:lock:*      Fallback advisory lock PostgreSQL
                     mencegah double trigger          pg_try_advisory_lock()
===================================================================================
```

---

### Rekomendasi Konfigurasi Persistensi Redis Server

Untuk mencegah hilangnya *delayed jobs* BullMQ (khususnya antrean rilis armada 5 menit) dan data telemetri saat restart server Redis, konfigurasi `redis.conf` wajib mengaktifkan **AOF (Append Only File)** dan **RDB Snapshots**:

```ini
# /etc/redis/redis.conf

# 1. Enable AOF with 1-second fsync for durable background jobs
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# 2. Enable periodic RDB snapshots
save 900 1
save 300 10
save 60 10000

# 3. Memory Eviction Safety Policy for BullMQ
maxmemory 512mb
maxmemory-policy noeviction
```

> **Catatan Arsitektur:** Kebijakan `maxmemory-policy noeviction` menjamin Redis akan menolak write baru dengan error OOM daripada menghapus (*evict*) delayed job BullMQ atau distributed lock armada secara diam-diam.

---

## BAB 5: Verification & Typecheck Baseline

Skema tipe data pada dokumen ini dapat langsung diuji dan diimpor ke file service TypeScript:

```bash
# Verifikasi integritas kompilasi backend
bun x tsc --noEmit

# Uji end-to-end distributed lock dan worker processing
bun test tests/e2e_operational_flow.test.ts
```

**STATUS DOKUMEN: OFFICIALLY ADOPTED AS SSOT (PART 00–15 COMPLIANT)**
