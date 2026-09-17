# SPATIAL POI & ATMOSPHERIC WEATHER ETL PIPELINE SPECIFICATION (SSOT)

## 1. Objective & Scope
Dokumen ini merupakan spesifikasi arsitektur resmi (**Single Source of Truth**) untuk dua *pipeline* integrasi data eksternal pada backend MOVA/COZIS:
1. **Spatial POI Pipeline (Overpass API / OpenStreetMap)**: Penarikan data titik minat (*Points of Interest*), klasifikasi hybrid (Exact Tag + Regex Fallback untuk data Indonesia), klasterisasi spasial analitik PostGIS `ST_ClusterDBSCAN`, GiST indexing, dan promosi dataset atomik berbasis Compare-And-Swap (CAS) (PART 05).
2. **Atmospheric Weather Pipeline (Open-Meteo API)**: Pengambilan telemetri cuaca per jam/hub, penyimpanan observasi non-destruktif (*append-only* / ADR-003), *caching* terstandarisasi berbasis TTL 30 menit (1800 detik), dan normalisasi skor kriteria Cost Cuaca (C4) untuk komputasi TOPSIS (PART 06).

---

## BAGIAN 1: PIPELINE ETL POI (OVERPASS API → SPATIAL DSS)

```
===================================================================================
                          SPATIAL POI ETL ARCHITECTURE
===================================================================================
 [SuperAdmin / Cron Trigger]
            │
            ▼ (Enqueues Job)
 [BullMQ Queue: "overpass-sync"] ──► [overpassWorker.ts]
                                            │
                                            ├─► 1. EXTRACTION (E):
                                            │   - Resolve Hub Bounds (OperationalContextService)
                                            │   - Construct Optimized Union Overpass QL (nwr["tag"~"regex"])
                                            │   - Stream raw OSM Nodes, Ways, & Relations
                                            │
                                            ├─► 2. TRANSFORMATION (T):
                                            │   - Ingest to pois_staging
                                            │   - Hybrid Classification:
                                            │       * Tier 1: Exact OSM Tag Matching (51 Active Categories)
                                            │       * Tier 2: Regex Fallback pada name/brand/description
                                            │   - Calculate Likert Crowd Scores (pagi/siang/sore/malam)
                                            │   - Spatial Deduplication (5m radius cluster)
                                            │   - Spatial Hotspot Clustering via PostGIS ST_ClusterDBSCAN
                                            │   - Generate PostGIS Geometry ST_SetSRID(ST_MakePoint(lon, lat), 4326)
                                            │
                                            └─► 3. LOADING & PROMOTION (L):
                                                - Compare-And-Swap (CAS) Transaction on dataset_versions
                                                - Promote STAGING ──► ACTIVE
                                                - Mark Previous Version ──► RETIRED
                                                - Refresh PostGIS GiST Index (idx_pois_geom)
===================================================================================
```

### 1. Extraction (E)
- **Geographic Scope Resolution:**
  - Worker membaca koordinat pusat hub (`CENTRAL_HUB_LAT`, `CENTRAL_HUB_LNG`) dan batas radius (`OPERATIONAL_RADIUS_KM`) dari `OperationalContextService` (SSOT) guna memastikan query Overpass terisolasi pada wilayah operasional tanpa kebocoran data (*geographic leakage*).
- **Optimized Union Overpass Query Language (Overpass QL):**
  - Untuk meminimalkan latensi dan mencegah `HTTP 429 / 504 Gateway Timeout` pada server publik OSM, query menggunakan operator union ringkas `nwr` (*node, way, relation*) dan Regex filter `~`:
  ```text
  [out:json][timeout:90];
  (
    nwr["amenity"~"cafe|restaurant|fast_food|bank|pharmacy|fuel|school|university|hospital"](around:25000, -7.2575, 112.7521);
    nwr["shop"~"convenience|supermarket|mall|bakery|coffee|kiosk"](around:25000, -7.2575, 112.7521);
    nwr["office"](around:25000, -7.2575, 112.7521);
    nwr["tourism"~"hotel|attraction|viewpoint|guest_house"](around:25000, -7.2575, 112.7521);
    nwr["leisure"~"park|sports_centre|fitness_centre"](around:25000, -7.2575, 112.7521);
  );
  out center;
  ```
