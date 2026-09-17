-- ============================================================================
-- Rollback for Migration 010: Advanced SQL Schema & Query Optimizations
-- ============================================================================

-- 1. Drop Foreign Key Indexes
DROP INDEX IF EXISTS idx_refresh_tokens_user_id;
DROP INDEX IF EXISTS idx_password_reset_tokens_user_id;
DROP INDEX IF EXISTS idx_candidate_locations_zone_id;
DROP INDEX IF EXISTS idx_candidate_locations_poi_id;
DROP INDEX IF EXISTS idx_competitors_zone_id;
DROP INDEX IF EXISTS idx_poi_approval_logs_poi_id;
DROP INDEX IF EXISTS idx_poi_approval_logs_action_by;
DROP INDEX IF EXISTS idx_recommendations_history_rank;
DROP INDEX IF EXISTS idx_recommendations_rider_id;
DROP INDEX IF EXISTS idx_recommendations_zone_id;
DROP INDEX IF EXISTS idx_dss_histories_executed_by;
DROP INDEX IF EXISTS idx_armadas_reserved_rider;
DROP INDEX IF EXISTS idx_armadas_current_rider;
DROP INDEX IF EXISTS idx_zone_assignments_armada_id;
DROP INDEX IF EXISTS idx_zone_assignments_assigned_by;
DROP INDEX IF EXISTS idx_sales_logs_assignment_id;
DROP INDEX IF EXISTS idx_sales_logs_session_id;
DROP INDEX IF EXISTS idx_sales_logs_actual_zone_id;
DROP INDEX IF EXISTS idx_report_jobs_rider_id;
DROP INDEX IF EXISTS idx_report_jobs_zone_id;
DROP INDEX IF EXISTS idx_report_jobs_created_by;

-- 2. Drop Partial Indexes
DROP INDEX IF EXISTS idx_users_active_role;
DROP INDEX IF EXISTS idx_notifications_unread_user;
DROP INDEX IF EXISTS idx_armadas_reserved_active_hold;
DROP INDEX IF EXISTS idx_operational_sessions_active;
DROP INDEX IF EXISTS idx_rider_duty_active_queue;

-- 3. Drop Covering Indexes
DROP INDEX IF EXISTS idx_sales_logs_dashboard_covering;
DROP INDEX IF EXISTS idx_zone_assignments_covering;

-- 4. Drop Time-Series & Composite Ordering Indexes
DROP INDEX IF EXISTS idx_rider_telemetry_session_time;
DROP INDEX IF EXISTS idx_audit_logs_composite_filter;
DROP INDEX IF EXISTS idx_cron_logs_key_time;
