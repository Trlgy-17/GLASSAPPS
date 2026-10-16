-- Migration: Fase 1 Schema & Security Policies (Putra Glass)
-- Concurrency-safe monthly counter, strict RLS, zero free discount, integer mm size

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE client_segment AS ENUM ('B2C', 'B2B');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('menunggu', 'disetujui', 'ditolak');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE quote_status AS ENUM ('draf', 'menunggu_persetujuan', 'aktif', 'kadaluwarsa', 'deal_dp', 'dibatalkan');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. USERS
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    peran user_role NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: Setiap pendaftaran di auth.users otomatis masuk ke public.users peran 'admin'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, nama, email, peran)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nama', split_part(NEW.email, '@', 1)),
        NEW.email,
        'admin'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. PRICE BOOKS (Buku Harga Berversi, Immutable)
CREATE TABLE IF NOT EXISTS public.price_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    versi INTEGER NOT NULL UNIQUE,
    aktif BOOLEAN NOT NULL DEFAULT FALSE,
    data_json JSONB NOT NULL,
    dibuat_oleh UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_books_single_active ON public.price_books (aktif) WHERE aktif = TRUE;

-- Fungsi transaksi aktivasi versi buku harga (matikan aktif lama + nyalakan baru)
CREATE OR REPLACE FUNCTION public.activate_price_book(p_versi INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.price_books SET aktif = FALSE WHERE aktif = TRUE;
    UPDATE public.price_books SET aktif = TRUE WHERE versi = p_versi;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Price book version % not found', p_versi;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. LEADS
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id TEXT NOT NULL DEFAULT 'putraglass',
    nama TEXT NOT NULL,
    no_wa TEXT,
    kota TEXT,
    zona TEXT DEFAULT 'luar_kota',
    sumber TEXT DEFAULT 'whatsapp',
    segmen client_segment NOT NULL DEFAULT 'B2C',
    status TEXT DEFAULT 'baru',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_leads_zona CHECK (zona IN ('dalam_kota', 'luar_kota'))
);

-- 5. COUNTER NOMOR PENAWARAN (PG-Q-YYMM-0001 Concurrency Safe di Asia/Jakarta)
CREATE TABLE IF NOT EXISTS public.penawaran_counters (
    year_month TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.generate_nomor_penawaran()
RETURNS TEXT AS $$
DECLARE
    v_ym TEXT := to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYMM');
    v_seq INTEGER;
BEGIN
    INSERT INTO public.penawaran_counters (year_month, last_seq)
    VALUES (v_ym, 1)
    ON CONFLICT (year_month)
    DO UPDATE SET last_seq = public.penawaran_counters.last_seq + 1
    RETURNING last_seq INTO v_seq;

    RETURN 'PG-Q-' || v_ym || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. PENAWARAN (Ukuran mm integer, tanpa diskon bebas)
CREATE TABLE IF NOT EXISTS public.penawaran (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor TEXT NOT NULL UNIQUE,
    lead_id UUID NOT NULL REFERENCES public.leads(id),
    price_book_id UUID NOT NULL REFERENCES public.price_books(id),
    items_json JSONB NOT NULL,
    ringkasan_json JSONB NOT NULL,
    status quote_status NOT NULL DEFAULT 'draf',
    valid_until DATE NOT NULL,
    pdf_path TEXT,
    revisi_dari UUID REFERENCES public.penawaran(id),
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_penawaran_lead_id ON public.penawaran(lead_id);

-- 7. PERSETUJUAN (Server Validated Approvals)
CREATE TABLE IF NOT EXISTS public.persetujuan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penawaran_id UUID NOT NULL REFERENCES public.penawaran(id) ON DELETE CASCADE,
    jenis TEXT NOT NULL,
    nilai_diminta INTEGER NOT NULL,
    nilai_disetujui INTEGER,
    alasan TEXT NOT NULL,
    status approval_status NOT NULL DEFAULT 'menunggu',
    diajukan_oleh UUID NOT NULL REFERENCES public.users(id),
    diputuskan_oleh UUID REFERENCES public.users(id),
    catatan_owner TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_persetujuan_jenis CHECK (jenis IN ('harga_cermin', 'ongkir', 'pasang', 'spesifikasi_khusus'))
);
CREATE INDEX IF NOT EXISTS idx_persetujuan_penawaran_status ON public.persetujuan(penawaran_id, status);

-- 8. AUDIT LOG (Append-only Ledger)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aktor UUID NOT NULL REFERENCES public.users(id),
    aksi TEXT NOT NULL,
    objek TEXT NOT NULL,
    sebelum JSONB,
    sesudah JSONB,
    alasan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger anti-mutasi audit_log (mencegah UPDATE & DELETE bahkan dari service_role)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: UPDATE and DELETE are strictly prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.audit_log;
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- 9. STORAGE BUCKET PRIVAT UNTUK PDF PENAWARAN
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('penawaran-pdf', 'penawaran-pdf', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 10. ROW LEVEL SECURITY & POLICIES KETAT
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penawaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persetujuan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users: hanya SELECT data profil
DROP POLICY IF EXISTS "Users can view profile" ON public.users;
CREATE POLICY "Users can view profile" ON public.users FOR SELECT TO authenticated USING (true);

-- Price Books: TIDAK ADA SELECT untuk authenticated (hanya via service role API)
DROP POLICY IF EXISTS "Price books select authenticated" ON public.price_books;
DROP POLICY IF EXISTS "Only owner insert price books" ON public.price_books;
CREATE POLICY "Only owner insert price books" ON public.price_books FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'owner'));

