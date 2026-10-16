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

const cases = [
  { id: 1, text: "Halo Min, saya Rina di Bandung. Mau custom cermin oval ukuran 60x90 cm dengan lampu LED 3 warna touch screen. Mau dipasang di kamar mandi. Total berapa ya?" },
  { id: 2, text: "Siang Putra Glass, saya Budi dari Surabaya. Mau tanya cermin kotak 100 x 80 cm pakai frame aluminium hitam dan antifog. Berapa harganya ya kak dan ongkir ke Surabaya?" },
  { id: 3, text: "Halo, ukuran katalog 30x45 cm itu ready stock gak? Saya mau ambil langsung ke workshop Bandung hari ini bisa?" },
  { id: 4, text: "Min, cermin bulat diameter 70 cm sensor tangan dan ada garansi gak ya kalau pecah di jalan?" },
  { id: 5, text: "Halo kak, untuk villa di Lembang mau pesan 3 unit cermin 50x80 cm LED 1 warna saja pakai saklar biasa. Apakah dapat potongan harga?" },
  { id: 6, text: "Halo, saya arsitek di Jakarta butuh 5 unit cermin LED 60x100 cm untuk proyek apartemen. Minta penawaran resmi B2B ya." },
  { id: 7, text: "Kak, kalau cermin arch 70x120 cm pakai frame aluminium bisa gak ya?" },
  { id: 8, text: "Mau tanya kak, kalau sandblast custom lebar 3 cm jarak dari tepi 2 cm di cermin 80x120 cm kena biaya tambahan berapa?" },
  { id: 9, text: "Halo admin, kalau saya mau pesan cermin wastafel 50x70 cm tapi di tempat saya gak ada colokan listrik, ada solusinya gak?" },
  { id: 10, text: "Siang kak, saya mau tanya garansi cerminnya apa saja ya dan apakah kalau kirim ke luar pulau aman?" }
];

async function runLiteCases() {
  console.log('=== MEMULAI PENGUJIAN 10 KASUS: GEMINI-3.5-FLASH-LITE (THINKING: LOW) ===\n');

  const liteResults: any[] = [];

  for (const c of cases) {
    console.log(`[Kasus ${c.id}] Menjalankan: "${c.text.slice(0, 45)}..."`);
    const t0 = Date.now();
    try {
      const res = await executeUnifiedDraft({
        screenshots: [],
        pastedText: c.text,
        priceBook: defaultPriceBookV1,
        modelName: 'gemini-3.5-flash-lite',
        thinkingLevel: ThinkingLevel.LOW,
      });

      console.log(`  -> Selesai dalam ${res.durasiMs} ms (TTFT: ${res.ttftMs} ms)`);
      const bubbles = (res.draf.draf?.[0]?.bubbles || []).join('\n\n');

      liteResults.push({
        id: c.id,
        input: c.text,
        model: 'gemini-3.5-flash-lite',
        thinking: 'low',
        ttftMs: res.ttftMs,
        durasiMs: res.durasiMs,
        draf: bubbles,
        spec: res.extraction,
      });
    } catch (err: any) {
      console.warn(`  -> Gagal pada kasus ${c.id}:`, err.message?.slice(0, 100));
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  fs.writeFileSync('docs/hasil-gemini-3.5-flash-lite.json', JSON.stringify(liteResults, null, 2), 'utf8');
  console.log('\n=== HASIL SELESAI DISIMPAN KE docs/hasil-gemini-3.5-flash-lite.json ===');
}

runLiteCases().catch(console.error);
