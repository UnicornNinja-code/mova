-- =============================================================================
-- Migration 001: POI Eligibility, Logical POI Architecture, External Canonical ID & Candidate Spots
-- Phase 1 of Master Refactor Plan for MantaKopi DSS
-- =============================================================================

-- Drop legacy single-column unique constraint on osm_id to allow same numeric id across node, way, relation
ALTER TABLE pois DROP CONSTRAINT IF EXISTS pois_osm_id_key;
DROP INDEX IF EXISTS pois_osm_id_key;

-- 1. Tambahkan Kolom Baru (Nullable Terlebih Dahulu untuk Backfill Safe)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS osm_type varchar(20) DEFAULT NULL; -- NULL untuk data legacy!
ALTER TABLE pois ADD COLUMN IF NOT EXISTS external_id varchar(255);
ALTER TABLE pois ADD COLUMN IF NOT EXISTS logical_poi_id uuid;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES pois(id) ON DELETE SET NULL;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS approval_status varchar(50) DEFAULT 'APPROVED';
ALTER TABLE pois ADD COLUMN IF NOT EXISTS operational_status varchar(50) DEFAULT 'ELIGIBLE';
ALTER TABLE pois ADD COLUMN IF NOT EXISTS exclusion_reason varchar(100);
ALTER TABLE pois ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- 2. Backfill external_id untuk Data Legacy (Collision-Safe format: legacy:osm:<osm_id>:<uuid_id>)
UPDATE pois 
SET external_id = 'legacy:osm:' || COALESCE(osm_id::text, 'none') || ':' || id::text
WHERE external_id IS NULL;

-- 3. Backfill logical_poi_id untuk Data Legacy (Setiap POI awal menjadi Canonical Logical ID dirinya sendiri)
UPDATE pois 
SET logical_poi_id = id 
WHERE logical_poi_id IS NULL;

-- 4. Backfill Geometri PostGIS (Point EPSG:4326)
UPDATE pois 
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- 5. Kunci Kontrak Identitas Canonical (Set NOT NULL Pasca-Backfill)
ALTER TABLE pois ALTER COLUMN external_id SET NOT NULL;
ALTER TABLE pois ALTER COLUMN logical_poi_id SET NOT NULL;

-- 6. Buat Indeks Spasial & Indeks Unik
CREATE UNIQUE INDEX IF NOT EXISTS idx_pois_external_id ON pois (external_id);
CREATE INDEX IF NOT EXISTS idx_pois_geom_gist ON pois USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_pois_logical_poi_id ON pois (logical_poi_id);

-- 7. Membuat Tabel Candidate Selling Locations (poi_id OPTIONAL / NULLABLE!)
CREATE TABLE IF NOT EXISTS candidate_selling_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  poi_id uuid REFERENCES pois(id) ON DELETE SET NULL, -- NULLABLE!
  name varchar(255) NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geom geometry(Point, 4326) NOT NULL,
  source varchar(100) DEFAULT 'MANUAL', -- MANUAL, PUBLIC_PARK, STREET_CORNER, POI_REFERENCE
  validation_status varchar(50) NOT NULL DEFAULT 'ALLOWED', -- ALLOWED, REJECTED
  rejection_reason varchar(255),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidate_locations_geom_gist ON candidate_selling_locations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_candidate_locations_zone_id ON candidate_selling_locations (zone_id);

COMMIT;
