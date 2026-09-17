-- ============================================================================
-- Migration 017: LBS Presence, GPS Ingestion & Spatial Tracking Layer
-- Stage 5 MOVA Architecture
-- ============================================================================

CREATE TABLE IF NOT EXISTS rider_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(128) NOT NULL,
    sequence BIGINT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    accuracy_meters DOUBLE PRECISION NOT NULL,
    altitude_meters DOUBLE PRECISION,
    speed_mps DOUBLE PRECISION,
    heading_degrees DOUBLE PRECISION,
    captured_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    is_inside_geofence BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Fast Temporal & Spatial Queries
CREATE INDEX IF NOT EXISTS idx_rider_positions_geom 
    ON rider_positions USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_rider_positions_tenant_rider_time 
    ON rider_positions (tenant_id, rider_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_rider_positions_tenant_zone 
    ON rider_positions (tenant_id, zone_id) WHERE zone_id IS NOT NULL;

-- Enable PostgreSQL Row-Level Security (RLS)
ALTER TABLE rider_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_positions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON rider_positions;
CREATE POLICY tenant_isolation_policy ON rider_positions
    FOR ALL
    TO mova_app
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.bypass_rls', true) = 'on'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.bypass_rls', true) = 'on'
    );
