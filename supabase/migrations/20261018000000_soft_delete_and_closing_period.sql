-- Migration: 20261018000000_soft_delete_and_closing_period.sql
-- 1. Soft Delete pada Penawaran: deleted_at, deleted_by, delete_reason
-- 2. Aturan RLS Ketat: Owner read-only (403 saat hapus), Admin hanya bisa soft delete penawaran miliknya dan belum deal
-- 3. Pembaruan fungsi statistik dasbor & follow-up (2 hari) agar tidak menghitung baris terhapus

-- 1. TAMBAH KOLOM SOFT DELETE
ALTER TABLE public.penawaran
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delete_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_penawaran_deleted_at ON public.penawaran(deleted_at);

-- 2. REVISI KEBIJAKAN RLS
-- Pastikan tidak ada izin HARD DELETE dari authenticated / anon
REVOKE DELETE ON public.penawaran FROM authenticated, anon;

-- Update RLS SELECT:
-- Admin hanya boleh melihat penawaran aktif (deleted_at IS NULL)
-- Owner boleh melihat semua termasuk yang dihapus untuk audit (filter status=dihapus)
DROP POLICY IF EXISTS "Penawaran select authenticated" ON public.penawaran;
CREATE POLICY "Penawaran select authenticated" ON public.penawaran
FOR SELECT TO authenticated
USING (
    (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'owner'))
    OR
    (deleted_at IS NULL)
);

-- Update RLS UPDATE:
-- Hanya Admin pembuat yang bisa mengupdate penawaran miliknya, dan statusnya belum deal/lunas
DROP POLICY IF EXISTS "Only admin can update penawaran" ON public.penawaran;
CREATE POLICY "Only admin can update penawaran" ON public.penawaran
FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'admin')
    AND created_by = auth.uid()
    AND status NOT IN ('deal', 'lunas')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'admin')
    AND created_by = auth.uid()
);

-- 3. PERBARUI FUNGSI STATISTIK DASBOR OWNER (Eksklusi deleted_at IS NOT NULL)
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
    v_rate_90h NUMERIC;
    v_proyeksi BIGINT;
    v_median_hari NUMERIC;
    v_top_alasan_batal JSON;