- **Asynchronous Execution via BullMQ:**
  - Seluruh ekstraksi Overpass diorkestrasi via BullMQ queue `overpass-sync` (`overpassWorker.ts`) dengan timeout lock 60 detik dan auto-renewal heartbeat.
- **Rate Limiting & Fallback Servers:**
  - Menggunakan retry strategi `attempts: 3` dengan `exponential backoff` (delay awal 5000 ms).
  - Fallback mirror routing: jika `overpass-api.de` mengalami overload, worker otomatis beralih ke mirror `lz4.overpass-api.de` atau `kumi.systems`.

---

### 2. Transformation (T) & Hybrid Classification Engine
- **Staging Ingestion:**
  - Seluruh raw node/way OSM disimpan sementara ke tabel staging `pois_staging` yang terikat pada `sync_job_id` unik.

- **Hybrid Classification Strategy (Tier-1 Tag Matching + Tier-2 Regex Engine):**
  Data OpenStreetMap publik di Indonesia bersifat *unstructured* (banyak warkop dan UMKM tidak memiliki tag `amenity=cafe` yang rapi, melainkan hanya menyertakan nama usaha). Oleh karena itu, klasifikasi dilakukan dalam 2 tahap:
  
  1. **Tier 1 (Exact Tag Matching):** Mencocokkan tag utama OSM (`amenity`, `shop`, `tourism`, `office`, `leisure`, `craft`) langsung ke 51 kategori resmi `poi_categories`.
  2. **Tier 2 (Regex Pattern Matching Fallback):** Jika tag OSM tidak memetakan ke kategori aktif atau bernilai generik (`amenity=building`/`shop=yes`), parser memeriksa string `name`, `brand`, dan `description` menggunakan aturan Regex:
  
  ```typescript
  export const POI_REGEX_RULES: Array<{ category_id: string; pattern: RegExp }> = [
    // Kategori Coffee Shop / Warkop (Sangat vital untuk Kriteria C6 Kompetitor)
    { category_id: "CAT_COFFEE_SHOP", pattern: /\b(kopi|coffee|warkop|cafe|espresso|roastery|kafe|kedai kopi|caffe)\b/i },
    // Kategori Perkantoran / Coworking
    { category_id: "CAT_OFFICE", pattern: /\b(pt\.|cv\.|office|kantor|coworking|tower|gedung|wisma|pln|telkom)\b/i },
    // Kategori Minimarket / Toko Kelontong
    { category_id: "CAT_CONVENIENCE", pattern: /\b(indomaret|alfamart|alfamidi|toko kelontong|minimarket|superindo)\b/i },
    // Kategori Pendidikan / Kampus
    { category_id: "CAT_CAMPUS", pattern: /\b(universitas|institut|politeknik|kampus|sekolah|sma|smk|smp|sd|fakultas|akademi)\b/i },
    // Kategori Transportasi / Transit Hub
    { category_id: "CAT_TRANSIT_HUB", pattern: /\b(stasiun|terminal|halte|bandara|shelter|pelabuhan|pangkalan)\b/i },
    // Kategori Fasilitas Medis / Apotek
    { category_id: "CAT_HEALTHCARE", pattern: /\b(rsud|rs|rumah sakit|klinik|apotek|puskesmas|laboratorium)\b/i }
  ];
  ```

