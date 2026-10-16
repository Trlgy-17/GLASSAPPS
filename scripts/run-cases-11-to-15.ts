import fs from 'fs';
import path from 'path';
import { executeUnifiedDraft } from '../src/lib/ai/provider';
import { defaultPriceBookV1 } from '../src/lib/pricing/default-price-book';
import { ThinkingLevel } from '@google/genai';

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

const NEW_CASES = [
  {
    id: 11,
    kategori: 'Klien Minta Diskon Langsung',
    input: 'Halo kak cermin custom 60x80 cm harganya bisa diskon 10% gak kak?',
    kanal: 'whatsapp',
  },
  {
    id: 12,
    kategori: 'Tanya Merek Kaca',
    input: 'Kalian pakai kaca merek apa ya? Asahi bukan?',
    kanal: 'whatsapp',
  },
  {
    id: 13,
    kategori: 'Kota Tanpa Zona',
    input: 'Kalau kirim cermin 60x80 cm ke Timika Papua ongkirnya berapa ya min?',
    kanal: 'whatsapp',
  },
  {
    id: 14,
    kategori: 'Bandingkan dengan Marketplace',
    input: 'Di Shopee ada yang jual cermin LED cuma Rp300.000, kok di kalian mahal banget?',
    kanal: 'whatsapp',
  },
  {
    id: 15,
    kategori: 'Klien Minta "Harga Nett Terakhir"',
    input: 'Kasih harga nett pas-nya dong kak buat deal hari ini, kalau cocok saya transfer DP sekarang.',
    kanal: 'whatsapp',
  },
];

async function run() {
  console.log('=== MENJALANKAN KASUS 11 SAMPAI 15 DENGAN THINKING: LOW ===\n');
  const results = [];

  for (const c of NEW_CASES) {
    console.log(`[Kasus ${c.id}: ${c.kategori}]`);
    try {
      const res = await executeUnifiedDraft({
        screenshots: [],
        pastedText: c.input,
        overrideKanal: c.kanal,
        priceBook: defaultPriceBookV1,
        modelName: 'gemini-3.5-flash-lite',
        thinkingLevel: ThinkingLevel.LOW,
      });

      const bubbles = res.draf.draf?.[0]?.bubbles || [];
      const fullText = bubbles.join('\n\n');
      console.log(`Model: ${res.modelUsed} | TTFT: ${res.ttftMs}ms | Durasi: ${res.durasiMs}ms`);
      console.log(`Perlu Owner: ${res.draf.perlu_owner} | Alasan: ${res.draf.alasan_perlu_owner}`);
      console.log(`Angka Tidak Terverifikasi: ${res.draf.angka_tidak_terverifikasi}`);
      console.log(`Draft Text:\n${fullText}\n---\n`);

      results.push({
        id: c.id,
        kategori: c.kategori,
        input: c.input,
        model: res.modelUsed,
        ttftMs: res.ttftMs,
        durasiMs: res.durasiMs,
        perlu_owner: res.draf.perlu_owner,
        alasan_perlu_owner: res.draf.alasan_perlu_owner,
        angka_tidak_terverifikasi: res.draf.angka_tidak_terverifikasi,
        frasa_terlarang: res.draf.frasa_terlarang_ditemukan || [],
        drafLengkap: fullText,
      });
    } catch (e: unknown) {
      console.error(`Error kasus ${c.id}:`, e instanceof Error ? e.message : String(e));
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  fs.writeFileSync('docs/hasil-kasus-11-15.json', JSON.stringify(results, null, 2), 'utf8');
}

run();
