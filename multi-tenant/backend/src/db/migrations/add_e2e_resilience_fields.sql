-- Migration: add_e2e_resilience_fields.sql
-- Hardening and Resilience Fields for E2E Workflow 2.0

-- 1. ArmadaStatus ENUM: Add CHARGING
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = '"ArmadaStatus"'::regtype 
        AND enumlabel = 'CHARGING'
    ) THEN
        ALTER TYPE "ArmadaStatus" ADD VALUE 'CHARGING';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. DSS Histories: snapshot_hash for concurrency lock
ALTER TABLE dss_histories ADD COLUMN IF NOT EXISTS snapshot_hash varchar(64);

-- 3. Zone Assignments: Emergency swap & shift settlement fields
ALTER TABLE zone_assignments ADD COLUMN IF NOT EXISTS incident_locked_at timestamp;
ALTER TABLE zone_assignments ADD COLUMN IF NOT EXISTS remaining_cups integer DEFAULT 0;
ALTER TABLE zone_assignments ADD COLUMN IF NOT EXISTS actual_cash_submitted numeric DEFAULT 0;
ALTER TABLE zone_assignments ADD COLUMN IF NOT EXISTS discrepancy_amount numeric DEFAULT 0;
ALTER TABLE zone_assignments ADD COLUMN IF NOT EXISTS discrepancy_reason text;

-- 4. Shift Settlements Table
CREATE TABLE IF NOT EXISTS shift_settlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid REFERENCES zone_assignments(id) ON DELETE CASCADE,
    rider_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supervisor_id uuid REFERENCES users(id) ON DELETE SET NULL,
    expected_cash numeric NOT NULL DEFAULT 0,
    actual_cash numeric NOT NULL DEFAULT 0,
    discrepancy_amount numeric NOT NULL DEFAULT 0,
    discrepancy_reason text,
    remaining_cups integer DEFAULT 0,
    status varchar(50) NOT NULL DEFAULT 'APPROVED', -- APPROVED, SETTLED_WITH_DISCREPANCY, REJECTED
    settled_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Duty Incident Logs Table
CREATE TABLE IF NOT EXISTS duty_incident_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid REFERENCES zone_assignments(id) ON DELETE SET NULL,
    previous_rider_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_rider_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supervisor_id uuid REFERENCES users(id) ON DELETE SET NULL,
    incident_type varchar(100) NOT NULL, -- ACCIDENT, FLAT_TIRE, BATTERY_DRAIN, ILLNESS, OTHER
    notes text,
    armada_action varchar(50) NOT NULL DEFAULT 'KEEP_ARMADA', -- KEEP_ARMADA, SWAP_ARMADA
    swapped_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Spatial GIST Indexes
CREATE INDEX IF NOT EXISTS idx_protocol_roads_geom_gist ON protocol_roads USING GIST(geom);