- **Spatial Deduplication & ID Preservation:**
  - **Deduplikasi Mikro (5 Meter):** Jika terdapat beberapa entri dengan kategori identik dalam radius $< 5\text{ meter}$, entri diagregasikan menjadi satu representasi POI untuk mencegah *phantom points*.
  - **Logical ID Preservation:** Jika `external_id` (OSM Node ID) telah ada di database versi aktif sebelumnya, `logical_poi_id` dipertahankan agar tidak merusak relasi historis transaksi atau log rute rider.

- **Spatial Hotspot Clustering via PostGIS `ST_ClusterDBSCAN`:**
  - Untuk mengenali aglomerasi keramaian (sentra kuliner, distrik ruko bisnis, atau kawasan komersial terpadu), PostGIS mengelompokkan POI menggunakan algoritma DBSCAN:
  ```sql
  -- Mengelompokkan POI ke dalam klaster kepadatan tinggi (min 5 POI dalam radius ~55 meter / eps=0.0005)
  SELECT 
      id, 
      name, 
      category_id,
      geom,
      ST_ClusterDBSCAN(geom, eps := 0.0005, minpoints := 5) OVER () AS cluster_id
  FROM pois
  WHERE version_id = $active_version_id;
  ```
  - **Dampak pada DSS TOPSIS:** POI yang memiliki `cluster_id IS NOT NULL` mendapatkan multiplier bobot aglomerasi spasial $(1.25\times)$ dalam perhitungan kriteria C1 (Density) dan C3 (Crowd Score).

- **PostGIS Geometry Construction:**
  - Mengonversi koordinat mentah menjadi geometri PostGIS standar:
  ```sql
  ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  ```

---

### 3. Loading & Dataset Promotion (L)
- **CAS (Compare-And-Swap) Atomic Promotion:**
  - Promosi dataset dari `STAGING` ke `ACTIVE` dieksekusi di dalam satu database transaction ber-level isolasi `SERIALIZABLE`:
  ```sql
  BEGIN;
  -- 1. Kunci versi dataset aktif saat ini
  SELECT id FROM dataset_versions WHERE dataset_type = 'poi' AND status = 'ACTIVE' FOR UPDATE;
  
  -- 2. Arsipkan versi lama ke status RETIRED
  UPDATE dataset_versions SET status = 'RETIRED', retired_at = NOW() 
  WHERE dataset_type = 'poi' AND status = 'ACTIVE';
  
  -- 3. Promosikan versi baru ke status ACTIVE
  UPDATE dataset_versions SET status = 'ACTIVE', activated_at = NOW() 
  WHERE id = $new_version_id;
  
  -- 4. Pindahkan data dari pois_staging ke pois master table
  INSERT INTO pois (version_id, logical_poi_id, category_id, name, latitude, longitude, geom, created_at)
  SELECT $new_version_id, logical_poi_id, category_id, name, latitude, longitude, geom, NOW()
  FROM pois_staging WHERE job_id = $job_id;
  COMMIT;
  ```
- **PostGIS GiST Index Utilization:**
  - Memastikan indeks spasial GiST selalu mutakhir untuk query agregasi poligon zona:
  ```sql
  CREATE INDEX idx_pois_geom ON pois USING GIST (geom);
  ```
- **Rollback Protocol:**
  - Jika terjadi anomali data (misal: volume POI anjlok drastis $> 50\%$), SuperAdmin dapat memanggil `POST /api/data-sync/rollback/:versionId` untuk mengaktifkan kembali versi `RETIRED` sebelumnya secara instan tanpa perlu re-fetch ke OpenStreetMap.

---

## BAGIAN 2: PIPELINE ETL CUACA (OPEN-METEO API → TELEMETRY & C4 CRITERIA)

