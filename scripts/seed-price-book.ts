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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function seed() {
  console.log('Seeding Buku Harga Versi 1 ke Supabase Dev...');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Ambil user owner untuk field dibuat_oleh
  const { data: ownerUser } = await supabase
    .from('users')
    .select('id')
    .eq('peran', 'owner')
    .limit(1)
    .single();

  const ownerId = ownerUser?.id || '00000000-0000-0000-0000-000000000001';

  // Cek apakah versi 1 sudah ada
  const { data: existing } = await supabase
    .from('price_books')
    .select('id, versi')
    .eq('versi', 1)
    .single();

  if (existing) {
    console.log('Versi 1 sudah ada. Memperbarui data_json...');
    const { error: upErr } = await supabase
      .from('price_books')
      .update({
        data_json: defaultPriceBookV1,
        dibuat_oleh: ownerId,
      })
      .eq('versi', 1);
    if (upErr) throw upErr;
  } else {
    console.log('Menambahkan baris Buku Harga Versi 1...');
    const { error: insErr } = await supabase.from('price_books').insert({
      versi: 1,
      aktif: false,
      data_json: defaultPriceBookV1,
      dibuat_oleh: ownerId,
    });
    if (insErr) throw insErr;
  }

  // Aktifkan versi 1 menggunakan fungsi database activate_price_book(1)
  console.log('Mengaktifkan Buku Harga Versi 1 via RPC activate_price_book(1)...');
  const { error: rpcErr } = await supabase.rpc('activate_price_book', { p_versi: 1 });
  if (rpcErr) throw rpcErr;

  console.log('✅ Berhasil: Buku Harga Versi 1 telah aktif di Supabase Dev!');
}

seed().catch((err) => {
  console.error('Gagal seed:', err);
  process.exit(1);
});
