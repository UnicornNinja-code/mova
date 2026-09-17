-- ========================================================
-- Migration 006: Fleet Reservations, Assignments & Issue Reports
-- ========================================================

-- 1. Tambahkan nilai 'RETIRED' ke enum ArmadaStatus jika belum ada
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'ArmadaStatus' AND e.enumlabel = 'RETIRED') THEN
    ALTER TYPE "ArmadaStatus" ADD VALUE 'RETIRED';
  END IF;
END $$;

-- 2. Tabel Klaim & Reservasi 5-Menit Armada
CREATE TABLE IF NOT EXISTS fleet_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  armada_id uuid NOT NULL REFERENCES armadas(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, CANCELLED, CLAIMED
  inspection_checklist jsonb DEFAULT '{}',
  inspection_notes text,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_fleet_reservations_armada ON fleet_reservations (armada_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_reservations_rider ON fleet_reservations (rider_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_reservations_expires ON fleet_reservations (expires_at);

-- 3. Tabel Penugasan & Check-in / Check-out Armada
CREATE TABLE IF NOT EXISTS fleet_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  armada_id uuid NOT NULL REFERENCES armadas(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES zones(id) ON DELETE SET NULL,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  status varchar(50) NOT NULL DEFAULT 'ASSIGNED', -- ASSIGNED, IN_USE, RETURNED, DAMAGED, CANCELLED
  initial_condition jsonb DEFAULT '{}',
  return_condition jsonb DEFAULT '{}',
  claimed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returned_at timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fleet_assignments_armada ON fleet_assignments (armada_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_assignments_rider ON fleet_assignments (rider_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_assignments_date ON fleet_assignments (assigned_date);

-- 4. Tabel Pelaporan Kendala Fisik Armada
CREATE TABLE IF NOT EXISTS fleet_issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  armada_id uuid NOT NULL REFERENCES armadas(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  severity varchar(50) NOT NULL DEFAULT 'MINOR', -- MINOR, CRITICAL
  issue_type varchar(100) NOT NULL, -- BATTERY, BRAKE, TIRE, COOLER, STOVE, OTHER
  description text NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'REPORTED', -- REPORTED, IN_REVIEW, REPLACED, RESOLVED, SENT_TO_MAINTENANCE
  resolution_notes text,
  reported_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_fleet_issue_armada ON fleet_issue_reports (armada_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_issue_rider ON fleet_issue_reports (rider_id);
