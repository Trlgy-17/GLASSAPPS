import '../../scripts/patch-dns.js';
import fs from 'fs';
import path from 'path';
import { Page, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Muat .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  });
}

if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD || !process.env.TEST_OWNER_EMAIL || !process.env.TEST_OWNER_PASSWORD) {
  throw new Error('TEST_ADMIN_* atau TEST_OWNER_* belum diisi di .env.local');
}

export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
export const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL;
export const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD;

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let _serviceClient: SupabaseClient | null = null;
export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return _serviceClient;
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/balas', { timeout: 15000 });
}

export async function loginAsOwner(page: Page) {
  await page.goto('/login');
  await page.fill('#email', OWNER_EMAIL);
  await page.fill('#password', OWNER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dasbor', { timeout: 15000 });
}

export async function getAuthToken(email: string, pass: string): Promise<string> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error || !data.session) {
    throw new Error(`Gagal login untuk ${email}: ${error?.message}`);
  }
  return data.session.access_token;
}

/**
 * Bersihkan seluruh data uji (penawaran, leads, kartu_memori, ai_log, audit_log)
 * agar database produksi selalu bersih setelah pengujian selesai.
 */
export async function cleanupAllTestData() {
  const service = getServiceClient();

  // 1. Cari semua leads yang merupakan data uji
  const { data: testLeads } = await service
    .from('leads')
    .select('id, nama, kota');

  const testLeadIds = (testLeads || [])
    .filter((l) => {
      const nama = String(l.nama || '');
      const kota = String(l.kota || '');
      return (
        nama.startsWith('[TES]') ||
        /test|uji|sukamaju|kak rina|paralel|double click|sesi lama|budi|dewi|klien putra glass|klien chat/i.test(nama) ||
        /sukamaju/i.test(kota)
      );
    })
    .map((l) => l.id);

  // 2. Cari semua penawaran yang terkait lead uji atau nomor uji
  const { data: allQuotes } = await service
    .from('penawaran')
    .select('id, nomor, lead_id, ringkasan_json');

  const testQuoteIds = (allQuotes || [])
    .filter((q) => {
      const r = (q.ringkasan_json || {}) as Record<string, unknown>;
      return (
        testLeadIds.includes(q.lead_id) ||
        r.is_test === true ||
        String(q.nomor || '').includes('TEST') ||
        /sukamaju/i.test(String(r.kota_klien || ''))
      );
    })
    .map((q) => q.id);

  if (testQuoteIds.length > 0) {
    await service.from('penawaran_status_log').delete().in('penawaran_id', testQuoteIds);
    await service.from('persetujuan').delete().in('penawaran_id', testQuoteIds);
    await service.from('penawaran').delete().in('id', testQuoteIds);
  }

  if (testLeadIds.length > 0) {
    await service.from('kartu_memori').delete().in('lead_id', testLeadIds);
    await service.from('leads').delete().in('id', testLeadIds);
  }

  // 3. Bersihkan kartu_memori & audit_log & ai_log yang dibuat saat pengujian
  await service.from('kartu_memori').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await service.from('audit_log').delete().ilike('alasan', '%test%');
  await service.from('audit_log').delete().ilike('alasan', '%uji%');
  await service.from('audit_log').delete().ilike('alasan', '%bagi dua%');
  await service.from('ai_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
