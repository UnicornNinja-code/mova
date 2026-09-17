-- =============================================================================
-- Migration 011: POI Multi-Tenancy Scoping, Explicit Nullable Zone Assignment,
-- and Unzoned Ingestion Safety
-- =============================================================================

BEGIN;

-- 1. Ensure zone_id is strictly NULLABLE with NO DEFAULT VALUE on pois table
ALTER TABLE pois ADD COLUMN IF NOT EXISTS zone_id uuid NULL DEFAULT NULL REFERENCES zones(id) ON DELETE SET NULL;
ALTER TABLE pois ALTER COLUMN zone_id DROP DEFAULT;
ALTER TABLE pois ALTER COLUMN zone_id DROP NOT NULL;

-- 2. Add hub_id and is_clustered on pois and pois_staging to support multi-hub tenancy and cluster state tracking
ALTER TABLE pois ADD COLUMN IF NOT EXISTS hub_id varchar(100) NULL DEFAULT NULL;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS is_clustered boolean NOT NULL DEFAULT false;

ALTER TABLE pois_staging ADD COLUMN IF NOT EXISTS hub_id varchar(100) NULL DEFAULT NULL;

-- 3. Drop any premature automatic spatial join / containment triggers on pois if present
DROP TRIGGER IF EXISTS trg_pois_auto_zone ON pois;
DROP TRIGGER IF EXISTS trg_pois_spatial_cluster ON pois;

-- 4. Create indexes for performance and multi-tenancy isolation
CREATE INDEX IF NOT EXISTS idx_pois_hub_id ON pois(hub_id);
CREATE INDEX IF NOT EXISTS idx_pois_zone_id ON pois(zone_id);
CREATE INDEX IF NOT EXISTS idx_pois_is_clustered ON pois(is_clustered);
CREATE INDEX IF NOT EXISTS idx_pois_staging_hub_id ON pois_staging(hub_id);

-- 5. Backfill existing POIs to ensure zone_id is NULL and is_clustered is FALSE
UPDATE pois 
SET zone_id = NULL,
    is_clustered = false
WHERE zone_id IS NOT NULL;

COMMIT;
