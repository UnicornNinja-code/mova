-- Migration: 007_add_onboarding_and_first_login_columns.sql
-- Description: Add first_login and birth_date columns to users table and initialize Day-0 system settings

DO $$
BEGIN
    -- 1. Tambah kolom first_login jika belum ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'first_login'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "first_login" boolean NOT NULL DEFAULT false;
    END IF;

    -- 2. Tambah kolom birth_date jika belum ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'birth_date'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "birth_date" date;
    END IF;
END $$;

-- 3. Inisialisasi System Settings untuk Day-0 Onboarding & Setup Wizard jika belum ada
INSERT INTO "system_settings" ("key", "value", "description")
VALUES 
    ('SYSTEM_INITIALIZED', 'false', 'Status Inisialisasi Pertama Sistem — wajib selesaikan Setup Wizard'),
    ('SYSTEM_SETUP_CURRENT_STEP', '1', 'Tahapan Wizard Inisialisasi Sistem saat ini')
ON CONFLICT ("key") DO NOTHING;
