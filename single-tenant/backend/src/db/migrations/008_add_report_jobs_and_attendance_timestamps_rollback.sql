-- Migration Rollback: 008_add_report_jobs_and_attendance_timestamps_rollback.sql

DROP TABLE IF EXISTS "report_jobs" CASCADE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zone_assignments' AND column_name = 'check_in_time'
    ) THEN
        ALTER TABLE "zone_assignments" DROP COLUMN "check_in_time";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zone_assignments' AND column_name = 'check_out_time'
    ) THEN
        ALTER TABLE "zone_assignments" DROP COLUMN "check_out_time";
    END IF;
END $$;
