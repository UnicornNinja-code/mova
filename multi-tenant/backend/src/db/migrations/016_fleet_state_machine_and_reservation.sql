-- =============================================================================
-- Migration 016: Fleet State Machine, Atomic 5-Minute Reservation & Multi-Tenant Scoping
-- =============================================================================

BEGIN;

-- 1. Ensure tenant_id on fleet tables
ALTER TABLE "fleet_reservations" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "fleet_assignments" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "fleet_issue_reports" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(100) NOT NULL DEFAULT 'thesis-default' REFERENCES "tenants"("id") ON DELETE RESTRICT;

-- 2. Create indexes for tenant scoping
CREATE INDEX IF NOT EXISTS "idx_fleet_reservations_tenant" ON "fleet_reservations"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_fleet_assignments_tenant" ON "fleet_assignments"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_fleet_issue_reports_tenant" ON "fleet_issue_reports"("tenant_id", "status");

-- 3. Enable and Force Row Level Security (RLS)
ALTER TABLE "fleet_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fleet_reservations" FORCE ROW LEVEL SECURITY;

ALTER TABLE "fleet_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fleet_assignments" FORCE ROW LEVEL SECURITY;

ALTER TABLE "fleet_issue_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fleet_issue_reports" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fleet_reservations_tenant_isolation ON "fleet_reservations";
CREATE POLICY fleet_reservations_tenant_isolation ON "fleet_reservations"
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  );

DROP POLICY IF EXISTS fleet_assignments_tenant_isolation ON "fleet_assignments";
CREATE POLICY fleet_assignments_tenant_isolation ON "fleet_assignments"
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  );

DROP POLICY IF EXISTS fleet_issue_reports_tenant_isolation ON "fleet_issue_reports";
CREATE POLICY fleet_issue_reports_tenant_isolation ON "fleet_issue_reports"
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.bypass_rls', true)::text = 'on'
  );

-- 4. Grant Permissions to Application Role
GRANT ALL PRIVILEGES ON "fleet_reservations" TO mova_app;
GRANT ALL PRIVILEGES ON "fleet_assignments" TO mova_app;
GRANT ALL PRIVILEGES ON "fleet_issue_reports" TO mova_app;

COMMIT;
