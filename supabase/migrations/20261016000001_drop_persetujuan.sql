-- Migration: Drop tabel persetujuan, policies, and grants
-- Alur persetujuan in-app dihapus (Owner dan Admin satu kantor).
-- Validasi diskon di bawah batas admin digantikan dengan konfirmasi owner langsung + alasan wajib yang dicatat di audit_log.

-- 1. Hapus tabel persetujuan beserta seluruh constraint dan indeks terkait
DROP TABLE IF EXISTS public.persetujuan CASCADE;

-- 2. Pastikan tidak ada hak akses tertinggal
-- (Tabel di-drop, seluruh policy RLS dan grant otomatis terhapus)
