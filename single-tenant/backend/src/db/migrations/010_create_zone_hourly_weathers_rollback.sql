-- Rollback Migration 010: Drop zone_hourly_weathers table and indexes

DROP TRIGGER IF EXISTS trg_zone_hourly_weathers_updated_at ON "zone_hourly_weathers";
DROP INDEX IF EXISTS idx_zone_hourly_weathers_covering;
DROP INDEX IF EXISTS idx_zone_hourly_weathers_forecast_time;
DROP INDEX IF EXISTS idx_zone_hourly_weathers_zone_time;
DROP TABLE IF EXISTS "zone_hourly_weathers" CASCADE;
