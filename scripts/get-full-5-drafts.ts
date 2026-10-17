import fs from 'fs';
import path from 'path';

// Muat .env.local sebelum modul lain di-import
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    });
}

import './patch-dns.js';
import { executeUnifiedDraft } from '../src/lib/ai/provider';
import { defaultPriceBookV1 } from '../src/lib/pricing/default-price-book';

const cases = [
  {
    id: 1,
    kategori: '1. Tanya Harga Custom (Bulat D70 3 Warna ST ke Bandung)',
    input:
      'Halo Min, mau tanya harga cermin custom bulat diameter 70 cm lampu 3 warna sensor tangan berapa ya kirim ke Bandung?',
    kanal: 'whatsapp',
  },
  {
    id: 2,
    kategori: '2. Tanya Produk Jadi (Rectangle 40x60 Sandblast ST)',
    input:
      'Siang kak, ini ready cermin model rectangle ukuran 40x60 cm sandblast sensor tangan (ST)? Harganya berapa ya?',
    kanal: 'whatsapp',
  },
  {
    id: 3,
    kategori: '3. Ongkir Luar Kota (Custom 60x80 ke Surabaya)',
    input:
      'Halo mau kirim cermin custom 60x80 cm ke Surabaya, ongkos kirimnya berapa ya kak?',
    kanal: 'whatsapp',
  },
  {
    id: 4,
    kategori: '4. Minta Ambil Sendiri (Oval 50x70 ke Workshop)',
    input:
      'Bisa ambil sendiri ke workshop gak kak untuk cermin oval 50x70 cm? Alamat workshopnya di mana ya?',
    kanal: 'whatsapp',
  },
  {
    id: 5,
    kategori: '5. Chat Marketplace TikTok (Bulat 60 cm)',
    input:
      'Halo kak ada ready stock cermin bulat 60 cm? Pengiriman paking kayu aman gak?',
    kanal: 'tiktok',
  },
];

async function main() {
  console.log('Mengambil 5 draf teks lengkap dari AI Gemini...');
  const fullResults = [];

  for (const c of cases) {
    const t0 = Date.now();
    const result = await executeUnifiedDraft({
      screenshots: [],
      pastedText: c.input,
      overrideKanal: c.kanal,
      priceBook: defaultPriceBookV1,
      modelName: 'gemini-3.5-flash-lite',
    });
    const durasi = Date.now() - t0;

    const draftObj = result.draf;
    const allBubbles: string[] = [];
    (draftObj?.draf || []).forEach((d: { bubbles?: string[] }) => {
      (d.bubbles || []).forEach((b: string) => allBubbles.push(b));
    });

    fullResults.push({
      id: c.id,
      kategori: c.kategori,
      kanal: c.kanal,
      durasiDetik: (durasi / 1000).toFixed(2),
      modelUsed: result.modelUsed,
      fullText: allBubbles.join('\n\n'),
      bubbles: allBubbles,
      tahap: draftObj?.tahap,
      ringkasan: draftObj?.ringkasan_situasi,
    });

    console.log(`✓ Kasus ${c.id} selesai dalam ${(durasi / 1000).toFixed(2)}s`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  fs.writeFileSync('docs/5-kasus-draft-lengkap.json', JSON.stringify(fullResults, null, 2));
  console.log('Semua 5 draf lengkap berhasil disimpan ke docs/5-kasus-draft-lengkap.json');
}

main().catch(console.error);
