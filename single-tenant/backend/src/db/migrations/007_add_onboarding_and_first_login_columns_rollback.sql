-- Migration Rollback: 007_add_onboarding_and_first_login_columns_rollback.sql

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'first_login'
    ) THEN
        ALTER TABLE "users" DROP COLUMN "first_login";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'birth_date'
    ) THEN
        ALTER TABLE "users" DROP COLUMN "birth_date";
    END IF;
END $$;
