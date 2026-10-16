-- Migration: 20261017000000_ai_log_provider_and_cost.sql
-- Tambah kolom provider, alasan_pindah, dan biaya_perkiraan ke public.ai_log

ALTER TABLE public.ai_log ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.ai_log ADD COLUMN IF NOT EXISTS alasan_pindah TEXT;
ALTER TABLE public.ai_log ADD COLUMN IF NOT EXISTS biaya_perkiraan NUMERIC;

CREATE INDEX IF NOT EXISTS idx_ai_log_provider ON public.ai_log(provider);
CREATE INDEX IF NOT EXISTS idx_ai_log_alasan_pindah ON public.ai_log(alasan_pindah);
