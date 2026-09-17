-- 1. Aktifkan Ekstensi yang Dibutuhkan
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Membuat Tipe ENUM (Aman & Idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
        CREATE TYPE "Role" AS ENUM ('RIDER', 'SUPERVISOR', 'MANAGEMENT', 'SUPERADMIN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ZoneStatus') THEN
        CREATE TYPE "ZoneStatus" AS ENUM ('ACTIVE', 'RESTRICTED', 'INACTIVE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ArmadaStatus') THEN
        CREATE TYPE "ArmadaStatus" AS ENUM ('ACTIVE', 'IN_USE', 'MAINTENANCE', 'RESERVED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ArmadaType') THEN
        CREATE TYPE "ArmadaType" AS ENUM ('MOTOR_LISTRIK', 'GEROBAK', 'LAINNYA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductStatus') THEN
        CREATE TYPE "ProductStatus" AS ENUM ('AVAILABLE', 'DISCONTINUED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionStatus') THEN
        CREATE TYPE "SessionStatus" AS ENUM ('QUEUE', 'ASSIGNED', 'CHECKED_IN', 'COMPLETED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlotStatus') THEN
        CREATE TYPE "PlotStatus" AS ENUM ('DRAFT', 'DONE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CriteriaType') THEN
        CREATE TYPE "CriteriaType" AS ENUM ('BENEFIT', 'COST');
    END IF;
END $$;

-- 3. Function Helper untuk Auto-Update Kolom `updated_at`
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- ========================================================
-- MEMBUAT TABEL UTAMA (Idempotent: IF NOT EXISTS)
-- ========================================================
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) UNIQUE NOT NULL,
  "username" varchar(100) UNIQUE NOT NULL,
  "password" varchar(255) NOT NULL,
  "name" varchar(255),
  "role" "Role" NOT NULL DEFAULT 'SUPERADMIN',
  "birth_date" date,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "description" text,
  "price" double precision NOT NULL,
  "status" "ProductStatus" NOT NULL DEFAULT 'AVAILABLE',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "zones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "description" text,
  "max_capacity" int,
  "status" "ZoneStatus" NOT NULL DEFAULT 'ACTIVE',
  "polygon" jsonb NOT NULL,
  "invalid_reason" jsonb,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "criterias" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "type" "CriteriaType" NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "weight" double precision,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "dss_histories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "execution_date" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consistency_ratio" double precision,
  "status" varchar(100) NOT NULL,
  "details" jsonb,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" varchar(255) PRIMARY KEY,
  "token" varchar(255) UNIQUE NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" timestamp NOT NULL,
  "revoked" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" varchar(255) PRIMARY KEY,
  "token" varchar(255) UNIQUE NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" timestamp NOT NULL,
  "used" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "armadas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" varchar(100) UNIQUE NOT NULL,
  "type" "ArmadaType" NOT NULL DEFAULT 'GEROBAK',
  "status" "ArmadaStatus" NOT NULL DEFAULT 'ACTIVE',
  "current_rider_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reserved_by_rider_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reserved_until" timestamp,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "pois" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "osm_id" bigint UNIQUE,
  "osm_type" varchar(20) DEFAULT NULL,
  "external_id" varchar(255),
  "logical_poi_id" uuid,
  "duplicate_of" uuid REFERENCES "pois"("id") ON DELETE SET NULL,
  "name" varchar(255) NOT NULL,
  "category" varchar(100) NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'APPROVED',
  "approval_status" varchar(50) NOT NULL DEFAULT 'APPROVED',
  "operational_status" varchar(50) NOT NULL DEFAULT 'ELIGIBLE',
  "exclusion_reason" varchar(100),
  "metadata" jsonb DEFAULT '{}',
  "geom" geometry(Point, 4326),
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE pois ADD COLUMN IF NOT EXISTS osm_id bigint UNIQUE;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS osm_type varchar(20) DEFAULT NULL;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS external_id varchar(255);
ALTER TABLE pois ADD COLUMN IF NOT EXISTS logical_poi_id uuid;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES pois(id) ON DELETE SET NULL;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE pois ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT 'APPROVED';
ALTER TABLE pois ADD COLUMN IF NOT EXISTS approval_status varchar(50) NOT NULL DEFAULT 'APPROVED';
ALTER TABLE pois ADD COLUMN IF NOT EXISTS operational_status varchar(50) NOT NULL DEFAULT 'ELIGIBLE';
ALTER TABLE pois ADD COLUMN IF NOT EXISTS exclusion_reason varchar(100);
ALTER TABLE pois ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

