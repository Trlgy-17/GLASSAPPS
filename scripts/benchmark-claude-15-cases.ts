import fs from 'fs';
import path from 'path';
import { executeUnifiedDraft } from '../src/lib/ai/provider';
import { defaultPriceBookV1 } from '../src/lib/pricing/default-price-book';

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

// PAKSA lewat Claude
process.env.AI_DRAFT_CHAIN = 'anthropic:claude-haiku-5-5';

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
    kategori: 'B2B 5 Unit (Hotel Jakarta)',
    input: 'Halo Putra Glass, saya kontraktor interior di Jakarta butuh 5 unit cermin rectangle 60x100 cm LED 3 warna untuk proyek hotel. Minta penawaran B2B ya.',
    kanal: 'whatsapp',
  },
  {
    id: 6,
    kategori: 'Kirim Luar Jawa (Balikpapan)',
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
    input: 'Halo kak bisa minta nomor WA admin gak? Mau kirim foto ruangan sama minta no rekening BCA mau langsung transfer di luar Shopee ya.',
    kanal: 'shopee',
  },
  {
    id: 9,
    kategori: 'Follow-up Pesan Klien',
    input: 'Kak jadi deh, DP ke mana ya biar langsung masuk antrean produksi?',
    kanal: 'whatsapp',
    klienLanjutan: {
      nomor: 'PG-Q-2610-0089',
      total: 2140000,
      tanggal: '14 Okt',
      nama: 'Rinaldi',
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
    kategori: 'Kirim Luar Jawa (Timika Papua)',
    input: 'Kalau kirim cermin 60x80 cm ke Timika Papua ongkirnya berapa ya? Sekalian packing kayunya.',
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
  console.log('================================================================');
  console.log('🚀 BENCHMARK 15 KASUS NYATA - PAKSA LEWAT CLAUDE HAIKU 5.5');
  console.log('AI_DRAFT_CHAIN:', process.env.AI_DRAFT_CHAIN);
  console.log('================================================================\n');

  const results: any[] = [];

  for (let i = 0; i < CASES_15.length; i++) {
    const c = CASES_15[i];
    console.log(`\n----------------------------------------------------------------`);
    console.log(`[Kasus ${c.id}/15] [${c.kategori}]`);
    console.log(`Input: "${c.input}"`);
    console.log(`Kanal: ${c.kanal}`);

    const t0 = Date.now();
    try {
      const res = await executeUnifiedDraft({
        screenshots: [],
        pastedText: c.input,
        overrideKanal: c.kanal,
        priceBook: defaultPriceBookV1,
        modelName: 'claude-haiku-5-5',
        klienLanjutan: (c as any).klienLanjutan,
      });

      const totalSec = (Date.now() - t0) / 1000;
      const ttftSec = res.ttftMs / 1000;
      const bubbles = res.draf?.draf?.[0]?.bubbles || [];
      const drafLengkap = bubbles.join('\n');

      console.log(`✓ Status: BERHASIL via ${res.provider} (${res.modelUsed})`);
      console.log(`⏱️ TTFT: ${ttftSec.toFixed(2)}s | Total: ${totalSec.toFixed(2)}s`);
      console.log(`💰 Biaya: Rp${res.biayaPerkiraan} (in: ${res.inputTokens}, out: ${res.outputTokens})`);
      if (res.claudeWarning) console.log(`⚠️ Warning: ${res.claudeWarning}`);
      console.log(`📝 Draf:\n${drafLengkap}\n`);

      results.push({
        id: c.id,
        kategori: c.kategori,
        input: c.input,
        status: 'success',
        provider: res.provider,
        model_used: res.modelUsed,
        claude_warning: res.claudeWarning || null,
        ttft_s: ttftSec,
        total_s: totalSec,
        biaya_rp: res.biayaPerkiraan,
        input_tokens: res.inputTokens,
        output_tokens: res.outputTokens,
        bubbles: bubbles,
        draf_lengkap: drafLengkap,
      });
    } catch (err: any) {
      const totalSec = (Date.now() - t0) / 1000;
      const errMsg = err?.message || String(err);
      console.log(`❌ Error / Batas Ditemui: ${errMsg}`);

      results.push({
        id: c.id,
        kategori: c.kategori,
        input: c.input,
        status: 'error',
        error: errMsg,
        total_s: totalSec,
      });
    }

    // Jeda antar-request 5 detik sesuai instruksi untuk akun evaluasi
    if (i < CASES_15.length - 1) {
      console.log('⏳ Menunggu jeda 5 detik antar-request...');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  const outPath = path.resolve(process.cwd(), 'docs/benchmark-claude-15-cases.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n================================================================`);
  console.log(`✅ Selesai! Hasil benchmark 15 kasus tersimpan di: ${outPath}`);
  console.log(`================================================================`);
}

runBenchmark().catch((e) => {
  console.error('Fatal error benchmark:', e);
  process.exit(1);
});
