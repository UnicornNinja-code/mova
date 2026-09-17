-- =============================================================================
-- Migration 010: Spatial Lifecycle Reconciliation and Active Flags
-- Ensures strict physical dataset boundary and reconciliation for POI and Roads
-- =============================================================================

BEGIN;

-- 1. Tambahkan kolom is_active pada protocol_roads
ALTER TABLE protocol_roads ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_protocol_roads_is_active ON protocol_roads(is_active);

-- 2. Tambahkan kolom is_active pada pois
ALTER TABLE pois ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_pois_is_active ON pois(is_active);

COMMIT;
