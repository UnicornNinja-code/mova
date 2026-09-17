-- =============================================================================
-- Migration 015: Competitor Domain, Relevance Engine, and Dynamic Observations
-- =============================================================================

BEGIN;

-- 1. Create competitor_profiles Table (Tenant-Scoped)
CREATE TABLE IF NOT EXISTS "competitor_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar(100) NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "name" varchar(255) NOT NULL,
  "min_price" double precision NOT NULL DEFAULT 8000 CHECK ("min_price" >= 0),
  "max_price" double precision NOT NULL DEFAULT 18000 CHECK ("max_price" >= "min_price"),
  "radius_meters" int NOT NULL DEFAULT 500 CHECK ("radius_meters" > 0),
  "target_categories" text[] NOT NULL DEFAULT '{"WARUNG_KOPI","GIRAS","KOPI_KELILING","BOOTH"}',
  "business_models" text[] NOT NULL DEFAULT '{"MOBILE","SEMI_MOBILE","BOOTH"}',
  "activity_start" time DEFAULT '06:00:00',
  "activity_end" time DEFAULT '22:00:00',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create competitor_observations Table (Tenant-Scoped)
CREATE TABLE IF NOT EXISTS "competitor_observations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar(100) NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "profile_id" uuid REFERENCES "competitor_profiles"("id") ON DELETE SET NULL,
  "name" varchar(255) NOT NULL,
  "category" varchar(100) NOT NULL,
  "latitude" double precision NOT NULL CHECK ("latitude" >= -90 AND "latitude" <= 90),
  "longitude" double precision NOT NULL CHECK ("longitude" >= -180 AND "longitude" <= 180),
  "geom" geometry(Point, 4326),
  "min_price" double precision CHECK ("min_price" IS NULL OR "min_price" >= 0),
  "max_price" double precision CHECK ("max_price" IS NULL OR ("min_price" IS NOT NULL AND "max_price" >= "min_price")),
  "business_model" varchar(50) NOT NULL DEFAULT 'MOBILE', -- MOBILE, SEMI_MOBILE, BOOTH, CAFE
  "source" varchar(50) NOT NULL DEFAULT 'RIDER', -- 'OSM', 'RIDER', 'SUPERVISOR', 'MANAGEMENT'
  "confidence" double precision NOT NULL DEFAULT 0.6 CHECK ("confidence" >= 0.5 AND "confidence" <= 1.0),
  "status" varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'
  "activity_start" time,
  "activity_end" time,
  "observed_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Automatic Geom Generation & Cross-Tenant FK Validation Triggers
CREATE OR REPLACE FUNCTION trg_competitor_obs_geom_and_tenant_guard()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  prof_tenant varchar(100);
BEGIN
  -- Auto-generate geom from lat/lon
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  NEW.updated_at := CURRENT_TIMESTAMP;

  -- Cross-Tenant profile_id Validation Guard
  IF NEW.profile_id IS NOT NULL THEN
    SELECT tenant_id INTO prof_tenant FROM "competitor_profiles" WHERE id = NEW.profile_id;
    IF prof_tenant IS NULL THEN
      RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: profile_id (%) does not exist or is inaccessible', NEW.profile_id;
    ELSIF prof_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: profile_id (%) belongs to tenant (%) but observation belongs to tenant (%)',
        NEW.profile_id, prof_tenant, NEW.tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_competitor_observations_guard ON "competitor_observations";
CREATE TRIGGER trg_competitor_observations_guard
BEFORE INSERT OR UPDATE ON "competitor_observations"
FOR EACH ROW EXECUTE FUNCTION trg_competitor_obs_geom_and_tenant_guard();

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "idx_competitor_profiles_tenant" ON "competitor_profiles"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_competitor_obs_geom_gist" ON "competitor_observations" USING GIST ("geom");
CREATE INDEX IF NOT EXISTS "idx_competitor_obs_tenant_status" ON "competitor_observations"("tenant_id", "status", "expires_at");
CREATE INDEX IF NOT EXISTS "idx_competitor_obs_profile" ON "competitor_observations"("profile_id");

-- 5. Enable PostgreSQL Row-Level Security (RLS)
ALTER TABLE "competitor_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competitor_profiles" FORCE ROW LEVEL SECURITY;

ALTER TABLE "competitor_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competitor_observations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS competitor_profiles_tenant_isolation ON "competitor_profiles";
CREATE POLICY competitor_profiles_tenant_isolation ON "competitor_profiles"
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  );

DROP POLICY IF EXISTS competitor_observations_tenant_isolation ON "competitor_observations";
CREATE POLICY competitor_observations_tenant_isolation ON "competitor_observations"
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  );

-- 6. Grant Permissions to Application Role
GRANT ALL PRIVILEGES ON "competitor_profiles" TO mova_app;
GRANT ALL PRIVILEGES ON "competitor_observations" TO mova_app;

COMMIT;
