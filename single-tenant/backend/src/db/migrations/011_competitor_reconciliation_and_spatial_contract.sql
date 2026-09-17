-- =============================================================================
-- Migration 011: Competitor Cross-Source Reconciliation & Spatial Contract v1.0
-- Aligned with: ADR-01 (ST_Covers), ADR-02 (Identity Triad), ADR-03 (3-Tier Reconciliation), ADR-04 (Survey Precedence)
-- =============================================================================

BEGIN;

-- 1. Tambah kolom rekonsiliasi ke tabel competitors
ALTER TABLE "competitors"
  ADD COLUMN IF NOT EXISTS "matched_external_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "matched_logical_poi_id" uuid,
  ADD COLUMN IF NOT EXISTS "matched_poi_id" uuid,
  ADD COLUMN IF NOT EXISTS "reconciliation_status" varchar(50) NOT NULL DEFAULT 'UNLINKED';

-- 2. Tambah CHECK constraint untuk nilai status rekonsiliasi
ALTER TABLE "competitors"
  DROP CONSTRAINT IF EXISTS chk_competitor_reconciliation_status;

ALTER TABLE "competitors"
  ADD CONSTRAINT chk_competitor_reconciliation_status
  CHECK (reconciliation_status IN ('UNLINKED', 'CANDIDATE_MATCH', 'DEFINITIVE_MATCH'));

-- 3. Backfill geom jika ada baris yang geom-nya NULL tetapi memiliki latitude & longitude
UPDATE "competitors"
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- 4. Buat indeks performa B-Tree untuk pencarian rekonsiliasi
CREATE INDEX IF NOT EXISTS idx_competitors_matched_ext 
  ON "competitors" (matched_external_id) 
  WHERE matched_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competitors_matched_log 
  ON "competitors" (matched_logical_poi_id) 
  WHERE matched_logical_poi_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competitors_reconcile_status 
  ON "competitors" (reconciliation_status);

COMMIT;
