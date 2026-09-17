-- Migration 003: Idempotently add invalid_reason JSONB column to zones table
ALTER TABLE "zones" ADD COLUMN IF NOT EXISTS "invalid_reason" JSONB;

-- Seed default operational rules in system_settings if not present
INSERT INTO "system_settings" ("key", "value", "description")
VALUES 
  ('OPERATIONAL_RULE_PROTOCOL_ROAD', 'true', 'Larangan operasional berjualan pada area jalan protokol'),
  ('OPERATIONAL_RULE_TOLL_ROAD', 'true', 'Larangan operasional berjualan pada area jalan tol')
ON CONFLICT ("key") DO NOTHING;
