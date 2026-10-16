-- Migration: 20261016000004_fase2_ai_memory_and_logs.sql
-- 1. Ekstensi Vector (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabel Kartu Memori (Vector embedding 3072 dimensi dari gemini-embedding-001)
CREATE TABLE IF NOT EXISTS public.kartu_memori (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    ringkasan TEXT NOT NULL,
    keberatan TEXT[] NOT NULL DEFAULT '{}',
    tahap TEXT NOT NULL,
    langkah_admin TEXT,
    hasil TEXT NOT NULL DEFAULT 'belum_ada',
    alasan_gagal TEXT,
    balasan_final TEXT NOT NULL,
    embedding vector(3072),
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kartu_memori_aktif ON public.kartu_memori(aktif);
CREATE INDEX IF NOT EXISTS idx_kartu_memori_hasil ON public.kartu_memori(hasil);

-- 3. Fungsi Pencarian Kemiripan Vektor Memori (Cosine Similarity)
CREATE OR REPLACE FUNCTION public.match_kartu_memori (
    query_embedding vector(3072),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id UUID,
    ringkasan TEXT,
    keberatan TEXT[],
    tahap TEXT,
    langkah_admin TEXT,
    hasil TEXT,
    balasan_final TEXT,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        km.id,
        km.ringkasan,
        km.keberatan,
        km.tahap,
        km.langkah_admin,
        km.hasil,
        km.balasan_final,
        (1 - (km.embedding <=> query_embedding))::float AS similarity
    FROM public.kartu_memori km
    WHERE km.aktif = true 
      AND km.embedding IS NOT NULL
      AND (1 - (km.embedding <=> query_embedding)) > match_threshold
    ORDER BY (1 - (km.embedding <=> query_embedding)) DESC
    LIMIT match_count;
END;
$$;

-- 4. Tabel AI Log (Audit token, latensi, dan biaya tanpa isi chat)
CREATE TABLE IF NOT EXISTS public.ai_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    token_in INT DEFAULT 0,
    token_out INT DEFAULT 0,
    durasi_ms INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_log_created_at ON public.ai_log(created_at);

-- 5. Bucket Storage Private untuk Screenshot Chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-screenshots', 'chat-screenshots', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 6. Row Level Security & Policies
ALTER TABLE public.kartu_memori ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_log ENABLE ROW LEVEL SECURITY;

-- Kartu Memori: authenticated boleh SELECT; hanya admin yang boleh INSERT / UPDATE
DROP POLICY IF EXISTS "Kartu memori select authenticated" ON public.kartu_memori;
CREATE POLICY "Kartu memori select authenticated" ON public.kartu_memori FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only admin insert kartu memori" ON public.kartu_memori;
CREATE POLICY "Only admin insert kartu memori" ON public.kartu_memori FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'admin'));

DROP POLICY IF EXISTS "Only admin update kartu memori" ON public.kartu_memori;
CREATE POLICY "Only admin update kartu memori" ON public.kartu_memori FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'admin'));

-- AI Log: authenticated boleh SELECT (misal owner lihat pemakaian); INSERT hanya via service_role; UPDATE/DELETE dilarang
DROP POLICY IF EXISTS "AI log select authenticated" ON public.ai_log;
CREATE POLICY "AI log select authenticated" ON public.ai_log FOR SELECT TO authenticated USING (true);

-- 7. Grants
GRANT SELECT, INSERT, UPDATE ON public.kartu_memori TO authenticated;
GRANT SELECT ON public.ai_log TO authenticated;
GRANT ALL ON public.kartu_memori, public.ai_log TO service_role;
GRANT EXECUTE ON FUNCTION public.match_kartu_memori TO authenticated, service_role;
