-- 008_create_user_preferences_and_dss_audit.sql
-- Migrasi tabel preferensi user (tema peta, layout dashboard) dan audit metadata DSS BWM

-- 1. Tabel User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  map_theme varchar(50) NOT NULL DEFAULT 'openmaptiles-dark',
  dashboard_layout jsonb DEFAULT '{}',
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Audit metadata dss_configurations
ALTER TABLE dss_configurations ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE dss_configurations ADD COLUMN IF NOT EXISTS created_by_name varchar(255);
ALTER TABLE dss_configurations ADD COLUMN IF NOT EXISTS activated_at timestamp DEFAULT CURRENT_TIMESTAMP;

-- 3. Trigger auto update timestamp
DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at 
BEFORE UPDATE ON user_preferences 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
