-- Migration: 20261016000002_owner_readonly_and_status_flow.sql
-- 1. Owner Read-Only: Hak kelola buku harga dan penawaran dialihkan ke Admin.
-- 2. Status Penawaran Lengkap: draf -> terkirim -> nego -> deal -> lunas / batal / kadaluwarsa.
-- 3. Kolom baru pada penawaran: kanal, deal_at, terkirim_at, alasan_batal, total_nilai.
-- 4. Tabel audit riwayat status: penawaran_status_log.
-- 5. Fungsi SQL agregasi dasbor owner (dihitung di database, bukan di browser).

-- =========================================================================
-- 1. PEMBARUAN ENUM STATUS PENAWARAN
-- =========================================================================
DO $$ BEGIN
    ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'terkirim';
    ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'nego';
    ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'deal';
    ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'lunas';
    ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'batal';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =========================================================================
-- 2. KOLOM BARU PADA TABEL PENAWARAN
-- =========================================================================
ALTER TABLE public.penawaran 
ADD COLUMN IF NOT EXISTS kanal TEXT DEFAULT 'whatsapp' CHECK (kanal IN ('whatsapp', 'instagram', 'tiktok', 'shopee')),
ADD COLUMN IF NOT EXISTS deal_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terkirim_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS alasan_batal TEXT CHECK (alasan_batal IS NULL OR alasan_batal IN ('harga', 'ongkir', 'lokasi', 'waktu produksi', 'menghilang', 'pilih toko lain', 'lainnya')),
ADD COLUMN IF NOT EXISTS total_nilai BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_penawaran_status ON public.penawaran(status);
CREATE INDEX IF NOT EXISTS idx_penawaran_created_at ON public.penawaran(created_at);
CREATE INDEX IF NOT EXISTS idx_penawaran_deal_at ON public.penawaran(deal_at);

-- Trigger untuk sinkronisasi total_nilai dari ringkasan_json jika belum diisi
CREATE OR REPLACE FUNCTION public.sync_penawaran_total_nilai()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_nilai = 0 AND NEW.ringkasan_json ? 'total' THEN
        NEW.total_nilai := COALESCE((NEW.ringkasan_json->>'total')::BIGINT, 0);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_penawaran_total ON public.penawaran;
CREATE TRIGGER trg_sync_penawaran_total
BEFORE INSERT OR UPDATE ON public.penawaran
FOR EACH ROW EXECUTE FUNCTION public.sync_penawaran_total_nilai();

-- =========================================================================
-- 3. TABEL PENAWARAN_STATUS_LOG (Audit Perubahan Status)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.penawaran_status_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penawaran_id UUID NOT NULL REFERENCES public.penawaran(id) ON DELETE CASCADE,
    dari TEXT NOT NULL,
    ke TEXT NOT NULL,
    alasan TEXT,
    oleh UUID NOT NULL REFERENCES public.users(id),
    waktu TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_log_penawaran ON public.penawaran_status_log(penawaran_id);
CREATE INDEX IF NOT EXISTS idx_status_log_waktu ON public.penawaran_status_log(waktu);

-- =========================================================================
-- 4. RLS & GRANTS: OWNER READ-ONLY, ADMIN OPERASIONAL PENUH
-- =========================================================================
ALTER TABLE public.penawaran_status_log ENABLE ROW LEVEL SECURITY;

-- Penawaran: Admin boleh INSERT/UPDATE, Owner HANYA BACA (SELECT)
DROP POLICY IF EXISTS "Only admin can insert penawaran" ON public.penawaran;
CREATE POLICY "Only admin can insert penawaran" ON public.penawaran FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'admin'));

DROP POLICY IF EXISTS "Only admin can update penawaran" ON public.penawaran;
CREATE POLICY "Only admin can update penawaran" ON public.penawaran FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'admin'));

-- Price Books: Admin yang boleh INSERT versi baru (Owner memantau)
DROP POLICY IF EXISTS "Only owner insert price books" ON public.price_books;
DROP POLICY IF EXISTS "Only admin insert price books" ON public.price_books;
CREATE POLICY "Only admin insert price books" ON public.price_books FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'admin'));

-- Status Log: Boleh dibaca authenticated, hanya admin yang boleh mencatat status
DROP POLICY IF EXISTS "Status log select authenticated" ON public.penawaran_status_log;
CREATE POLICY "Status log select authenticated" ON public.penawaran_status_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only admin insert status log" ON public.penawaran_status_log;
CREATE POLICY "Only admin insert status log" ON public.penawaran_status_log FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'admin'));

-- Grants eksplisit
GRANT SELECT, INSERT ON public.penawaran_status_log TO authenticated;
GRANT ALL ON public.penawaran_status_log TO service_role;

-- =========================================================================
-- 5. FUNGSI SQL ANALITIK DASBOR OWNER (Dihitung di Database)
-- =========================================================================

-- A. Fungsi Statistik Utama & Proyeksi Omzet
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
    WHERE created_at >= NOW() - INTERVAL '90 days';

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
      AND created_at >= p_start_date AND created_at <= p_end_date;

    -- 9. Top 3 Alasan Batal
    SELECT COALESCE(JSON_AGG(t), '[]'::JSON)
    INTO v_top_alasan_batal
    FROM (
        SELECT alasan_batal AS alasan, COUNT(*) AS jumlah
        FROM public.penawaran
        WHERE status = 'batal' AND alasan_batal IS NOT NULL
          AND created_at >= p_start_date AND created_at <= p_end_date
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

-- B. Fungsi Daftar Perlu Follow-Up (Terkirim/Nego tanpa update >= 3 hari, urut nilai DESC)
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
    WHERE p.status IN ('terkirim', 'nego')
      AND p.updated_at <= (NOW() - INTERVAL '3 days')
    ORDER BY p.total_nilai DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- C. Fungsi Grafik Tren Mingguan (8 Minggu Terakhir)
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
        LEFT JOIN public.penawaran p ON date_trunc('week', p.created_at) = d
        GROUP BY d
    ) t;

    RETURN COALESCE(v_chart, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Hak eksekusi fungsi analitik diberikan ke authenticated dan service_role
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_summary TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_quotes_need_followup TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_weekly_quote_chart TO authenticated, service_role;
