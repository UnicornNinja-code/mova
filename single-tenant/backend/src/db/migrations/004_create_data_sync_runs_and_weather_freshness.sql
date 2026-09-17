-- ============================================================================
-- Migration 004: Data Sync Runs (Provenance Audit) & Weather Freshness (DB Cache)
-- Single-Tenant MOVA (COZIS)
-- ============================================================================

-- 1. Tabel Audit & Provenance Eksekusi ETL / Sync
CREATE TABLE IF NOT EXISTS "data_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "data_type" varchar(50) NOT NULL, -- 'POI', 'WEATHER', 'ROAD', 'COMPETITOR'
  "status" varchar(50) NOT NULL DEFAULT 'RUNNING', -- 'RUNNING', 'SUCCESS', 'FAILED'
  "source" varchar(100) NOT NULL, -- 'OVERPASS_API', 'OPEN_METEO', 'FIELD_SURVEY', 'OSM'
  "records_fetched" int DEFAULT 0,
  "records_processed" int DEFAULT 0,
  "records_rejected" int DEFAULT 0,
  "error_message" text,
  "metadata" jsonb DEFAULT '{}',
  "started_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" timestamp
);

CREATE INDEX IF NOT EXISTS idx_data_sync_runs_type_started 
ON "data_sync_runs" ("data_type", "started_at" DESC);

-- 2. Tambahkan Kolom Freshness & Skor Terhitung pada Tabel weathers
ALTER TABLE "weathers" 
ADD COLUMN IF NOT EXISTS "expires_at" timestamp,
ADD COLUMN IF NOT EXISTS "weather_risk_score" double precision DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS "condition_label" varchar(50);

CREATE INDEX IF NOT EXISTS idx_weathers_zone_expires 
ON "weathers" ("zone_id", "expires_at" DESC);
