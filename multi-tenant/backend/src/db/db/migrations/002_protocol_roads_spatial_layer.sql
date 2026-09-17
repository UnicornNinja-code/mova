-- =============================================================================
-- Migration 002: Protocol Roads PostGIS Spatial Restriction Layer
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS protocol_roads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id varchar(255) UNIQUE,
  name varchar(255),
  highway_type varchar(100),
  restriction_type varchar(100) DEFAULT 'PROHIBITED_ROAD',
  geom geometry(LineString, 4326),
  metadata jsonb DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE protocol_roads ADD COLUMN IF NOT EXISTS external_id varchar(255);
ALTER TABLE protocol_roads ADD COLUMN IF NOT EXISTS name varchar(255);
ALTER TABLE protocol_roads ADD COLUMN IF NOT EXISTS highway_type varchar(100);
ALTER TABLE protocol_roads ADD COLUMN IF NOT EXISTS restriction_type varchar(100) DEFAULT 'PROHIBITED_ROAD';
ALTER TABLE protocol_roads ADD COLUMN IF NOT EXISTS geom geometry(LineString, 4326);
ALTER TABLE protocol_roads ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE protocol_roads ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE protocol_roads ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE protocol_roads ALTER COLUMN geom DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_roads_external_id ON protocol_roads (external_id);
CREATE INDEX IF NOT EXISTS idx_protocol_roads_geom_gist ON protocol_roads USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_protocol_roads_restriction ON protocol_roads (restriction_type);

COMMIT;