CREATE TABLE IF NOT EXISTS candidate_selling_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  poi_id uuid REFERENCES pois(id) ON DELETE SET NULL,
  name varchar(255) NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geom geometry(Point, 4326) NOT NULL,
  source varchar(100) DEFAULT 'MANUAL',
  validation_status varchar(50) NOT NULL DEFAULT 'ALLOWED',
  rejection_reason varchar(255),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "poi_approval_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "poi_id" uuid REFERENCES "pois"("id") ON DELETE CASCADE,
  "action" varchar(50) NOT NULL,
  "action_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "weathers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "zone_id" uuid NOT NULL REFERENCES "zones"("id") ON DELETE CASCADE,
  "timestamp" timestamp NOT NULL,
  "temperature_2m" double precision,
  "relative_humidity_2m" double precision,
  "dew_point_2m" double precision,
  "apparent_temperature" double precision,
  "precipitation_probability" double precision,
  "precipitation" double precision,
  "rain" double precision,
  "weather_code" int,
  "showers" double precision,
  "visibility" double precision,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "sales_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rider_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "assignment_id" uuid REFERENCES "zone_assignments"("id") ON DELETE SET NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "qty" int NOT NULL,
  "unit_price" numeric(12,2) NOT NULL DEFAULT 0,
  "total_price" numeric(14,2) NOT NULL DEFAULT 0,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "zone_id" uuid REFERENCES "zones"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sales_logs ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES zone_assignments(id) ON DELETE SET NULL;
