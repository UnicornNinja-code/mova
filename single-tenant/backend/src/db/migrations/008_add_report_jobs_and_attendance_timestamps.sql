-- Migration: 008_add_report_jobs_and_attendance_timestamps.sql
-- Description: Add attendance timestamps to zone_assignments and create report_jobs table for export tracking

DO $$
BEGIN
    -- 1. Tambah kolom check_in_time dan check_out_time pada zone_assignments jika belum ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zone_assignments' AND column_name = 'check_in_time'
    ) THEN
        ALTER TABLE "zone_assignments" ADD COLUMN "check_in_time" timestamp;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zone_assignments' AND column_name = 'check_out_time'
    ) THEN
        ALTER TABLE "zone_assignments" ADD COLUMN "check_out_time" timestamp;
    END IF;
END $$;

-- 2. Buat tabel report_jobs untuk mencatat riwayat ekspor laporan
CREATE TABLE IF NOT EXISTS "report_jobs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "report_type" varchar(100) NOT NULL,
    "format" varchar(20) NOT NULL, -- CSV, XLSX, PDF
    "status" varchar(50) NOT NULL DEFAULT 'COMPLETED', -- QUEUED, PROCESSING, COMPLETED, FAILED
    "range_start" timestamp,
    "range_end" timestamp,
    "row_count" int DEFAULT 0,
    "file_size_bytes" bigint DEFAULT 0,
    "artifact_filename" varchar(255),
    "zone_id" uuid REFERENCES "zones"("id") ON DELETE SET NULL,
    "rider_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_created_at ON "report_jobs"("created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_report_jobs_type ON "report_jobs"("report_type");
