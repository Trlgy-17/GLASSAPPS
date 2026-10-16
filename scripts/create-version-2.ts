import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { defaultPriceBookV1 } from '../src/lib/pricing/default-price-book';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ownerEmail = process.env.TEST_OWNER_EMAIL!;
const ownerPassword = process.env.TEST_OWNER_PASSWORD!;

async function main() {
  console.log('Login sebagai owner untuk membuat Buku Harga Versi 2...');
  const supabase = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: ownerEmail,
    password: ownerPassword,
  });

  if (authErr || !authData.session) {
    console.error('Gagal login owner:', authErr?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;

  // Data buku harga versi 2:
  // - kirim_luar_kota: list 1.300.000 | batas_admin 1.150.000 | batas_owner 650.000
  // - kirim_bandung: list 750.000 | batas_admin 500.000 | batas_owner 375.000
  // - kebijakan_ongkir_50 = "Ongkir bisa dibagi dua (klien bayar minimal 50%) hanya dengan konfirmasi owner. Jangan ditawarkan sendiri; isi perlu_owner jika klien meminta."
  const v2Data = {
    ...defaultPriceBookV1,
    versi: 2,
    logistik: {
      ...defaultPriceBookV1.logistik,
      kirim_bandung: {
        list: 750_000,
        batas_admin: 500_000,
        batas_owner: 375_000,
      },
      kirim_luar_kota: {
        list: 1_300_000,
        batas_admin: 1_150_000,
        batas_owner: 650_000,
        skema_50_aktif: true,
      },
    },
    dokumen_pdf: {
      ...defaultPriceBookV1.dokumen_pdf,
      kebijakan_ongkir_50:
        'Ongkir bisa dibagi dua (klien bayar minimal 50%) hanya dengan konfirmasi owner. Jangan ditawarkan sendiri; isi perlu_owner jika klien meminta.',
    },
  };

  console.log('Mengirim POST /api/buku-harga via API owner...');
  const res = await fetch('http://localhost:3000/api/buku-harga', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data_json: v2Data,
      aktifkan_sekarang: true,
      catatan_perubahan: 'Aturan ongkir baru: ongkir maksimal dibagi 2 (50%) dengan konfirmasi owner',
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error('Gagal membuat versi 2:', json);
    process.exit(1);
  }

  console.log('✅ Berhasil membuat dan mengaktifkan Buku Harga Versi 2!');
  console.log('Versi baru:', json.price_book.versi, '| Aktif:', json.price_book.aktif);
}

main().catch(console.error);
