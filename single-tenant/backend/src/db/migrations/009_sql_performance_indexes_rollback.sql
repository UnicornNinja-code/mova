-- Migration 009 Rollback
DROP INDEX IF EXISTS idx_sales_logs_zone_created;
DROP INDEX IF EXISTS idx_sales_logs_product_created;
DROP INDEX IF EXISTS idx_sales_logs_rider_date_covering;
DROP INDEX IF EXISTS idx_pois_category_operational;
DROP INDEX IF EXISTS idx_pois_logical_rep;
DROP INDEX IF EXISTS idx_pois_name_approved;
DROP INDEX IF EXISTS idx_weathers_zone_timestamp_covering;
DROP INDEX IF EXISTS idx_armadas_status_type;
DROP INDEX IF EXISTS idx_zone_assignments_date_zone_status;
DROP INDEX IF EXISTS idx_rider_duty_date_rider;
