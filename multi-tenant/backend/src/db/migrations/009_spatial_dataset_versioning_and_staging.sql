-- =============================================================================
-- Migration 009: Spatial Dataset Versioning, Staging, and Audit Tables
-- =============================================================================

BEGIN;

-- 1. Tabel Versioning Dataset Spasial
CREATE TABLE IF NOT EXISTS dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_type varchar(50) NOT NULL, -- 'POI', 'TOLL_ROADS', 'PROTOCOL_ROADS'
  version integer NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'STAGING', -- 'STAGING', 'VALIDATED', 'ACTIVE', 'RETIRED', 'FAILED'
  source varchar(100) NOT NULL DEFAULT 'OVERPASS_API',
  feature_count integer NOT NULL DEFAULT 0,
  checksum varchar(64), -- SHA-256 hash dari snapshot GeoJSON
  snapshot_path varchar(500),
  manifest_path varchar(500),
  validation_summary jsonb DEFAULT '{}',
  error_message text,
  fetched_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at timestamp,
  promoted_at timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dataset_type_version UNIQUE(dataset_type, version)
);

CREATE INDEX IF NOT EXISTS idx_dataset_versions_type_status ON dataset_versions(dataset_type, status);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_created_at ON dataset_versions(created_at DESC);

-- 2. Tabel Background Sync Jobs untuk Observabilitas & Monitoring
CREATE TABLE IF NOT EXISTS dataset_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id varchar(100) UNIQUE NOT NULL, -- BullMQ Job ID
  dataset_type varchar(50) NOT NULL,
  triggered_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(30) NOT NULL DEFAULT 'PENDING', 
  -- 'PENDING', 'FETCHING', 'VALIDATING', 'PROCESSING', 'LOADING', 'PROMOTING', 'COMPLETED', 'FAILED'
  progress integer NOT NULL DEFAULT 0,
  records_fetched integer DEFAULT 0,
  records_inserted integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  duplicates_count integer DEFAULT 0,
  invalid_geometries_count integer DEFAULT 0,
  target_version integer,
  previous_version integer,
  duration_ms integer,
  error_details jsonb,
  started_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dataset_sync_jobs_type_status ON dataset_sync_jobs(dataset_type, status);
CREATE INDEX IF NOT EXISTS idx_dataset_sync_jobs_created_at ON dataset_sync_jobs(created_at DESC);

-- 3. Tabel Isolasi Staging POI
CREATE TABLE IF NOT EXISTS pois_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  hub_id varchar(100) NULL DEFAULT NULL,
  external_id varchar(255) NOT NULL,
  osm_type varchar(20),
  osm_id bigint,
  name varchar(255) NOT NULL,
  category varchar(100) NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geom geometry(Point, 4326),
  metadata jsonb DEFAULT '{}',
  validation_status varchar(30) DEFAULT 'PENDING', -- 'VALID', 'INVALID', 'SUSPICIOUS'
  validation_notes text,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pois_staging_version ON pois_staging(version_id);
CREATE INDEX IF NOT EXISTS idx_pois_staging_geom ON pois_staging USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_pois_staging_external ON pois_staging(external_id);

-- 4. Tabel Isolasi Staging Jalan Protokol & Jalan Tol
CREATE TABLE IF NOT EXISTS protocol_roads_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  external_id varchar(255) NOT NULL,
  name varchar(255),
  highway_type varchar(100),
  restriction_type varchar(100) NOT NULL,
  geom geometry(LineString, 4326),
  metadata jsonb DEFAULT '{}',
  validation_status varchar(30) DEFAULT 'PENDING', -- 'VALID', 'INVALID'
  validation_notes text,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roads_staging_version ON protocol_roads_staging(version_id);
CREATE INDEX IF NOT EXISTS idx_roads_staging_geom ON protocol_roads_staging USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_roads_staging_external ON protocol_roads_staging(external_id);

-- 5. Tambahkan version_id pada tabel live master data
ALTER TABLE pois ADD COLUMN IF NOT EXISTS version_id uuid REFERENCES dataset_versions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pois_version_id ON pois(version_id);

ALTER TABLE protocol_roads ADD COLUMN IF NOT EXISTS version_id uuid REFERENCES dataset_versions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_protocol_roads_version_id ON protocol_roads(version_id);

COMMIT;
