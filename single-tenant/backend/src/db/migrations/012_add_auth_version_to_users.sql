-- Migration 012: Add auth_version to users for OWASP/NIST compliant session invalidation
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER DEFAULT 1 NOT NULL;
