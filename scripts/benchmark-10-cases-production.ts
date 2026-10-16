import fs from 'fs';
import path from 'path';
import { executeUnifiedDraft } from '../src/lib/ai/provider';
import { defaultPriceBookV1 } from '../src/lib/pricing/default-price-book';
import { ThinkingLevel } from '@google/genai';

// Muat environment
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

const scenarios = [
  {
    id: 1,
    kategori: 'Tanya Harga',
    text: 'Halo Min, mau tanya harga cermin bulat diameter 60 cm LED 3 warna touch screen kirim ke Bandung berapa ya?',
    kanal: 'whatsapp',
  },
  {
    id: 2,
    kategori: 'Tanya Tebal Kaca',
    text: 'Siang kak, ini tebal kacanya berapa mm ya? Tepi cerminnya tajam gak atau sudah di-bevel?',
    kanal: 'whatsapp',
  },
  {
    id: 3,
    kategori: 'Nego "Kemahalan"',
    text: 'Waduh kak, total Rp1.800.000 agak kemahalan ya di toko sebelah bisa Rp1.200.000. Bisa kurang gak harganya?',
    kanal: 'whatsapp',
  },
  {
    id: 4,
    kategori: 'Minta Ongkir Dibagi',
    text: 'Kak, ongkir ke Surabaya Rp1.300.000 berat banget di saya. Bisa gak ongkirnya kita bagi dua 50:50?',
    kanal: 'whatsapp',
  },
  {
    id: 5,
    kategori: 'B2B 5 Unit',
    text: 'Halo Putra Glass, saya kontraktor interior di Jakarta butuh 5 unit cermin rectangle 60x100 cm LED 3 warna untuk proyek hotel. Minta penawaran B2B ya.',
    kanal: 'whatsapp',
  },
  {
    id: 6,
    kategori: 'Kirim Luar Jawa',
    text: 'Halo min, kalau kirim cermin 80x120 cm ke Balikpapan Kalimantan aman gak ya? Takut pecah di kapal/pesawat.',
    kanal: 'whatsapp',
  },
  {
    id: 7,
    kategori: 'Tanya Garansi',
    text: 'Kak mau tanya, garansinya gimana ya kalau pas sampai lampunya mati atau touchscreen-nya gak responsif?',
    kanal: 'whatsapp',
  },
  {
    id: 8,
    kategori: 'Chat TikTok / Shopee',
    text: 'Halo kak bisa minta nomor WA admin gak? Mau kirim foto ruangan sama minta no rekening BCA mau langsung transfer di luar shopee.',
    kanal: 'shopee',
  },
  {
    id: 9,
    kategori: 'Follow-Up "Jadi Nggak Kak"',
    text: 'Halo kak Rina, kemarin sudah kami hitungkan cermin oval 60x90 cm total Rp2.495.000. Gimana kak, jadi pesan untuk diamankan jadwal produksinya?',
    kanal: 'whatsapp',
  },
  {
    id: 10,
    kategori: 'Komplain Barang Sampai',
    text: 'Min paket cermin saya baru sampai barusan, tapi pas dibuka kacanya retak di pojok bawah. Ini gimana ya solusinya? Saya ada video unboxing utuh tanpa cut.',
    kanal: 'whatsapp',
  },
];

async function runBenchmark() {
  console.log('=== MEMULAI BENCHMARK 10 KASUS: PRODUKSI NYATA ===\n');

  const benchmarkResults: any[] = [];

  for (const sc of scenarios) {
    console.log(`\n======================================================`);
    console.log(`[Kasus ${sc.id}: ${sc.kategori}]`);
    console.log(`Pesan: "${sc.text}" (Kanal: ${sc.kanal})`);

    // 1. Model A: gemini-3.6-flash (minimal)
    console.log(`  -> Menjalankan Model A: gemini-3.6-flash (minimal)...`);
    let resA: any = null;
    try {
      resA = await executeUnifiedDraft({
        screenshots: [],
        pastedText: sc.text,
        overrideKanal: sc.kanal,
        priceBook: defaultPriceBookV1,
        modelName: 'gemini-3.6-flash',
        thinkingLevel: ThinkingLevel.MINIMAL,
      });
      console.log(`     Model A selesai dalam ${resA.durasiMs} ms (TTFT: ${resA.ttftMs} ms)`);
    } catch (err: any) {
      console.warn(`     Model A gagal:`, err.message?.slice(0, 100));
    }

    // Jeda 1,5 detik
    await new Promise((r) => setTimeout(r, 1500));

    // 2. Model B: gemini-3.5-flash-lite (low)
    console.log(`  -> Menjalankan Model B: gemini-3.5-flash-lite (low)...`);
    let resB: any = null;
    try {
      resB = await executeUnifiedDraft({
        screenshots: [],
        pastedText: sc.text,
        overrideKanal: sc.kanal,
        priceBook: defaultPriceBookV1,
        modelName: 'gemini-3.5-flash-lite',
        thinkingLevel: ThinkingLevel.LOW,
      });
      console.log(`     Model B selesai dalam ${resB.durasiMs} ms (TTFT: ${resB.ttftMs} ms)`);
    } catch (err: any) {
      console.warn(`     Model B gagal:`, err.message?.slice(0, 100));
    }

    const draftTextA = resA ? (resA.draf.draf?.[0]?.bubbles || []).join('\n\n') : '(Gagal / Kuota)';
    const draftTextB = resB ? (resB.draf.draf?.[0]?.bubbles || []).join('\n\n') : '(Gagal / Kuota)';

    // Cek kebocoran penanda [[...]]
    const bocorA = /\[\[.*?\]\]/.test(draftTextA);
    const bocorB = /\[\[.*?\]\]/.test(draftTextB);

    // Cek kecocokan angka kalkulator
    const cocokA = resA ? !resA.draf.angka_tidak_terverifikasi : false;
    const cocokB = resB ? !resB.draf.angka_tidak_terverifikasi : false;

    benchmarkResults.push({
      id: sc.id,
      kategori: sc.kategori,
      input: sc.text,
      kanal: sc.kanal,
      modelA: {
        model: 'gemini-3.6-flash',
        ttftSec: resA ? (resA.ttftMs / 1000).toFixed(2) : '–',
        totalSec: resA ? (resA.durasiMs / 1000).toFixed(2) : '–',
        cocokKalkulator: cocokA ? 'Cocok' : 'Ada selisih / Perlu cek',
        penandaBocor: bocorA ? 'ADA BOCOR' : 'Tidak ada',
        drafLengkap: draftTextA,
      },
      modelB: {
        model: 'gemini-3.5-flash-lite',
        ttftSec: resB ? (resB.ttftMs / 1000).toFixed(2) : '–',
        totalSec: resB ? (resB.durasiMs / 1000).toFixed(2) : '–',
        cocokKalkulator: cocokB ? 'Cocok' : 'Ada selisih / Perlu cek',
        penandaBocor: bocorB ? 'ADA BOCOR' : 'Tidak ada',
        drafLengkap: draftTextB,
      },
    });

    await new Promise((r) => setTimeout(r, 1500));
  }

  fs.writeFileSync('docs/benchmark-10-cases.json', JSON.stringify(benchmarkResults, null, 2), 'utf8');
  console.log('\n=== BENCHMARK SELESAI & DISIMPAN KE docs/benchmark-10-cases.json ===');
}

runBenchmark().catch(console.error);
