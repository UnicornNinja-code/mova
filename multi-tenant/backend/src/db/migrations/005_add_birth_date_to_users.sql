-- Migration 005: Menambahkan kolom birth_date ke tabel users
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
