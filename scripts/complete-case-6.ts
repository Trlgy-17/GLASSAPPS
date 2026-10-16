import fs from 'fs';
import path from 'path';
import { executeUnifiedDraft } from '../src/lib/ai/provider';
import { defaultPriceBookV1 } from '../src/lib/pricing/default-price-book';
import { ThinkingLevel } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Muat .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runCase6() {
  const c = {
    id: 6,
    kategori: 'Kirim Luar Jawa',
    input: 'Halo min, kalau kirim cermin 80x120 cm ke Balikpapan Kalimantan aman gak ya? Takut pecah di kapal/pesawat.',
    kanal: 'whatsapp',
  };

  const res = await executeUnifiedDraft({
    screenshots: [],
    pastedText: c.input,
    overrideKanal: c.kanal,
    priceBook: defaultPriceBookV1,
    modelName: 'gemini-3.5-flash-lite',
    thinkingLevel: ThinkingLevel.MINIMAL,
  });

  const { data: latestLog } = await supabase
    .from('ai_log')
    .select('created_at, model, status')
    .eq('endpoint', 'unifiedDraft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const bubbles = res.draf.draf?.[0]?.bubbles || [];
  const drafText = bubbles.join('\n\n');
  const ttftSec = (res.ttftMs / 1000).toFixed(2);
  const totalSec = (res.durasiMs / 1000).toFixed(2);
  const dbTimestamp = latestLog?.created_at || new Date().toISOString();

  const isModelUtama = res.modelUsed === 'gemini-3.6-flash';
  const statusModel = isModelUtama ? 'Model Utama (gemini-3.6-flash)' : `Model Cadangan (${res.modelUsed}) - Kuota Utama Habis`;

  const updatedEntry = {
    id: c.id,
    kategori: c.kategori,
    input: c.input,
    kanal: c.kanal,
    stempel_waktu_db: dbTimestamp,
    model_aktual: res.modelUsed,
    status_model: statusModel,
    thinking: 'minimal',
    ttftSec,
    totalSec,
    perlu_owner: res.draf.perlu_owner,
    alasan_perlu_owner: res.draf.alasan_perlu_owner || '',
    rekening_kosong: res.draf.rekening_kosong || false,
    angka_tidak_terverifikasi: res.draf.angka_tidak_terverifikasi || false,
    discrepancy_warning: res.draf.discrepancy_warning || null,
    drafLengkap: drafText,
  };

  const file = path.resolve('docs/benchmark-15-cases-real.json');
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  const idx = current.findIndex((item: any) => item.id === 6);
  if (idx !== -1) {
    current[idx] = updatedEntry;
    fs.writeFileSync(file, JSON.stringify(current, null, 2), 'utf8');
    console.log('✓ Kasus 6 berhasil diperbarui di benchmark-15-cases-real.json!');
  }
}

runCase6();
