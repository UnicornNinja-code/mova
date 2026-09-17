-- Migration 005: Create distribution_runs table and add DSS linkage to zone_assignments
-- Single-Tenant MOVA (Feature Parity without Architectural Parity)

-- 1. Create distribution_runs table
CREATE TABLE IF NOT EXISTS distribution_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dss_history_id UUID REFERENCES dss_histories(id) ON DELETE SET NULL,
    time_slot VARCHAR(20) NOT NULL,
    execution_type VARCHAR(20) NOT NULL DEFAULT 'AUTO', -- 'AUTO' | 'MANUAL'
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    total_waiting_riders INT NOT NULL DEFAULT 0,
    total_assigned_riders INT NOT NULL DEFAULT 0,
    total_unassigned_riders INT NOT NULL DEFAULT 0,
    is_capacity_sufficient BOOLEAN NOT NULL DEFAULT true,
    summary JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying distribution runs by date & DSS history
CREATE INDEX IF NOT EXISTS idx_distribution_runs_created_at ON distribution_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_distribution_runs_dss_history ON distribution_runs(dss_history_id);

-- 2. Add DSS provenance & linkage columns to zone_assignments
ALTER TABLE zone_assignments
    ADD COLUMN IF NOT EXISTS distribution_run_id UUID REFERENCES distribution_runs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS dss_history_id UUID REFERENCES dss_histories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS topsis_rank INT,
    ADD COLUMN IF NOT EXISTS preference_score NUMERIC(6,4),
    ADD COLUMN IF NOT EXISTS evaluation_version VARCHAR(50) DEFAULT 'DSS-CRITERIA-v1.0',
    ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT 'BWM-TOPSIS-v1.0';

-- Index for fast lookup by distribution_run & rider
CREATE INDEX IF NOT EXISTS idx_zone_assignments_distribution_run ON zone_assignments(distribution_run_id);
CREATE INDEX IF NOT EXISTS idx_zone_assignments_dss_history ON zone_assignments(dss_history_id);
