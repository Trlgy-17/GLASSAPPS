import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Muat .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    });
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const cases = [
  {
    id: 1,
    kategori: 'Tanya Harga Custom',
    input:
      'Halo Min, mau tanya harga cermin custom bulat diameter 70 cm lampu 3 warna sensor tangan berapa ya kirim ke Bandung?',
    kanal: 'whatsapp',
  },
  {
    id: 2,
    kategori: 'Tanya Produk Jadi TC/ST/BT',
    input:
      'Siang kak, ini ready cermin model rectangle ukuran 40x60 cm sandblast sensor tangan (ST)? Harganya berapa ya?',
    kanal: 'whatsapp',
  },
  {
    id: 3,
    kategori: 'Ongkir Luar Kota',
    input:
      'Halo mau kirim cermin custom 60x80 cm ke Surabaya, ongkos kirimnya berapa ya kak?',
    kanal: 'whatsapp',
  },
  {
    id: 4,
    kategori: 'Minta Ambil Sendiri',
    input:
      'Bisa ambil sendiri ke workshop gak kak untuk cermin oval 50x70 cm? Alamat workshopnya di mana ya?',
    kanal: 'whatsapp',
  },
  {
    id: 5,
    kategori: 'Chat dari Marketplace (Shopee/TikTok)',
    input:
      'Halo kak ada ready stock cermin bulat 60 cm? Pengiriman paking kayu aman gak?',
    kanal: 'tiktok',
  },
];

async function main() {
  console.log('=== MENJALANKAN 5 KASUS AI GEMINI ASLI ===\n');

  // Ambil token admin
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.TEST_ADMIN_EMAIL,
    password: env.TEST_ADMIN_PASSWORD,
  });

  if (authErr || !authData.session) {
    console.error('Gagal login admin:', authErr?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  const results = [];

  for (const c of cases) {
    console.log(`[Kasus ${c.id}/5] ${c.kategori}...`);
    const t0 = Date.now();

    const res = await fetch('http://localhost:3000/api/balas/proses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pasted_text: c.input,
        override_kanal: c.kanal,
      }),
    });

    const durationFetchMs = Date.now() - t0;
    const json = await res.json();

    if (!res.ok || !json.success) {
      console.error(`✗ Gagal pada Kasus ${c.id}:`, json.error);
      results.push({
        id: c.id,
        kategori: c.kategori,
        status: 'FAILED',
        error: json.error,
        durationFetchMs,
      });
      continue;
    }

    // Ambil log terbaru dari tabel ai_log
    const { data: latestLog } = await supabase
      .from('ai_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const drafOutput = json.draf?.bubbles?.join('\n\n') || '';

    // Validasi aturan bisnis
    const containsWa = /wa\.me|08\d{8,}|\+62\s?8/i.test(drafOutput);
    const containsRekening = /2782484011|rekening|transfer/i.test(drafOutput);
    const containsLink = /https?:\/\//i.test(drafOutput);

    const isMarketplaceCompliant =
      c.kanal === 'tiktok'
        ? !containsWa && !containsRekening && !containsLink
        : true;

    results.push({
      id: c.id,
      kategori: c.kategori,
      kanal: c.kanal,
      status: 'SUCCESS',
      modelUsed: json.model_used || latestLog?.model,
      durationMs: durationFetchMs,
      ttftMs: json.ttft_ms || latestLog?.ttft_ms,
      inputTokens: latestLog?.input_tokens,
      outputTokens: latestLog?.output_tokens,
      createdAt: latestLog?.created_at,
      drafPreview: drafOutput.slice(0, 180) + '...',
      isMarketplaceCompliant,
    });

    console.log(`✓ Kasus ${c.id} Sukses: Model=${json.model_used}, Waktu=${(durationFetchMs / 1000).toFixed(2)}s`);
    console.log(`  Draf: "${drafOutput.slice(0, 100)}..."\n`);

    // Jeda 2 detik antar request agar tidak terkena burst rate limit
    await new Promise((r) => setTimeout(r, 2000));
  }

  fs.writeFileSync(
    'docs/hasil-5-kasus-gemini-asli.json',
    JSON.stringify(results, null, 2)
  );

  console.log('=== HASIL LENGKAP 5 KASUS AI GEMINI ASLI ===');
  console.table(
    results.map((r) => ({
      ID: r.id,
      Kategori: r.kategori,
      Kanal: r.kanal,
      Model: r.modelUsed,
      'Waktu (s)': ((r.durationMs || 0) / 1000).toFixed(2),
      'Tokens (In/Out)': `${r.inputTokens || '-'}/${r.outputTokens || '-'}`,
      Timestamp: r.createdAt,
      'Marketplace Guard': r.isMarketplaceCompliant ? 'AMAN' : 'MELANGGAR',
    }))
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
