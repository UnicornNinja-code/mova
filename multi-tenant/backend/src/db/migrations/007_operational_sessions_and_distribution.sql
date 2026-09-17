-- ========================================================
-- Migration 007: Operational Sessions, Distribution Runs & Items
-- ========================================================

-- 1. Tabel Sesi Operasional Harian
CREATE TABLE IF NOT EXISTS operational_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code varchar(100) UNIQUE NOT NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  time_slot varchar(50) NOT NULL, -- PAGI, SIANG, SORE, MALAM
  start_time time NOT NULL,
  end_time time NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'OPEN', -- OPEN, ACTIVE, CLOSED, CANCELLED
  dss_config_version integer DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_op_sessions_date_slot ON operational_sessions (session_date, time_slot);

-- 2. Kolom Relasi Sesi pada rider_duty_queues
ALTER TABLE rider_duty_queues 
ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES operational_sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS eligibility_status varchar(50) DEFAULT 'ELIGIBLE',
ADD COLUMN IF NOT EXISTS notes text;

-- 3. Kolom Relasi Sesi pada zone_assignments
ALTER TABLE zone_assignments 
ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES operational_sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS zone_version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS notes text;

-- 4. Tabel Riwayat Eksekusi Distribusi DSS
CREATE TABLE IF NOT EXISTS distribution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES operational_sessions(id) ON DELETE SET NULL,
  run_number varchar(100) NOT NULL,
  execution_type varchar(50) NOT NULL DEFAULT 'AUTO', -- AUTO, MANUAL, HYBRID
  dss_snapshot jsonb DEFAULT '{}',
  total_riders integer NOT NULL DEFAULT 0,
  assigned_count integer NOT NULL DEFAULT 0,
  unassigned_count integer NOT NULL DEFAULT 0,
  executed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  executed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dist_runs_session ON distribution_runs (session_id);
CREATE INDEX IF NOT EXISTS idx_dist_runs_executed ON distribution_runs (executed_at);

-- 5. Tabel Item Detail Distribusi Rider ke Zona
CREATE TABLE IF NOT EXISTS distribution_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES distribution_runs(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES zones(id) ON DELETE SET NULL,
  armada_id uuid REFERENCES armadas(id) ON DELETE SET NULL,
  topsis_score numeric(8,4),
  compatibility_score numeric(8,4),
  distance_km numeric(8,2),
  status varchar(50) NOT NULL DEFAULT 'ASSIGNED', -- ASSIGNED, UNASSIGNED, REJECTED
  reason text
);

CREATE INDEX IF NOT EXISTS idx_dist_items_run ON distribution_run_items (run_id);
CREATE INDEX IF NOT EXISTS idx_dist_items_rider ON distribution_run_items (rider_id);