ALTER TABLE sales_logs ADD COLUMN IF NOT EXISTS unit_price numeric(12,2) DEFAULT 0;
ALTER TABLE sales_logs ADD COLUMN IF NOT EXISTS total_price numeric(14,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sales_logs_rider ON sales_logs(rider_id);
CREATE INDEX IF NOT EXISTS idx_sales_logs_assignment ON sales_logs(assignment_id);
CREATE INDEX IF NOT EXISTS idx_sales_logs_created_at ON sales_logs(created_at);

-- [LEGACY / DEPRECATED] Prototype table for session tracking - replaced by canonical zone_assignments
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rider_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "zone_id" uuid REFERENCES "zones"("id") ON DELETE SET NULL,
  "status" "SessionStatus" NOT NULL DEFAULT 'QUEUE',
  "check_in_time" timestamp,
  "check_out_time" timestamp,
  "date" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- [LEGACY / DEPRECATED] Prototype table for rider plotting - replaced by canonical zone_assignments & rider_duty_queues
CREATE TABLE IF NOT EXISTS "rider_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rider_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "zone_id" uuid NOT NULL REFERENCES "zones"("id") ON DELETE CASCADE,
  "date" timestamp NOT NULL,
  "status" "PlotStatus" NOT NULL DEFAULT 'DRAFT',
  "assigned_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rider_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "zone_id" uuid NOT NULL REFERENCES "zones"("id") ON DELETE CASCADE,
  "score" double precision NOT NULL,
  "rank" int NOT NULL,
  "date" timestamp NOT NULL,
  "dss_history_id" uuid NOT NULL REFERENCES "dss_histories"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "competitors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "zone_id" uuid NOT NULL REFERENCES "zones"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "category" varchar(50) DEFAULT 'DIRECT_STARLING',
  "weight" int CHECK (weight BETWEEN 1 AND 3) DEFAULT 1,
  "latitude" double precision,
  "longitude" double precision,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE competitors ADD COLUMN IF NOT EXISTS category varchar(50) DEFAULT 'DIRECT_STARLING';
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS weight int CHECK (weight BETWEEN 1 AND 3) DEFAULT 1;

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "user_role" varchar(50),
  "action" varchar(100) NOT NULL,
  "entity_type" varchar(50),
  "entity_id" varchar(255),
  "details" jsonb DEFAULT '{}',
  "ip_address" varchar(100),
  "user_agent" text,
  "status" varchar(50) NOT NULL DEFAULT 'SUCCESS',
  "old_values" jsonb,
  "new_values" jsonb,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_role varchar(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type varchar(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address varchar(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values jsonb;
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='entity') THEN
    ALTER TABLE audit_logs ALTER COLUMN entity DROP NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "dss_configurations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255),
  "is_active" boolean DEFAULT false,
  "best_criteria_id" uuid REFERENCES "criterias"("id") ON DELETE SET NULL,
  "worst_criteria_id" uuid REFERENCES "criterias"("id") ON DELETE SET NULL,
  "best_to_others" jsonb,
  "worst_to_others" jsonb,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "system_settings" (
  "key" varchar(100) PRIMARY KEY,
  "value" text NOT NULL,
  "description" varchar(255),
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "poi_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) UNIQUE NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "score_pagi" int NOT NULL DEFAULT 1 CHECK (score_pagi BETWEEN 1 AND 5),
  "score_siang" int NOT NULL DEFAULT 1 CHECK (score_siang BETWEEN 1 AND 5),
  "score_sore" int NOT NULL DEFAULT 1 CHECK (score_sore BETWEEN 1 AND 5),
  "score_malam" int NOT NULL DEFAULT 1 CHECK (score_malam BETWEEN 1 AND 5),
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE poi_categories ADD COLUMN IF NOT EXISTS score_pagi int NOT NULL DEFAULT 1 CHECK (score_pagi BETWEEN 1 AND 5);
ALTER TABLE poi_categories ADD COLUMN IF NOT EXISTS score_siang int NOT NULL DEFAULT 1 CHECK (score_siang BETWEEN 1 AND 5);
ALTER TABLE poi_categories ADD COLUMN IF NOT EXISTS score_sore int NOT NULL DEFAULT 1 CHECK (score_sore BETWEEN 1 AND 5);
ALTER TABLE poi_categories ADD COLUMN IF NOT EXISTS score_malam int NOT NULL DEFAULT 1 CHECK (score_malam BETWEEN 1 AND 5);

CREATE TABLE IF NOT EXISTS pois_raw (
  id SERIAL PRIMARY KEY,
  city_name VARCHAR(255) UNIQUE NOT NULL,
  raw_data JSONB NOT NULL,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rider_duty_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duty_date date NOT NULL DEFAULT CURRENT_DATE,
  confirmed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status varchar(50) NOT NULL DEFAULT 'WAITING', -- WAITING, PLOTTED, CANCELLED
  CONSTRAINT unique_rider_duty_per_date UNIQUE(rider_id, duty_date)
);

CREATE TABLE IF NOT EXISTS zone_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  armada_id uuid REFERENCES armadas(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assignment_type varchar(50) NOT NULL DEFAULT 'AUTO', -- AUTO, MANUAL
  assignment_date date NOT NULL DEFAULT CURRENT_DATE,
  status varchar(50) NOT NULL DEFAULT 'ASSIGNED', -- ASSIGNED, CHECKED_IN, COMPLETED, CANCELLED
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_rider_assignment_per_date UNIQUE(rider_id, assignment_date)
);



CREATE TABLE IF NOT EXISTS cron_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_key varchar(100) UNIQUE NOT NULL, -- POI_SYNC, WEATHER_SYNC, ARMADA_RELEASE, DAILY_CLEANUP
  name varchar(255) NOT NULL,
  description text,
  cron_expression varchar(100) NOT NULL DEFAULT '0 * * * *',
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamp,
  next_run_at timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cron_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_key varchar(100) NOT NULL,
  status varchar(50) NOT NULL, -- SUCCESS, FAILED, RUNNING
  duration_ms integer DEFAULT 0,
  message text,
  executed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS protocol_roads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id varchar(255) UNIQUE,
  name varchar(255),
  highway_type varchar(100),
  restriction_type varchar(100) DEFAULT 'PROHIBITED_ROAD',
  geom geometry(LineString, 4326) NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_protocol_roads_geom_gist ON protocol_roads USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_protocol_roads_restriction ON protocol_roads (restriction_type);

-- ========================================================
-- MEMBUAT TRIGGER FOR AUTO UPDATED_AT (Aman & Idempotent)
-- ========================================================
DROP TRIGGER IF EXISTS trg_users_updated_at ON "users";
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_products_updated_at ON "products";
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON "products" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_zones_updated_at ON "zones";
CREATE TRIGGER trg_zones_updated_at BEFORE UPDATE ON "zones" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_criterias_updated_at ON "criterias";
CREATE TRIGGER trg_criterias_updated_at BEFORE UPDATE ON "criterias" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_dss_histories_updated_at ON "dss_histories";
CREATE TRIGGER trg_dss_histories_updated_at BEFORE UPDATE ON "dss_histories" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON "notifications";
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON "notifications" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_armadas_updated_at ON "armadas";
CREATE TRIGGER trg_armadas_updated_at BEFORE UPDATE ON "armadas" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pois_updated_at ON "pois";
CREATE TRIGGER trg_pois_updated_at BEFORE UPDATE ON "pois" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_weathers_updated_at ON "weathers";
CREATE TRIGGER trg_weathers_updated_at BEFORE UPDATE ON "weathers" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sales_logs_updated_at ON "sales_logs";
CREATE TRIGGER trg_sales_logs_updated_at BEFORE UPDATE ON "sales_logs" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sessions_updated_at ON "sessions";
CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON "sessions" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rider_assignments_updated_at ON "rider_assignments";
CREATE TRIGGER trg_rider_assignments_updated_at BEFORE UPDATE ON "rider_assignments" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_recommendations_updated_at ON "recommendations";
CREATE TRIGGER trg_recommendations_updated_at BEFORE UPDATE ON "recommendations" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_competitors_updated_at ON "competitors";
CREATE TRIGGER trg_competitors_updated_at BEFORE UPDATE ON "competitors" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_dss_configurations_updated_at ON "dss_configurations";
CREATE TRIGGER trg_dss_configurations_updated_at BEFORE UPDATE ON "dss_configurations" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON "system_settings";
CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON "system_settings" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_poi_categories_updated_at ON "poi_categories";
CREATE TRIGGER trg_poi_categories_updated_at BEFORE UPDATE ON "poi_categories" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================================
-- MEMBUAT INDEKS PERFORMA (B-Tree & Composite Indexes)
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_pois_location ON pois (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_competitors_location ON competitors (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_rider_duty_queues_date_status ON rider_duty_queues (duty_date, status);
CREATE INDEX IF NOT EXISTS idx_zone_assignments_date_rider ON zone_assignments (assignment_date, rider_id);
CREATE INDEX IF NOT EXISTS idx_sales_logs_rider_created ON sales_logs (rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_action ON audit_logs (created_at DESC, action);
CREATE INDEX IF NOT EXISTS idx_armadas_status_reserved ON armadas (status, reserved_until);