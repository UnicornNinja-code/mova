-- Migration 006: Operational Sessions, Real-Time LBS State, and Spatial Compliance Tracking
-- Milestone B-11: Actual Field Execution & LBS Monitoring Layer

-- 1. Create table operational_sessions (SSOT Anchor for Field Execution)
CREATE TABLE IF NOT EXISTS operational_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_id UUID UNIQUE REFERENCES zone_assignments(id) ON DELETE CASCADE,
    armada_id UUID REFERENCES armadas(id) ON DELETE SET NULL,
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'CLAIMED', -- 'CLAIMED', 'CHECKED_IN', 'OPERATING', 'CHECKED_OUT', 'COMPLETED'
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    checked_in_at TIMESTAMPTZ,
    check_in_lat DOUBLE PRECISION,
    check_in_lon DOUBLE PRECISION,
    checked_out_at TIMESTAMPTZ,
    checkout_lat DOUBLE PRECISION,
    checkout_lon DOUBLE PRECISION,
    completed_at TIMESTAMPTZ,
    checkout_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operational_sessions_rider_status ON operational_sessions(rider_id, status);
CREATE INDEX IF NOT EXISTS idx_operational_sessions_assignment ON operational_sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_operational_sessions_zone ON operational_sessions(zone_id);

-- 2. Create table latest_rider_positions (Current Live Position SSOT - 1 Row per Rider)
CREATE TABLE IF NOT EXISTS latest_rider_positions (
    rider_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES operational_sessions(id) ON DELETE SET NULL,
    rider_name VARCHAR(255),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0,
    heading DOUBLE PRECISION DEFAULT 0,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
    is_inside_zone BOOLEAN DEFAULT false,
    actual_zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    actual_zone_name VARCHAR(255),
    zone_compliance VARCHAR(50) DEFAULT 'OUTSIDE_ZONE', -- 'COMPLIANT', 'DEVIATED', 'OUTSIDE_ZONE'
    road_compliance VARCHAR(50) DEFAULT 'NO_ROAD_ALERT', -- 'NO_ROAD_ALERT', 'PROHIBITED_ROAD_ALERT'
    prohibited_road_id UUID REFERENCES protocol_roads(id) ON DELETE SET NULL,
    prohibited_road_name VARCHAR(255),
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_latest_rider_positions_geom ON latest_rider_positions USING gist(geom);
CREATE INDEX IF NOT EXISTS idx_latest_rider_positions_session ON latest_rider_positions(session_id);

-- 3. Create table rider_telemetry_logs (Continuous Time-Series History for Auditing)
CREATE TABLE IF NOT EXISTS rider_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES operational_sessions(id) ON DELETE SET NULL,
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0,
    heading DOUBLE PRECISION DEFAULT 0,
    actual_zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    zone_compliance VARCHAR(50) NOT NULL DEFAULT 'OUTSIDE_ZONE',
    road_compliance VARCHAR(50) NOT NULL DEFAULT 'NO_ROAD_ALERT',
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rider_telemetry_logs_rider ON rider_telemetry_logs(rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rider_telemetry_logs_session ON rider_telemetry_logs(session_id, created_at DESC);

-- 4. Create table rider_zone_logs (Discrete State Transition Events)
CREATE TABLE IF NOT EXISTS rider_zone_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES operational_sessions(id) ON DELETE SET NULL,
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    zone_compliance VARCHAR(50) DEFAULT 'OUTSIDE_ZONE',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rider_zone_logs_rider ON rider_zone_logs(rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rider_zone_logs_session ON rider_zone_logs(session_id);

-- 5. Alter sales_logs (Field Sales Anchored to Operational Session)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_logs' AND column_name = 'session_id') THEN
        ALTER TABLE sales_logs ADD COLUMN session_id UUID REFERENCES operational_sessions(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_logs' AND column_name = 'actual_zone_id') THEN
        ALTER TABLE sales_logs ADD COLUMN actual_zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_logs' AND column_name = 'compliance_at_sale') THEN
        ALTER TABLE sales_logs ADD COLUMN compliance_at_sale VARCHAR(50) DEFAULT 'COMPLIANT';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_logs_session ON sales_logs(session_id);
