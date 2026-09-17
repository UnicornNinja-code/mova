-- 018_operational_presence_and_geofence.sql
-- Stage 6 MOVA Architecture: Geofence & Operational Presence Engine

CREATE TABLE IF NOT EXISTS rider_presence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'ENTER', 'EXIT', 'ON_SITE', 'OUTSIDE_ZONE', 'DEVIATED'
    compliance_status VARCHAR(50) NOT NULL, -- 'COMPLIANT', 'DEVIATED', 'UNASSIGNED', 'OUTSIDE'
    assigned_zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326),
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for high-performance multi-tenant querying & spatial lookups
CREATE INDEX IF NOT EXISTS idx_rider_presence_events_tenant_rider ON rider_presence_events(tenant_id, rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rider_presence_events_tenant_zone ON rider_presence_events(tenant_id, zone_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rider_presence_events_geom ON rider_presence_events USING GIST (geom);

-- Enable Row-Level Security (RLS)
ALTER TABLE rider_presence_events ENABLE ROW LEVEL SECURITY;

-- PostgreSQL RLS Policies for Multi-Tenant Isolation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rider_presence_events' AND policyname = 'tenant_isolation_policy'
    ) THEN
        CREATE POLICY tenant_isolation_policy ON rider_presence_events
            FOR ALL
            TO mova_app
            USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
            WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rider_presence_events' AND policyname = 'tenant_isolation_all'
    ) THEN
        CREATE POLICY tenant_isolation_all ON rider_presence_events
            FOR ALL
            TO PUBLIC
            USING (
                current_user = 'postgres' OR
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
            )
            WITH CHECK (
                current_user = 'postgres' OR
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
            );
    END IF;
END $$;
