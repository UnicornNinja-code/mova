-- =============================================================================
-- Migration 014: Global Spatial Master Layer, Shared POIs Invariant,
-- and PostGIS GiST Spatial Indexing
-- =============================================================================

BEGIN;

-- 1. Add is_global and city_name columns to pois
ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "is_global" boolean NOT NULL DEFAULT true;
ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "city_name" varchar(100) DEFAULT NULL;

-- 2. Add is_global to protocol_roads if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'protocol_roads') THEN
    ALTER TABLE "protocol_roads" ADD COLUMN IF NOT EXISTS "is_global" boolean NOT NULL DEFAULT true;
    ALTER TABLE "protocol_roads" ADD COLUMN IF NOT EXISTS "city_name" varchar(100) DEFAULT NULL;
  END IF;
END $$;

-- 3. Add is_global to toll_roads if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'toll_roads') THEN
    ALTER TABLE "toll_roads" ADD COLUMN IF NOT EXISTS "is_global" boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- 4. Create PostGIS GiST Spatial Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS "idx_pois_geom_gist" ON "pois" USING GIST ("geom");
CREATE INDEX IF NOT EXISTS "idx_pois_is_global" ON "pois" ("is_global");
CREATE INDEX IF NOT EXISTS "idx_pois_city_name" ON "pois" ("city_name");
CREATE INDEX IF NOT EXISTS "idx_pois_composite_dedup" ON "pois" ("category", "status", "is_global");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'protocol_roads') THEN
    CREATE INDEX IF NOT EXISTS "idx_protocol_roads_geom_gist" ON "protocol_roads" USING GIST ("geom");
    CREATE INDEX IF NOT EXISTS "idx_protocol_roads_is_global" ON "protocol_roads" ("is_global");
  END IF;
END $$;

-- 5. Backfill existing POIs as is_global = true
UPDATE "pois" SET "is_global" = true WHERE "is_global" IS NOT TRUE;

-- 6. Ensure spatial_snapshots table supports FAILED status
CREATE TABLE IF NOT EXISTS "spatial_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "version" varchar(50) UNIQUE NOT NULL,
  "sha256_checksum" varchar(64) NOT NULL,
  "file_path" varchar(500) NOT NULL,
  "total_pois" int NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'STAGING', -- STAGING, ACTIVE, RETIRED, FAILED
  "bbox" jsonb,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "promoted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_spatial_snapshots_status" ON "spatial_snapshots" ("status");
CREATE INDEX IF NOT EXISTS "idx_spatial_snapshots_version" ON "spatial_snapshots" ("version");

COMMIT;