```
===================================================================================
                       ATMOSPHERIC WEATHER ETL ARCHITECTURE
===================================================================================
 [Weather Cron Poller / On-Demand API]
                   │
                   ▼
 [Open-Meteo REST API: api.open-meteo.com/v1/forecast]
                   │
                   ├─► 1. EXTRACTION (E):
                   │   - Fetch Hub Centroid & Zone Centroid Coordinates (ST_Centroid)
                   │   - Parameters: temperature_2m, precipitation_probability, weather_code, rain
                   │
                   ├─► 2. TRANSFORMATION (T):
                   │   - In-Memory / Redis Caching (Standardized TTL: 1800s / 30 Menit)
                   │   - WMO Weather Code Translation (Cerah, Berawan, Hujan Ringan, Badai)
                   │   - Normalisasi Skor Kriteria Cost C4 (Weather Risk: 0.0 - 100.0)
                   │
                   └─► 3. LOADING (L):
                       - Append-Only Observational Storage (ADR-003)
                       - Zero destructive DELETE / TRUNCATE
                       - Fetch Latest Observation: ORDER BY updated_at DESC LIMIT 1
===================================================================================
```

### 1. Extraction (E)
- **Parameter Open-Meteo API:**
  - Endpoint: `https://api.open-meteo.com/v1/forecast`
  - Query: `latitude`, `longitude`, `current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m`, `hourly=precipitation_probability`
- **Dual-Level Fetching Strategy:**
  1. *Hub-Level Weather:* Mengambil kondisi makro kota operasional menggunakan koordinat hub pusat.
  2. *Zone-Level Weather:* Mengambil cuaca mikro spesifik zona menggunakan titik centroid poligon:
     ```sql
     SELECT id, name, ST_Y(ST_Centroid(polygon)) AS lat, ST_X(ST_Centroid(polygon)) AS lon FROM zones WHERE status = 'active';
     ```
- **Triggering Protocol:**
  - *Automated Polling:* Cron scheduler berjalan setiap 30 menit via `CronManagerService`.
  - *On-Demand Fetch:* Dieksekusi otomatis saat evaluasi BWM-TOPSIS harian (`POST /api/dss/evaluate`) jika cache cuaca zona telah kedaluwarsa ($> 30\text{ menit}$).

---

### 2. Transformation & Formula Kriteria C4 (T)
- **Standardized In-Memory / Redis Caching (TTL: 30 Menit / 1800s):**
  - Key: `mova:cache:weather:zone:<zone_id>`
  - TTL: 1800 detik. Menjamin data cuaca cukup sensitif terhadap perubahan hujan mendadak bagi rider lapangan sekaligus sangat hemat kuota API (hanya 48 request per zona per 24 jam).
- **Normalisasi Skor Kriteria Cost Cuaca (C4):**
  - Dalam DSS TOPSIS, Cuaca adalah kriteria bertipe **Cost** (semakin tinggi skor risiko cuaca, semakin buruk preferensi zona untuk penugasan rider motor/gerobak terbuka).
  - Formula perhitungan skor risiko cuaca $S_{\text{weather}} \in [0.0, 100.0]$:
  $$\text{Rainfall Penalty} = \min(\text{rain\_mm} \times 10, 40.0)$$
  $$\text{Probability Penalty} = \text{precipitation\_probability\_pct} \times 0.40$$
  $$\text{WMO Severity Score} = \text{MapWmoToRisk}(\text{weather\_code}) \quad (0.0 - 20.0)$$
  $$\text{Score C4 (Weather Risk)} = \min(\text{Rainfall Penalty} + \text{Probability Penalty} + \text{WMO Severity Score}, 100.0)$$

*Tabel Pemetaan Kode Cuaca WMO ke Severity Score:*
| Rentang Kode WMO | Kondisi Cuaca | Severity Score |
|---|---|:---:|
| `0` | Cerah Sempurna (*Clear sky*) | 0.0 |
| `1, 2, 3` | Cerah Berawan / Berawan Tebal | 5.0 |
| `45, 48` | Berkabut (*Fog*) | 10.0 |
| `51, 53, 55` | Gerimis Ringan / Sedang (*Drizzle*) | 12.0 |
| `61, 63, 65` | Hujan Ringan / Lebat (*Rain*) | 18.0 |
| `80, 81, 82` | Hujan Deras Mendadak (*Showers*) | 19.0 |
| `95, 96, 99` | Badai Petir (*Thunderstorm*) | 20.0 |

