import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

async function main() {
  console.log('Menjalankan pengujian nyata via /api/balas/proses...');

  // Uji Kasus 1 Nyata: Permintaan Custom Cermin 60x80 ke Surabaya
  const sampleChat1 = 'Halo Kak, mau tanya cermin custom ukuran 60x80 cm kirim ke Surabaya berapa ya? Mau pakai sensor tangan dan baterai plus antifog.';
  const t0 = Date.now();
  const res1 = await fetch('http://localhost:3000/api/balas/proses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshots: [],
      pasted_text: sampleChat1,
      override_kanal: 'whatsapp',
    }),
  });

  const d1 = Date.now() - t0;
  const json1 = await res1.json();
  console.log(`✓ Kasus 1 selesai dalam ${d1} ms (Model: ${json1.model_used}, Fallback: ${json1.is_fallback})`);
  console.log('  Rincian durasi:', json1.durasi);

  // Uji Kasus 2 Nyata: Pertanyaan SKU Katalog Oval 40x60
  const sampleChat2 = 'Kak cermin oval 40x60 sandblast yang touchscreen colokan ready gak? Kirim ke Bandung.';
  const t1 = Date.now();
  const res2 = await fetch('http://localhost:3000/api/balas/proses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshots: [],
      pasted_text: sampleChat2,
      override_kanal: 'whatsapp',
    }),
  });
  const d2 = Date.now() - t1;
  const json2 = await res2.json();
  console.log(`✓ Kasus 2 selesai dalam ${d2} ms (Model: ${json2.model_used}, Fallback: ${json2.is_fallback})`);
  console.log('  Rincian durasi:', json2.durasi);

  // Ambil 10 baris terakhir dari tabel ai_log di Supabase Dev
  console.log('\n--- 10 BARIS TERAKHIR AI_LOG DARI PEMAKAIAN NYATA ---');
  const service = createClient(supabaseUrl, serviceRoleKey);
  const { data: logs, error } = await service
    .from('ai_log')
    .select('id, model, endpoint, durasi_ms, status, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  console.table(
    ((logs || []) as Array<Record<string, unknown>>).map((l) => ({
      Waktu: new Date(l.created_at as string).toLocaleTimeString('id-ID'),
      Endpoint: l.endpoint,
      Model: l.model,
      'Durasi (ms)': l.durasi_ms,
      Status: l.status,
      'Retry / Metadata': JSON.stringify(l.metadata || {}),
    }))
  );
}

main().catch(console.error);
