-- Migration: 20261016000003_dashboard_closing_rate_and_nulls.sql
-- Perbaikan kalkulasi analitik dasbor owner:
-- 1. Tanpa default 25% pada closing rate 90 hari.
-- 2. Jika penawaran selesai (deal + batal + kadaluwarsa) dalam 90 hari < 10:
--    closing_rate_90h = NULL, proyeksi omzet = nilai deal bulan ini saja.
-- 3. Closing rate periode = NULL jika tidak ada penawaran selesai pada periode.
-- 4. Median hari deal = NULL jika tidak ada deal pada periode.

CREATE OR REPLACE FUNCTION public.get_owner_dashboard_summary(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_kanal TEXT DEFAULT NULL,
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_dibuat_count INT;
    v_dibuat_val BIGINT;
    v_proses_count INT;
    v_proses_val BIGINT;
    v_deal_count INT;
    v_deal_val BIGINT;
    v_batal_count INT;
    v_batal_val BIGINT;
    v_kadaluwarsa_count INT;
    v_closing_rate NUMERIC;
    v_selesai_90h INT;
    v_rate_90h NUMERIC;
    v_proyeksi BIGINT;
    v_median_hari NUMERIC;
    v_top_alasan_batal JSON;
BEGIN
    -- 1. Penawaran Dibuat pada periode
    SELECT COUNT(*), COALESCE(SUM(total_nilai), 0)
    INTO v_dibuat_count, v_dibuat_val
    FROM public.penawaran
    WHERE created_at >= p_start_date AND created_at <= p_end_date
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    -- 2. Penawaran Proses (terkirim atau nego)
    SELECT COUNT(*), COALESCE(SUM(total_nilai), 0)
    INTO v_proses_count, v_proses_val
    FROM public.penawaran
    WHERE status IN ('terkirim', 'nego')
      AND created_at >= p_start_date AND created_at <= p_end_date
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    -- 3. Penawaran Deal (deal atau lunas)
    SELECT COUNT(*), COALESCE(SUM(total_nilai), 0)
    INTO v_deal_count, v_deal_val
    FROM public.penawaran
    WHERE status IN ('deal', 'lunas')
      AND (deal_at >= p_start_date AND deal_at <= p_end_date OR (deal_at IS NULL AND created_at >= p_start_date AND created_at <= p_end_date))
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    -- 4. Penawaran Batal & Kadaluwarsa
    SELECT COUNT(*), COALESCE(SUM(total_nilai), 0)
    INTO v_batal_count, v_batal_val
    FROM public.penawaran
    WHERE status = 'batal'
      AND created_at >= p_start_date AND created_at <= p_end_date
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    SELECT COUNT(*)
    INTO v_kadaluwarsa_count
    FROM public.penawaran
    WHERE (status = 'kadaluwarsa' OR (status IN ('draf', 'terkirim', 'nego') AND valid_until < CURRENT_DATE))
      AND created_at >= p_start_date AND created_at <= p_end_date
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    -- 5. Closing Rate Periode: deal / (deal + batal + kadaluwarsa)
    IF (v_deal_count + v_batal_count + v_kadaluwarsa_count) > 0 THEN
        v_closing_rate := ROUND((v_deal_count::NUMERIC / (v_deal_count + v_batal_count + v_kadaluwarsa_count)::NUMERIC) * 100, 1);
    ELSE
        v_closing_rate := NULL;
    END IF;

    -- 6. Baseline Proyeksi: Penawaran selesai dalam 90 hari terakhir
    SELECT 
        COUNT(*) FILTER (WHERE status IN ('deal', 'lunas', 'batal', 'kadaluwarsa'))
    INTO v_selesai_90h
    FROM public.penawaran
    WHERE created_at >= NOW() - INTERVAL '90 days'
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    -- JANGAN pakai angka default (25%). Jika selesai < 10, tampilkan NULL dan proyeksi = nilai deal saja
    IF v_selesai_90h >= 10 THEN
        SELECT (COUNT(*) FILTER (WHERE status IN ('deal', 'lunas'))::NUMERIC / v_selesai_90h::NUMERIC)
        INTO v_rate_90h
        FROM public.penawaran
        WHERE created_at >= NOW() - INTERVAL '90 days'
          AND (p_kanal IS NULL OR kanal = p_kanal)
          AND (p_admin_id IS NULL OR created_by = p_admin_id);

        v_proyeksi := v_deal_val + ROUND(v_proses_val * v_rate_90h);
    ELSE
        v_rate_90h := NULL;
        v_proyeksi := v_deal_val; -- Nilai deal bulan ini saja
    END IF;

    -- 7. Median Hari Terkirim -> Deal (NULL jika tidak ada data)
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (COALESCE(deal_at, updated_at) - COALESCE(terkirim_at, created_at))) / 86400
    )
    INTO v_median_hari
    FROM public.penawaran
    WHERE status IN ('deal', 'lunas')
      AND deal_at IS NOT NULL
      AND terkirim_at IS NOT NULL
      AND created_at >= p_start_date AND created_at <= p_end_date
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    -- 8. Top 3 Alasan Batal
    SELECT COALESCE(JSON_AGG(t), '[]'::JSON)
    INTO v_top_alasan_batal
    FROM (
        SELECT alasan_batal AS alasan, COUNT(*) AS jumlah
        FROM public.penawaran
        WHERE status = 'batal' AND alasan_batal IS NOT NULL
          AND created_at >= p_start_date AND created_at <= p_end_date
          AND (p_kanal IS NULL OR kanal = p_kanal)
          AND (p_admin_id IS NULL OR created_by = p_admin_id)
        GROUP BY alasan_batal
        ORDER BY jumlah DESC
        LIMIT 3
    ) t;

    RETURN JSON_BUILD_OBJECT(
        'dibuat', JSON_BUILD_OBJECT('jumlah', v_dibuat_count, 'nilai', v_dibuat_val),
        'proses', JSON_BUILD_OBJECT('jumlah', v_proses_count, 'nilai', v_proses_val),
        'deal', JSON_BUILD_OBJECT('jumlah', v_deal_count, 'nilai', v_deal_val),
        'batal', JSON_BUILD_OBJECT('jumlah', v_batal_count, 'nilai', v_batal_val, 'top_alasan', v_top_alasan_batal),
        'closing_rate', v_closing_rate,
        'selesai_90h', v_selesai_90h,
        'closing_rate_90h', CASE WHEN v_rate_90h IS NOT NULL THEN ROUND(v_rate_90h * 100, 1) ELSE NULL END,
        'proyeksi_omzet', v_proyeksi,
        'median_hari_deal', CASE WHEN v_median_hari IS NOT NULL THEN ROUND(v_median_hari, 1) ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
