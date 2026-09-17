-- Rollback Migration 006: Drop Operational Sessions, Real-Time LBS State, and Spatial Tracking

DROP INDEX IF EXISTS idx_sales_logs_session;
ALTER TABLE sales_logs DROP COLUMN IF EXISTS compliance_at_sale;
ALTER TABLE sales_logs DROP COLUMN IF EXISTS actual_zone_id;
ALTER TABLE sales_logs DROP COLUMN IF EXISTS session_id;

DROP INDEX IF EXISTS idx_rider_zone_logs_session;
ALTER TABLE rider_zone_logs DROP COLUMN IF EXISTS zone_compliance;
ALTER TABLE rider_zone_logs DROP COLUMN IF EXISTS session_id;

DROP TABLE IF EXISTS rider_telemetry_logs CASCADE;
DROP TABLE IF EXISTS latest_rider_positions CASCADE;
DROP TABLE IF EXISTS operational_sessions CASCADE;
