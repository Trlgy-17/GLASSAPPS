-- Migration: 20261016000006_ai_log_detailed_trials.sql
-- Menambahkan kolom per percobaan pada ai_log:
-- langkah ('ekstraksi', 'memori', 'draf', 'revisi'), ms_ttft (waktu ke token pertama), attempt, error_code

ALTER TABLE public.ai_log 
ADD COLUMN IF NOT EXISTS langkah TEXT,
ADD COLUMN IF NOT EXISTS ms_ttft INT,
ADD COLUMN IF NOT EXISTS attempt INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS error_code TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_log_langkah ON public.ai_log(langkah);
CREATE INDEX IF NOT EXISTS idx_ai_log_model ON public.ai_log(model);
