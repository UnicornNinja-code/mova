-- =============================================================================
-- Migration 019: Operational Reporting & Asynchronous Export Jobs Schema
-- S7-05-02: Export Job Persistence, Resource Governance & RLS Isolation
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS report_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    report_type VARCHAR(64) NOT NULL,
    format VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    range_start TIMESTAMPTZ NOT NULL,
    range_end TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
    progress INT NOT NULL DEFAULT 0,
    row_count INT NULL,
    row_limit INT NOT NULL DEFAULT 100000,
    truncated BOOLEAN NOT NULL DEFAULT FALSE,
    artifact_path TEXT NULL,
    artifact_expires_at TIMESTAMPTZ NULL,
    error_code VARCHAR(64) NULL,
    error_message TEXT NULL,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    rider_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    failed_at TIMESTAMPTZ NULL
);

-- Indexing for multi-tenant querying, governor concurrency checks & TTL cleanups
CREATE INDEX IF NOT EXISTS idx_report_jobs_tenant_created 
    ON report_export_jobs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_jobs_tenant_status 
    ON report_export_jobs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_report_jobs_expires 
    ON report_export_jobs(artifact_expires_at) 
    WHERE artifact_expires_at IS NOT NULL;

-- Enable Row-Level Security (RLS)
ALTER TABLE report_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_export_jobs FORCE ROW LEVEL SECURITY;

-- PostgreSQL RLS Policies for Multi-Tenant Isolation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'report_export_jobs' AND policyname = 'report_jobs_tenant_isolation_mova_app'
    ) THEN
        CREATE POLICY report_jobs_tenant_isolation_mova_app ON report_export_jobs
            FOR ALL
            TO mova_app
            USING (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
                OR current_setting('app.bypass_rls', true)::text = 'on'
            )
            WITH CHECK (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
                OR current_setting('app.bypass_rls', true)::text = 'on'
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'report_export_jobs' AND policyname = 'report_jobs_tenant_isolation_all'
    ) THEN
        CREATE POLICY report_jobs_tenant_isolation_all ON report_export_jobs
            FOR ALL
            TO PUBLIC
            USING (
                current_user = 'postgres'
                OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
                OR current_setting('app.bypass_rls', true)::text = 'on'
            )
            WITH CHECK (
                current_user = 'postgres'
                OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
                OR current_setting('app.bypass_rls', true)::text = 'on'
            );
    END IF;
END $$;

COMMIT;
