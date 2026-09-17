-- ============================================================================
-- Migration 010: Advanced SQL Schema & Query Optimizations
-- Aligned with: SQL Optimization Patterns & Supabase Postgres Best Practices
-- Focus Areas: Unindexed Foreign Keys, Partial Indexes, Covering Indexes, Composite Ordering
-- ============================================================================

-- 1. UNINDEXED FOREIGN KEYS (Eliminate Sequential Scans on Joins & Cascade Checks)
-- ----------------------------------------------------------------------------
-- Auth & Tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON "refresh_tokens" (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON "password_reset_tokens" (user_id);

-- Spatial & POI Domains
CREATE INDEX IF NOT EXISTS idx_candidate_locations_zone_id ON "candidate_selling_locations" (zone_id);
CREATE INDEX IF NOT EXISTS idx_candidate_locations_poi_id ON "candidate_selling_locations" (poi_id);
CREATE INDEX IF NOT EXISTS idx_competitors_zone_id ON "competitors" (zone_id);
CREATE INDEX IF NOT EXISTS idx_poi_approval_logs_poi_id ON "poi_approval_logs" (poi_id);
CREATE INDEX IF NOT EXISTS idx_poi_approval_logs_action_by ON "poi_approval_logs" (action_by);

-- DSS & Recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_history_rank ON "recommendations" (dss_history_id, rank ASC);
CREATE INDEX IF NOT EXISTS idx_recommendations_rider_id ON "recommendations" (rider_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_zone_id ON "recommendations" (zone_id);
CREATE INDEX IF NOT EXISTS idx_dss_histories_executed_by ON "dss_histories" (executed_by);

-- Armada & Logistics
CREATE INDEX IF NOT EXISTS idx_armadas_reserved_rider ON "armadas" (reserved_by_rider_id) WHERE reserved_by_rider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_armadas_current_rider ON "armadas" (current_rider_id) WHERE current_rider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zone_assignments_armada_id ON "zone_assignments" (armada_id) WHERE armada_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zone_assignments_assigned_by ON "zone_assignments" (assigned_by) WHERE assigned_by IS NOT NULL;

-- Sales & Reporting
CREATE INDEX IF NOT EXISTS idx_sales_logs_assignment_id ON "sales_logs" (assignment_id) WHERE assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_logs_session_id ON "sales_logs" (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_logs_actual_zone_id ON "sales_logs" (actual_zone_id) WHERE actual_zone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_jobs_rider_id ON "report_jobs" (rider_id) WHERE rider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_jobs_zone_id ON "report_jobs" (zone_id) WHERE zone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_jobs_created_by ON "report_jobs" (created_by) WHERE created_by IS NOT NULL;

-- 2. HIGH-FREQUENCY PARTIAL INDEXES (Ultra-Compact, Cache-Friendly Filters)
-- ----------------------------------------------------------------------------
-- Active Users Filter (Authentication & Role Verification)
CREATE INDEX IF NOT EXISTS idx_users_active_role ON "users" (role, id) WHERE is_active = true;

-- Unread Notifications Inbox (Speed up Rider/Supervisor Inbox queries)
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user ON "notifications" (user_id, created_at DESC) WHERE is_read = false;

-- Active Armada Holds (Speed up Cron Hold Release Worker Lookups)
CREATE INDEX IF NOT EXISTS idx_armadas_reserved_active_hold ON "armadas" (id, reserved_until) WHERE status = 'RESERVED';

-- Active Operational Sessions (Speed up Live LBS & Zone Compliance queries)
CREATE INDEX IF NOT EXISTS idx_operational_sessions_active ON "operational_sessions" (rider_id, zone_id, status) 
WHERE status IN ('CLAIMED', 'CHECKED_IN', 'OPERATING');

-- Active Duty Rider Queue
CREATE INDEX IF NOT EXISTS idx_rider_duty_active_queue ON "rider_duty_queues" (duty_date, rider_id) 
WHERE status = 'WAITING';

-- 3. COVERING INDEXES (Index-Only Scans for Heavy Aggregations)
-- ----------------------------------------------------------------------------
-- Sales Dashboard & Executive KPI Aggregation
CREATE INDEX IF NOT EXISTS idx_sales_logs_dashboard_covering 
ON "sales_logs" (created_at DESC, zone_id) 
INCLUDE (qty, total_price, product_id, rider_id);

-- Operational Zone Attendance Covering
CREATE INDEX IF NOT EXISTS idx_zone_assignments_covering 
ON "zone_assignments" (assignment_date, zone_id) 
INCLUDE (rider_id, status, armada_id, check_in_time, check_out_time);

-- 4. TIME-SERIES & COMPOSITE ORDERING INDEXES
-- ----------------------------------------------------------------------------
-- Telemetry Audit Trail
CREATE INDEX IF NOT EXISTS idx_rider_telemetry_session_time 
ON "rider_telemetry_logs" (session_id, recorded_at DESC);

-- Audit Logs Multi-Column Filter
CREATE INDEX IF NOT EXISTS idx_audit_logs_composite_filter 
ON "audit_logs" (created_at DESC, entity_type, action);

-- Cron Execution History
CREATE INDEX IF NOT EXISTS idx_cron_logs_key_time 
ON "cron_logs" (cron_key, executed_at DESC);
