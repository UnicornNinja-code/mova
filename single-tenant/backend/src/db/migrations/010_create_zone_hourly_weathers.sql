-- Migration 010: Relational Time-Series Table for Granular Hourly Weather per Zone
-- Domain: Weather Intelligence & DSS Criteria C4 (Cost)
-- Idempotent DDL with Composite Unique Constraint and Covering Indexes

CREATE TABLE IF NOT EXISTS "zone_hourly_weathers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "zone_id" uuid NOT NULL REFERENCES "zones"("id") ON DELETE CASCADE,
  "forecast_time" timestamp NOT NULL,
  "temperature_2m" double precision NOT NULL DEFAULT 0.0,
  "apparent_temperature" double precision DEFAULT 0.0,
  "relative_humidity_2m" double precision DEFAULT 0.0,
  "dew_point_2m" double precision DEFAULT 0.0,
  "precipitation_probability" double precision NOT NULL DEFAULT 0.0,
  "precipitation" double precision DEFAULT 0.0,
  "rain" double precision DEFAULT 0.0,
  "weather_code" int NOT NULL DEFAULT 0,
  "wind_speed_10m" double precision DEFAULT 0.0,
  "weather_risk_score" double precision DEFAULT 0.0,
  "condition_label" varchar(100) DEFAULT 'Cerah',
  "data_quality" varchar(50) DEFAULT 'VALID',
  "source" varchar(50) DEFAULT 'OPEN_METEO',
  "synced_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_zone_hourly_forecast UNIQUE ("zone_id", "forecast_time")
);

-- Trigger for auto updated_at
DROP TRIGGER IF EXISTS trg_zone_hourly_weathers_updated_at ON "zone_hourly_weathers";
CREATE TRIGGER trg_zone_hourly_weathers_updated_at 
BEFORE UPDATE ON "zone_hourly_weathers" 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 1. Optimized Composite B-Tree Index for Zone Time-Range Scanning
CREATE INDEX IF NOT EXISTS idx_zone_hourly_weathers_zone_time 
ON "zone_hourly_weathers" ("zone_id", "forecast_time" ASC);

-- 2. Index for Time Slice Filtering (Global / Hub timeline queries)
CREATE INDEX IF NOT EXISTS idx_zone_hourly_weathers_forecast_time
ON "zone_hourly_weathers" ("forecast_time" ASC);

-- 3. High-Performance Covering Index for Operational Window (06:00 - 21:00 WIB)
CREATE INDEX IF NOT EXISTS idx_zone_hourly_weathers_covering
ON "zone_hourly_weathers" ("zone_id", "forecast_time" ASC)
INCLUDE ("temperature_2m", "precipitation_probability", "weather_code", "apparent_temperature", "wind_speed_10m", "weather_risk_score");
