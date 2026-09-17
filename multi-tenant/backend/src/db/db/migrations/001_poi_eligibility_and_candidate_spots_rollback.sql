-- =============================================================================
-- Rollback Migration 001: Safety Rollback Script
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_candidate_locations_zone_id;
DROP INDEX IF EXISTS idx_candidate_locations_geom_gist;
DROP TABLE IF EXISTS candidate_selling_locations;

DROP INDEX IF EXISTS idx_pois_logical_poi_id;
DROP INDEX IF EXISTS idx_pois_geom_gist;
DROP INDEX IF EXISTS idx_pois_external_id;

ALTER TABLE pois DROP COLUMN IF EXISTS geom;
ALTER TABLE pois DROP COLUMN IF EXISTS exclusion_reason;
ALTER TABLE pois DROP COLUMN IF EXISTS operational_status;
ALTER TABLE pois DROP COLUMN IF EXISTS approval_status;
ALTER TABLE pois DROP COLUMN IF EXISTS duplicate_of;
ALTER TABLE pois DROP COLUMN IF EXISTS logical_poi_id;
ALTER TABLE pois DROP COLUMN IF EXISTS external_id;
ALTER TABLE pois DROP COLUMN IF EXISTS osm_type;

COMMIT;
