-- Migration: Tabel & fungsi counter nomor penawaran khusus data pengujian
CREATE TABLE IF NOT EXISTS public.penawaran_test_counters (
    year_month TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.generate_nomor_penawaran_test()
RETURNS TEXT AS $$
DECLARE
    v_ym TEXT := to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYMM');
    v_seq INTEGER;
BEGIN
    INSERT INTO public.penawaran_test_counters (year_month, last_seq)
    VALUES (v_ym, 1)
    ON CONFLICT (year_month)
    DO UPDATE SET last_seq = public.penawaran_test_counters.last_seq + 1
    RETURNING last_seq INTO v_seq;

    RETURN 'TES-' || v_ym || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_nomor_penawaran_test() TO service_role;