BEGIN
    -- 1. Penawaran Dibuat pada periode (non-deleted)
    SELECT COUNT(*), COALESCE(SUM(total_nilai), 0)
    INTO v_dibuat_count, v_dibuat_val
    FROM public.penawaran
    WHERE created_at >= p_start_date AND created_at <= p_end_date
      AND deleted_at IS NULL
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    -- 2. Penawaran Proses (terkirim atau nego)
    SELECT COUNT(*), COALESCE(SUM(total_nilai), 0)
    INTO v_proses_count, v_proses_val
    FROM public.penawaran
    WHERE status IN ('terkirim', 'nego')
      AND created_at >= p_start_date AND created_at <= p_end_date
      AND deleted_at IS NULL
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    -- 3. Penawaran Deal (deal atau lunas)
    SELECT COUNT(*), COALESCE(SUM(total_nilai), 0)
    INTO v_deal_count, v_deal_val
    FROM public.penawaran
    WHERE status IN ('deal', 'lunas')
      AND (deal_at >= p_start_date AND deal_at <= p_end_date OR (deal_at IS NULL AND created_at >= p_start_date AND created_at <= p_end_date))
      AND deleted_at IS NULL
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    -- 4. Penawaran Batal & Kadaluwarsa
    SELECT COUNT(*), COALESCE(SUM(total_nilai), 0)
    INTO v_batal_count, v_batal_val
    FROM public.penawaran
    WHERE status = 'batal'
      AND created_at >= p_start_date AND created_at <= p_end_date
      AND deleted_at IS NULL
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    SELECT COUNT(*)
    INTO v_kadaluwarsa_count
    FROM public.penawaran
    WHERE (status = 'kadaluwarsa' OR (status IN ('draf', 'terkirim', 'nego') AND valid_until < CURRENT_DATE))
      AND created_at >= p_start_date AND created_at <= p_end_date
      AND deleted_at IS NULL
      AND (p_kanal IS NULL OR kanal = p_kanal)
      AND (p_admin_id IS NULL OR created_by = p_admin_id);

    -- 5. Closing Rate Periode: deal / (deal + batal + kadaluwarsa)
    IF (v_deal_count + v_batal_count + v_kadaluwarsa_count) > 0 THEN
        v_closing_rate := ROUND((v_deal_count::NUMERIC / (v_deal_count + v_batal_count + v_kadaluwarsa_count)::NUMERIC) * 100, 1);
    ELSE
        v_closing_rate := 0.0;
    END IF;

    -- 6. Closing Rate 90 Hari Terakhir (Baseline Proyeksi)
    SELECT 
        CASE 
            WHEN (COUNT(*) FILTER (WHERE status IN ('deal', 'lunas')) + COUNT(*) FILTER (WHERE status = 'batal') + COUNT(*) FILTER (WHERE status = 'kadaluwarsa')) > 0
            THEN (COUNT(*) FILTER (WHERE status IN ('deal', 'lunas'))::NUMERIC / (COUNT(*) FILTER (WHERE status IN ('deal', 'lunas')) + COUNT(*) FILTER (WHERE status = 'batal') + COUNT(*) FILTER (WHERE status = 'kadaluwarsa'))::NUMERIC)
            ELSE 0.25 -- default benchmark jika data baru
        END
    INTO v_rate_90h
    FROM public.penawaran
    WHERE created_at >= NOW() - INTERVAL '90 days'
      AND deleted_at IS NULL;

    -- 7. Proyeksi Omzet Bulan Ini = nilai deal + (nilai proses * closing rate 90 hari)
    v_proyeksi := v_deal_val + ROUND(v_proses_val * v_rate_90h);

    -- 8. Median Hari Terkirim -> Deal
    SELECT COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (COALESCE(deal_at, updated_at) - COALESCE(terkirim_at, created_at))) / 86400
    ), 0)
    INTO v_median_hari
    FROM public.penawaran
    WHERE status IN ('deal', 'lunas')
      AND deal_at IS NOT NULL
      AND terkirim_at IS NOT NULL
      AND created_at >= p_start_date AND created_at <= p_end_date
      AND deleted_at IS NULL;

    -- 9. Top 3 Alasan Batal
    SELECT COALESCE(JSON_AGG(t), '[]'::JSON)
    INTO v_top_alasan_batal
    FROM (
        SELECT alasan_batal AS alasan, COUNT(*) AS jumlah
        FROM public.penawaran
        WHERE status = 'batal' AND alasan_batal IS NOT NULL
          AND created_at >= p_start_date AND created_at <= p_end_date
          AND deleted_at IS NULL
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
        'closing_rate_90h', ROUND(v_rate_90h * 100, 1),
        'proyeksi_omzet', v_proyeksi,
        'median_hari_deal', ROUND(v_median_hari, 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. PERBARUI FUNGSI DAFTAR PERLU FOLLOW-UP (Terkirim tanpa update > 2 hari)
CREATE OR REPLACE FUNCTION public.get_quotes_need_followup()
RETURNS TABLE (
    id UUID,
    nomor TEXT,
    nama_klien TEXT,
    kota TEXT,
    total_nilai BIGINT,
    status quote_status,
    hari_tanpa_perubahan INT,
    admin_nama TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.nomor,
        l.nama AS nama_klien,
        l.kota,
        p.total_nilai,
        p.status,
        (EXTRACT(EPOCH FROM (NOW() - p.updated_at)) / 86400)::INT AS hari_tanpa_perubahan,
        u.nama AS admin_nama
    FROM public.penawaran p
    JOIN public.leads l ON p.lead_id = l.id
    JOIN public.users u ON p.created_by = u.id
    WHERE p.status = 'terkirim'
      AND p.deleted_at IS NULL
      AND p.updated_at <= (NOW() - INTERVAL '2 days')
    ORDER BY p.total_nilai DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. PERBARUI FUNGSI GRAFIK TREN MINGGUAN (Eksklusi baris terhapus)
CREATE OR REPLACE FUNCTION public.get_weekly_quote_chart()
RETURNS JSON AS $$
DECLARE
    v_chart JSON;
BEGIN
    SELECT JSON_AGG(t ORDER BY t.minggu_ke ASC)
    INTO v_chart
    FROM (
        SELECT 
            to_char(date_trunc('week', d), 'DD Mon') AS label_minggu,
            date_trunc('week', d) AS minggu_ke,
            COUNT(p.id) AS total_penawaran,
            COUNT(p.id) FILTER (WHERE p.status IN ('deal', 'lunas')) AS total_deal
        FROM generate_series(date_trunc('week', NOW() - INTERVAL '7 weeks'), date_trunc('week', NOW()), '1 week'::interval) d
        LEFT JOIN public.penawaran p ON date_trunc('week', p.created_at) = d AND p.deleted_at IS NULL
        GROUP BY d
    ) t;

    RETURN COALESCE(v_chart, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
