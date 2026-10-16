-- Migration: 20261016000005_ai_log_metadata.sql
-- Menambahkan kolom metadata pada ai_log untuk mencatat rincian durasi per langkah (ekstraksi, memori, draf, validasi)
ALTER TABLE public.ai_log ADD COLUMN IF NOT EXISTS metadata JSONB;
