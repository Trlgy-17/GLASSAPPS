-- Migration: Tabel Settings untuk data kontak workshop, rekening, dan medsos resmi
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'general',
    alamat_workshop TEXT NOT NULL,
    maps_url TEXT NOT NULL,
    bank TEXT NOT NULL,
    no_rekening TEXT NOT NULL,
    nama_rekening TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    instagram TEXT NOT NULL,
    tiktok TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS settings_select_policy ON public.settings;
DROP POLICY IF EXISTS settings_admin_modify_policy ON public.settings;

-- Policy: Authenticated users (admin & owner) dapat membaca settings
CREATE POLICY settings_select_policy ON public.settings
    FOR SELECT TO authenticated
    USING (true);

-- Policy: Hanya ADMIN yang dapat mengubah settings
CREATE POLICY settings_admin_modify_policy ON public.settings
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND peran = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND peran = 'admin'
        )
    );

-- Grant permissions ke authenticated dan service_role
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;

-- Seed data awal
INSERT INTO public.settings (
    id,
    alamat_workshop,
    maps_url,
    bank,
    no_rekening,
    nama_rekening,
    whatsapp,
    instagram,
    tiktok
) VALUES (
    'general',
    'Jalan Nasional III, RT.3/RW.4, Citatah, Kec. Cipatat, Kabupaten Bandung Barat, Jawa Barat 40554',
    'https://maps.app.goo.gl/EfXTbzY7PCQ4TPUn6',
    'BCA',
    '2782484011',
    'Septiani Sitrulroaeni',
    '+62 812-3753-3173',
    'putraglass.id',
    'putraglass_'
) ON CONFLICT (id) DO UPDATE SET
    alamat_workshop = EXCLUDED.alamat_workshop,
    maps_url = EXCLUDED.maps_url,
    bank = EXCLUDED.bank,
    no_rekening = EXCLUDED.no_rekening,
    nama_rekening = EXCLUDED.nama_rekening,
    whatsapp = EXCLUDED.whatsapp,
    instagram = EXCLUDED.instagram,
    tiktok = EXCLUDED.tiktok;
