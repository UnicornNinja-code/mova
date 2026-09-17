-- =============================================================================
-- Migration 011: Enforce Strict Single Active Version Invariant per Dataset Type
-- Ensures that at the database engine level, there can never be more than one
-- ACTIVE version for any given spatial dataset type.
-- =============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_versions_single_active 
ON dataset_versions(dataset_type) 
WHERE status = 'ACTIVE';

COMMIT;
