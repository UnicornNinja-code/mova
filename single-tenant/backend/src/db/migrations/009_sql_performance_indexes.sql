-- Migration 009: SQL Performance & Query Optimization Indexes
-- Aligned with Supabase Postgres Best Practices & SQL Optimization Patterns

-- 1. Sales & Revenue Time-Series Composite Indexes (For Dashboard & Analytics Aggregations)
CREATE INDEX IF NOT EXISTS idx_sales_logs_zone_created ON "sales_logs" (zone_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_logs_product_created ON "sales_logs" (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_logs_rider_date_covering ON "sales_logs" (rider_id, created_at DESC) INCLUDE (qty, total_price);

-- 2. POI Master Partial & Covering Indexes (For Spatial DSS Criteria C1, C2, C3 Evaluation)
CREATE INDEX IF NOT EXISTS idx_pois_category_operational ON "pois" (category, status, operational_status) WHERE status = 'APPROVED';
CREATE INDEX IF NOT EXISTS idx_pois_logical_rep ON "pois" (logical_poi_id, created_at ASC) WHERE operational_status = 'ELIGIBLE';
CREATE INDEX IF NOT EXISTS idx_pois_name_approved ON "pois" (name) WHERE status = 'APPROVED';

-- 3. Weather Forecast & Freshness Composite Index (For DSS Weather Criteria C4)
CREATE INDEX IF NOT EXISTS idx_weathers_zone_timestamp_covering ON "weathers" (zone_id, timestamp DESC) INCLUDE (weather_code, temperature_2m, rain);

-- 4. Logistics & Operations State Machine Indexes
CREATE INDEX IF NOT EXISTS idx_armadas_status_type ON "armadas" (status, type);
CREATE INDEX IF NOT EXISTS idx_zone_assignments_date_zone_status ON "zone_assignments" (assignment_date, zone_id, status);
CREATE INDEX IF NOT EXISTS idx_rider_duty_date_rider ON "rider_duty_queues" (duty_date, rider_id, status);
