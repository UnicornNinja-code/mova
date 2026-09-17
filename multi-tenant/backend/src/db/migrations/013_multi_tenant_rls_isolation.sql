-- =============================================================================
-- Migration 013: Multi-Tenant Architecture, Safe Session RLS Policies,
-- and Tenant Scoping Columns
-- =============================================================================

BEGIN;

-- 1. Create tenants Master Table
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" varchar(100) PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "code" varchar(50) UNIQUE NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'ACTIVE',
  "max_fleets" int NOT NULL DEFAULT 50,
  "max_riders" int NOT NULL DEFAULT 100,
  "max_zones" int NOT NULL DEFAULT 10,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insert Default Tenant for Thesis & Single-Tenant Scope (Sejuta Jiwa)
INSERT INTO "tenants" ("id", "name", "code", "status", "max_fleets", "max_riders", "max_zones")
VALUES ('thesis-default', 'Sejuta Jiwa Coffee', 'SEJUTA_JIWA', 'ACTIVE', 100, 200, 20)
ON CONFLICT ("id") DO NOTHING;

-- 3. Add tenant_id column to tenant-scoped tables
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "armadas" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "zones" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_logs" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "candidate_selling_locations" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operational_sessions') THEN
    ALTER TABLE "operational_sessions" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
    ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;
  END IF;
END $$;

-- 4. Create Indexes for Tenant Scoping
CREATE INDEX IF NOT EXISTS "idx_users_tenant_id" ON "users"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_armadas_tenant_id" ON "armadas"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_zones_tenant_id" ON "zones"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_products_tenant_id" ON "products"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_sales_logs_tenant_id" ON "sales_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_candidate_selling_locations_tenant_id" ON "candidate_selling_locations"("tenant_id");

-- 5. Enable PostgreSQL Row-Level Security (RLS) on Tenant Tables
ALTER TABLE "sales_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales_logs" FORCE ROW LEVEL SECURITY;

ALTER TABLE "armadas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "armadas" FORCE ROW LEVEL SECURITY;

ALTER TABLE "zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "zones" FORCE ROW LEVEL SECURITY;

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;

ALTER TABLE "candidate_selling_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidate_selling_locations" FORCE ROW LEVEL SECURITY;

-- 6. Create or Replace RLS Isolation Policies
-- Drop existing policies if any to ensure clean updates
DROP POLICY IF EXISTS sales_logs_tenant_isolation ON "sales_logs";
DROP POLICY IF EXISTS armadas_tenant_isolation ON "armadas";
DROP POLICY IF EXISTS zones_tenant_isolation ON "zones";
DROP POLICY IF EXISTS products_tenant_isolation ON "products";
DROP POLICY IF EXISTS candidate_locations_tenant_isolation ON "candidate_selling_locations";

CREATE POLICY sales_logs_tenant_isolation ON "sales_logs"
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  );

CREATE POLICY armadas_tenant_isolation ON "armadas"
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  );

CREATE POLICY zones_tenant_isolation ON "zones"
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  );

CREATE POLICY products_tenant_isolation ON "products"
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  );

CREATE POLICY candidate_locations_tenant_isolation ON "candidate_selling_locations"
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  );

-- 7. Create Dedicated Application Role with NOBYPASSRLS for Strict Multi-Tenant Enforcement
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mova_app') THEN
    CREATE ROLE mova_app WITH LOGIN PASSWORD 'root' NOSUPERUSER NOBYPASSRLS;
  END IF;
  GRANT USAGE, CREATE ON SCHEMA public TO mova_app;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mova_app;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mova_app;
  GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO mova_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mova_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mova_app;
END $$;

COMMIT;
