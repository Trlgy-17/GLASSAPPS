-- Migration: 20261016000007_dashboard_filter_indexes.sql
-- Penambahan indeks performa untuk filter dasbor owner (status, created_at, kanal, admin_id / created_by)

CREATE INDEX IF NOT EXISTS idx_penawaran_kanal ON public.penawaran(kanal);
CREATE INDEX IF NOT EXISTS idx_penawaran_created_by ON public.penawaran(created_by);
CREATE INDEX IF NOT EXISTS idx_penawaran_filter_composite ON public.penawaran(created_at, status, kanal, created_by);
