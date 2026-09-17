-- =============================================================================
-- Rollback Migration 002: Protocol Roads Table & Index Cleanup
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_protocol_roads_restriction;
DROP INDEX IF EXISTS idx_protocol_roads_geom_gist;
DROP TABLE IF EXISTS protocol_roads;

COMMIT;
