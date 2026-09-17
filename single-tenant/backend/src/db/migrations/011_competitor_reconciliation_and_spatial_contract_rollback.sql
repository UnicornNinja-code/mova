-- =============================================================================
-- Migration 011 Rollback: Competitor Cross-Source Reconciliation & Spatial Contract
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_competitors_reconcile_status;
DROP INDEX IF EXISTS idx_competitors_matched_log;
DROP INDEX IF EXISTS idx_competitors_matched_ext;

ALTER TABLE "competitors" DROP CONSTRAINT IF EXISTS chk_competitor_reconciliation_status;

ALTER TABLE "competitors"
  DROP COLUMN IF EXISTS "reconciliation_status",
  DROP COLUMN IF EXISTS "matched_poi_id",
  DROP COLUMN IF EXISTS "matched_logical_poi_id",
  DROP COLUMN IF EXISTS "matched_external_id";

COMMIT;