---

### 3. Loading (L) — Append-Only Strategy (ADR-003)
- **Larangan Destruktif (No TRUNCATE / DELETE):**
  - Tabel `weathers` diperlakukan sebagai log observasi lingkungan berkelanjutan (*append-only historical telemetry*).
- **Struktur Tabel `weathers`:**
  ```sql
  CREATE TABLE weathers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
    temperature_c NUMERIC(4,1) NOT NULL,
    humidity_pct INTEGER NOT NULL,
    precipitation_mm NUMERIC(5,2) DEFAULT 0.0,
    rain_probability_pct INTEGER DEFAULT 0,
    weather_code INTEGER NOT NULL,
    condition_label VARCHAR(50) NOT NULL,
    weather_risk_score NUMERIC(5,2) NOT NULL, -- Skor C4 (0.0 - 100.0)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX idx_weathers_zone_updated ON weathers (zone_id, updated_at DESC);
  ```
- **Latest Observation Retrieval Query:**
  - Komputasi DSS dan API UI mengambil kondisi cuaca paling mutakhir dengan query terindeks:
  ```sql
  SELECT * FROM weathers 
  WHERE zone_id = $1 
  ORDER BY updated_at DESC 
  LIMIT 1;
  ```

---

## BAB 3: PEMETAAN DATA ETL KE KRITERIA TOPSIS (DSS INTEGRATION)

Kedua pipeline ETL di atas menjadi penyedia data masukan (*data feeder*) untuk matriks keputusan TOPSIS $X = [x_{ij}]_{m \times n}$:

| Kriteria DSS | Nama Kriteria | Tipe Kriteria | Sumber Data ETL | Formula / Agregasi SQL PostGIS |
|:---:|---|:---:|---|---|
| **C1** | Kepadatan POI (*POI Density*) | **Benefit** | Spatial POI Pipeline + DBSCAN | `COUNT(p.id)` POI aktif di dalam `ST_Contains(z.polygon, p.geom)` dengan multiplier klaster |
| **C2** | Keberagaman POI (*POI Diversity*) | **Benefit** | Spatial POI Pipeline | `COUNT(DISTINCT p.category_id)` di dalam `ST_Contains(z.polygon, p.geom)` |
| **C3** | Potensi Keramaian (*Crowd Score*) | **Benefit** | Spatial POI Pipeline + ADR-002 | `SUM(pc.crowd_weight_timeslot)` sesuai slot waktu penugasan (`pagi/siang/sore/malam`) |
| **C4** | Risiko Cuaca (*Weather Risk*) | **Cost** | Atmospheric Weather Pipeline | `weathers.weather_risk_score` paling mutakhir ($0.0 - 100.0$) |
| **C5** | Jarak ke Hub / Rider | **Cost** | PostGIS Operational Hub Context | Jarak Haversine: `ST_Distance(ST_Centroid(z.polygon)::geography, ST_MakePoint(hub_lng, hub_lat)::geography) / 1000.0` (km) |
| **C6** | Indeks Ancaman Kompetitor | **Cost** | Spatial POI Pipeline (Regex Kopi/Cafe) | `COUNT(p.id)` kategori cafe/kopi terdaftar di dalam zona |

---

## BAB 4: VERIFIKASI & PENGUJIAN PIPELINE

```bash
# 1. Uji TypeScript compilation
bun x tsc --noEmit

# 2. Uji integrasi spatial POI & GiST boundary scan
bun run tests/operational_scope.test.ts

# 3. Uji end-to-end integrasi data POI & cuaca pada evaluasi DSS
bun test tests/e2e_operational_flow.test.ts
```

**STATUS DOKUMEN: OFFICIALLY ADOPTED AS SSOT (PART 05, PART 06, PART 07 COMPLIANT)**
