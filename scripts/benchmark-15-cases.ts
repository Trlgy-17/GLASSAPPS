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

const CASES_15 = [
  {
    id: 1,
    kategori: 'Tanya Harga',
    input: 'Halo Min, mau tanya harga cermin bulat diameter 60 cm LED 3 warna touch screen kirim ke Bandung berapa ya?',
    kanal: 'whatsapp',
  },
  {
    id: 2,
    kategori: 'Tanya Tebal Kaca',
    input: 'Siang kak, ini tebal kacanya berapa mm ya? Tepi cerminnya tajam gak atau sudah di-bevel?',
    kanal: 'whatsapp',
  },
  {
    id: 3,
    kategori: 'Nego "Kemahalan"',
    input: 'Waduh kak, total Rp1.800.000 agak kemahalan ya di toko sebelah bisa Rp1.200.000. Bisa kurang gak harganya?',
    kanal: 'whatsapp',
  },
  {
    id: 4,
    kategori: 'Minta Ongkir Dibagi',
    input: 'Kak, ongkir ke Surabaya Rp1.300.000 berat banget di saya. Bisa gak ongkirnya kita bagi dua 50:50?',
    kanal: 'whatsapp',
  },
  {
    id: 5,
    kategori: 'B2B 5 Unit',
    input: 'Halo Putra Glass, saya kontraktor interior di Jakarta butuh 5 unit cermin rectangle 60x100 cm LED 3 warna untuk proyek hotel. Minta penawaran B2B ya.',
    kanal: 'whatsapp',
  },
  {
    id: 6,
    kategori: 'Kirim Luar Jawa',
    input: 'Halo min, kalau kirim cermin 80x120 cm ke Balikpapan Kalimantan aman gak ya? Takut pecah di kapal/pesawat.',
    kanal: 'whatsapp',
  },
  {
    id: 7,
    kategori: 'Tanya Garansi',
    input: 'Kak mau tanya, garansinya gimana ya kalau pas sampai lampunya mati atau touchscreen-nya gak responsif?',
    kanal: 'whatsapp',
  },
  {
    id: 8,
    kategori: 'Chat TikTok / Shopee',
    input: 'Halo kak bisa minta nomor WA admin gak? Mau kirim foto ruangan sama minta no rekening BCA mau langsung transfer di luar shopee.',
    kanal: 'shopee',
  },
  {
    id: 9,
    kategori: 'Follow-Up Pesan KLIEN',
    input: 'Kak jadi deh, DP ke mana ya biar langsung masuk antrean produksi?',
    kanal: 'whatsapp',
    klienLanjutan: {
      nomor: 'PG-Q-2610-0089',
      total: 2_140_000,
      tanggal: '15 Oktober 2026',
      nama: 'Kak Rina',
    },
  },
  {
    id: 10,
    kategori: 'Komplain Barang Sampai',
    input: 'Min paket cermin saya baru sampai barusan, tapi pas dibuka kacanya retak di pojok bawah. Ini gimana ya solusinya? Saya ada video unboxing utuh tanpa cut.',
    kanal: 'whatsapp',
  },
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

async function runBenchmark() {
  console.log('========================================================================');
  console.log('🚀 PENGUJIAN 15 KASUS MUTU DRAF AI (GEMINI-3.6-FLASH & THINKING: LOW)');
  console.log('========================================================================\n');

  const results: unknown[] = [];

  for (const c of CASES_15) {
    console.log(`[Kasus ${c.id}/15: ${c.kategori}] "${c.input.slice(0, 50)}..."`);
    const t0 = Date.now();

    try {
      const res = await executeUnifiedDraft({
        screenshots: [],
        pastedText: c.input,
        overrideKanal: c.kanal,
        priceBook: defaultPriceBookV1,
        modelName: 'gemini-3.6-flash',
        thinkingLevel: ThinkingLevel.LOW,
        klienLanjutan: c.klienLanjutan,
      });

      const bubbles = res.draf.draf?.[0]?.bubbles || [];
      const drafText = bubbles.join('\n\n');
      const ttftSec = (res.ttftMs / 1000).toFixed(2);
      const totalSec = (res.durasiMs / 1000).toFixed(2);

      console.log(`  -> Model: ${res.modelUsed} | TTFT: ${ttftSec}s | Total: ${totalSec}s`);
      console.log(`  -> Perlu Owner: ${res.draf.perlu_owner} | Angka Valid: ${!res.draf.angka_tidak_terverifikasi}`);
      if (res.draf.discrepancy_warning) {
        console.log(`  -> Discrepancy: ${res.draf.discrepancy_warning}`);
      }

      results.push({
        id: c.id,
        kategori: c.kategori,
        input: c.input,
        kanal: c.kanal,
        model: res.modelUsed,
        thinking: 'low',
        ttftSec,
        totalSec,
        perlu_owner: res.draf.perlu_owner,
        alasan_perlu_owner: res.draf.alasan_perlu_owner,
        angka_tidak_terverifikasi: res.draf.angka_tidak_terverifikasi,
        discrepancy_warning: res.draf.discrepancy_warning,
        drafLengkap: drafText,
      });
    } catch (err: unknown) {
      console.error(`  -> GAGAL pada kasus ${c.id}:`, err instanceof Error ? err.message : String(err));
      results.push({
        id: c.id,
        kategori: c.kategori,
        input: c.input,
        kanal: c.kanal,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Delay 1.5 detik antar request untuk menjaga stabilitas rate limit
    await new Promise((r) => setTimeout(r, 1500));
  }

  const outPath = path.resolve('docs/benchmark-15-cases.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n✓ Seluruh 15 kasus berhasil dieksekusi dan disimpan di: ${outPath}`);
}

runBenchmark();
