-- =====================================================================
-- USULAN (BELUM DIJALANKAN) — perlu persetujuan owner sebelum diterapkan
-- Dibuat saat audit 18 Okt 2026.
--
-- Masalah: beberapa policy SELECT memakai USING (true) untuk role
-- "authenticated". Artinya SIAPA PUN yang punya akun Supabase Auth di
-- proyek ini (misalnya bila fitur "Allow new users to sign up" masih aktif)
-- bisa membaca data pelanggan (nama, kota, nomor WA) langsung lewat API
-- Supabase, tanpa melewati aplikasi.
--
-- Perbaikan: hanya pengguna yang terdaftar di public.users dengan peran
-- admin/owner yang boleh membaca. Perilaku aplikasi tidak berubah karena
-- server memakai service role.
--
-- Cara pakai: jalankan di Supabase SQL Editor (proyek produksi) SETELAH
-- dicoba di proyek tes, lalu jalankan `npm run test:security`.
-- Sekalian matikan sign-up publik: Authentication → Providers → Email →
-- "Allow new users to sign up" = OFF.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_staf()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND peran IN ('admin', 'owner')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staf() FROM public;
GRANT EXECUTE ON FUNCTION public.is_staf() TO authenticated;

DROP POLICY IF EXISTS "Users can view profile" ON public.users;
CREATE POLICY "Users can view profile" ON public.users
  FOR SELECT TO authenticated USING (public.is_staf());

DROP POLICY IF EXISTS "Leads select authenticated" ON public.leads;
CREATE POLICY "Leads select authenticated" ON public.leads
  FOR SELECT TO authenticated USING (public.is_staf());

DROP POLICY IF EXISTS "Penawaran select authenticated" ON public.penawaran;
CREATE POLICY "Penawaran select authenticated" ON public.penawaran
  FOR SELECT TO authenticated
  USING (
    public.is_staf() AND (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND peran = 'owner')
      OR deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Persetujuan select authenticated" ON public.persetujuan;
CREATE POLICY "Persetujuan select authenticated" ON public.persetujuan
  FOR SELECT TO authenticated USING (public.is_staf());

DROP POLICY IF EXISTS "Audit log select authenticated" ON public.audit_log;
CREATE POLICY "Audit log select authenticated" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_staf());

DROP POLICY IF EXISTS "Status log select authenticated" ON public.penawaran_status_log;
CREATE POLICY "Status log select authenticated" ON public.penawaran_status_log
  FOR SELECT TO authenticated USING (public.is_staf());

DROP POLICY IF EXISTS "Kartu memori select authenticated" ON public.kartu_memori;
CREATE POLICY "Kartu memori select authenticated" ON public.kartu_memori
  FOR SELECT TO authenticated USING (public.is_staf());

DROP POLICY IF EXISTS "AI log select authenticated" ON public.ai_log;
CREATE POLICY "AI log select authenticated" ON public.ai_log
  FOR SELECT TO authenticated USING (public.is_staf());

DROP POLICY IF EXISTS settings_select_policy ON public.settings;
CREATE POLICY settings_select_policy ON public.settings
  FOR SELECT TO authenticated USING (public.is_staf());

COMMIT;
