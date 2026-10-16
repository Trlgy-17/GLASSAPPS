-- Migration: 20261016000008_ai_rate_limits_table.sql
-- Penyimpanan rate limit AI bersama di database Supabase untuk multi-instance deployment

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_user_time ON public.ai_rate_limits(user_id, created_at);

-- Fungsi atomic RPC untuk check & record rate limit
CREATE OR REPLACE FUNCTION public.check_and_record_ai_rate_limit(
    p_user_id UUID,
    p_endpoint TEXT,
    p_limit INT DEFAULT 20,
    p_window_seconds INT DEFAULT 60
)
RETURNS JSON AS $$
DECLARE
    v_count INT;
    v_oldest TIMESTAMPTZ;
    v_retry_after INT := 0;
BEGIN
    -- Hitung panggilan user dalam rentang window
    SELECT COUNT(*), MIN(created_at)
    INTO v_count, v_oldest
    FROM public.ai_rate_limits
    WHERE user_id = p_user_id
      AND created_at >= NOW() - (p_window_seconds || ' seconds')::INTERVAL;

    IF v_count >= p_limit THEN
        v_retry_after := CEIL(EXTRACT(EPOCH FROM (v_oldest + (p_window_seconds || ' seconds')::INTERVAL - NOW())));
        IF v_retry_after < 1 THEN v_retry_after := 1; END IF;
        RETURN JSON_BUILD_OBJECT('allowed', false, 'remaining', 0, 'retry_after_sec', v_retry_after);
    END IF;

    -- Catat request baru
    INSERT INTO public.ai_rate_limits(user_id, endpoint)
    VALUES (p_user_id, p_endpoint);

    -- Bersihkan data kedaluwarsa secara berkala (lebih dari 1 jam)
    DELETE FROM public.ai_rate_limits
    WHERE user_id = p_user_id
      AND created_at < NOW() - INTERVAL '1 hour';

    RETURN JSON_BUILD_OBJECT('allowed', true, 'remaining', p_limit - v_count - 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT ALL ON public.ai_rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_record_ai_rate_limit TO service_role, authenticated;
