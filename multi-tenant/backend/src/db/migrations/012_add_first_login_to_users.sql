-- Migration 012: Add first_login flag to users table
-- Purpose: Track whether a user has completed their mandatory first-time password change
-- Behavior:
--   - Existing users: first_login = false (already operational, no forced change)
--   - New users created via provisioning: first_login = true (set by userService)
--   - Resets to false after successful first-time password change

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_login boolean NOT NULL DEFAULT false;

-- Super Admin accounts that exist with a real birth_date are considered already
-- activated and do not need first-login flow.
-- All other existing users also get false by default (they are already active/operational).
-- New accounts created via createUserService will have first_login = true set explicitly.

COMMENT ON COLUMN users.first_login IS
  'True if this account has never completed the mandatory first-time password setup. '
  'Set to true when account is provisioned, set to false after user completes first-login password change.';