-- Leads: SELECT authenticated, write via API route
DROP POLICY IF EXISTS "Leads select authenticated" ON public.leads;
CREATE POLICY "Leads select authenticated" ON public.leads FOR SELECT TO authenticated USING (true);

-- Penawaran: Client hanya SELECT. Write via Service Role di API
DROP POLICY IF EXISTS "Penawaran select authenticated" ON public.penawaran;
CREATE POLICY "Penawaran select authenticated" ON public.penawaran FOR SELECT TO authenticated USING (true);

-- Persetujuan: SELECT authenticated
-- INSERT: status harus 'menunggu', diajukan_oleh = auth.uid(), nilai_disetujui & diputuskan_oleh IS NULL
-- UPDATE: hanya oleh owner, dan diputuskan_oleh = auth.uid()
DROP POLICY IF EXISTS "Persetujuan select authenticated" ON public.persetujuan;
CREATE POLICY "Persetujuan select authenticated" ON public.persetujuan FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin can insert pending approval" ON public.persetujuan;
CREATE POLICY "Admin can insert pending approval" ON public.persetujuan FOR INSERT TO authenticated
WITH CHECK (
    status = 'menunggu' AND 
    diajukan_oleh = auth.uid() AND 
    nilai_disetujui IS NULL AND 
    diputuskan_oleh IS NULL
);

DROP POLICY IF EXISTS "Only owner can update approval" ON public.persetujuan;
CREATE POLICY "Only owner can update approval" ON public.persetujuan FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'owner'))
WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'owner') AND 
    diputuskan_oleh = auth.uid()
);

-- Audit Log: Hanya INSERT via service role (tidak ada policy insert untuk authenticated)
DROP POLICY IF EXISTS "Audit log select authenticated" ON public.audit_log;
CREATE POLICY "Audit log select authenticated" ON public.audit_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Audit log insert authenticated" ON public.audit_log;
DROP POLICY IF EXISTS "Audit log no update" ON public.audit_log;
DROP POLICY IF EXISTS "Audit log no delete" ON public.audit_log;

-- 11. HAK AKSES ROLE & GRANTS EKSPLISIT
-- Cabut akses bawaan dari anon & authenticated
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- anon: tidak ada akses ke tabel atau fungsi apa pun

-- authenticated:
-- Hanya SELECT pada users, leads, penawaran, persetujuan
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.leads TO authenticated;
GRANT SELECT ON public.penawaran TO authenticated;
GRANT SELECT ON public.persetujuan TO authenticated;

-- INSERT dan UPDATE hanya pada persetujuan (tetap dikunci policy RLS di atas)
GRANT INSERT, UPDATE ON public.persetujuan TO authenticated;

-- price_books, audit_log, penawaran_counters: TIDAK ADA GRANT untuk authenticated

-- service_role: ALL pada seluruh tabel, sequence, dan fungsi
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_nomor_penawaran() TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_price_book(INTEGER) TO service_role;
