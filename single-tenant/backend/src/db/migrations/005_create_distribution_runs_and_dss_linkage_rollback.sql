-- Rollback Migration 005
ALTER TABLE zone_assignments
    DROP COLUMN IF EXISTS distribution_run_id,
    DROP COLUMN IF EXISTS dss_history_id,
    DROP COLUMN IF EXISTS topsis_rank,
    DROP COLUMN IF EXISTS preference_score,
    DROP COLUMN IF EXISTS evaluation_version,
    DROP COLUMN IF EXISTS model_version;

DROP TABLE IF EXISTS distribution_runs CASCADE;
