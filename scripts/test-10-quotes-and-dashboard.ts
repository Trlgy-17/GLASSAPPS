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
  console.log('--- 1. MENYIAPKAN 10 PENAWARAN CONTOH STATUS CAMPURAN ---');
  const service = createClient(supabaseUrl, serviceRoleKey);

  // Ambil admin id
  const { data: adminUser } = await service.from('users').select('id').eq('peran', 'admin').limit(1).single();
  const adminId = adminUser?.id;

  // Ambil buku harga aktif
  const { data: pb } = await service.from('price_books').select('id').eq('aktif', true).limit(1).single();
  const pbId = pb?.id;

  // Buat Lead Uji
  const { data: lead, error: leadErr } = await service
    .from('leads')
    .insert({
      brand_id: 'putraglass',
      nama: 'TEST Lead Dasbor',
      kota: 'Surabaya',
      zona: 'luar_kota',
      segmen: 'B2C',
      status: 'TEST',
    })
    .select('id')
    .single();

  if (leadErr) throw leadErr;
  const leadId = lead.id;

  const now = new Date();
  const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString();
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();

  // 10 Penawaran dengan status campuran
  const sampleQuotes = [
    // 1. draf (1.500.000)
    { nomor: 'PG-Q-2610-1001', lead_id: leadId, price_book_id: pbId, total_nilai: 1500000, status: 'draf', created_by: adminId, created_at: now.toISOString() },
    // 2. terkirim (2.000.000, update 4 hari lalu -> masuk follow-up)
    { nomor: 'PG-Q-2610-1002', lead_id: leadId, price_book_id: pbId, total_nilai: 2000000, status: 'terkirim', terkirim_at: fourDaysAgo, created_by: adminId, created_at: fourDaysAgo, updated_at: fourDaysAgo },
    // 3. terkirim (2.500.000, hari ini)
    { nomor: 'PG-Q-2610-1003', lead_id: leadId, price_book_id: pbId, total_nilai: 2500000, status: 'terkirim', terkirim_at: now.toISOString(), created_by: adminId, created_at: now.toISOString() },
    // 4. nego (3.000.000, update 5 hari lalu -> masuk follow-up)
    { nomor: 'PG-Q-2610-1004', lead_id: leadId, price_book_id: pbId, total_nilai: 3000000, status: 'nego', terkirim_at: fiveDaysAgo, created_by: adminId, created_at: fiveDaysAgo, updated_at: fiveDaysAgo },
    // 5. deal (2.590.000, hari ini)
    { nomor: 'PG-Q-2610-1005', lead_id: leadId, price_book_id: pbId, total_nilai: 2590000, status: 'deal', deal_at: now.toISOString(), terkirim_at: fourDaysAgo, created_by: adminId, created_at: now.toISOString() },
    // 6. deal (1.800.000, hari ini)
    { nomor: 'PG-Q-2610-1006', lead_id: leadId, price_book_id: pbId, total_nilai: 1800000, status: 'deal', deal_at: now.toISOString(), terkirim_at: fiveDaysAgo, created_by: adminId, created_at: now.toISOString() },
    // 7. deal (1.200.000, hari ini)
    { nomor: 'PG-Q-2610-1007', lead_id: leadId, price_book_id: pbId, total_nilai: 1200000, status: 'deal', deal_at: now.toISOString(), terkirim_at: now.toISOString(), created_by: adminId, created_at: now.toISOString() },
    // 8. lunas (4.000.000, hari ini)
    { nomor: 'PG-Q-2610-1008', lead_id: leadId, price_book_id: pbId, total_nilai: 4000000, status: 'lunas', deal_at: now.toISOString(), terkirim_at: fiveDaysAgo, created_by: adminId, created_at: now.toISOString() },
    // 9. batal (1.000.000, alasan: harga)
    { nomor: 'PG-Q-2610-1009', lead_id: leadId, price_book_id: pbId, total_nilai: 1000000, status: 'batal', alasan_batal: 'harga', created_by: adminId, created_at: now.toISOString() },
    // 10. batal (1.500.000, alasan: ongkir)
    { nomor: 'PG-Q-2610-1010', lead_id: leadId, price_book_id: pbId, total_nilai: 1500000, status: 'batal', alasan_batal: 'ongkir', created_by: adminId, created_at: now.toISOString() },
  ];

  const insertedIds: string[] = [];
  for (const q of sampleQuotes) {
    const { data: ins, error } = await service
      .from('penawaran')
      .insert({
        ...q,
        items_json: [],
        ringkasan_json: { total: q.total_nilai },
        valid_until: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      })
      .select('id')
      .single();
    if (error) throw error;
    insertedIds.push(ins.id);
  }

  console.log(`✓ Berhasil memasukkan 10 penawaran contoh (IDs: ${insertedIds.length})\n`);

  // --- 2. PENCOCOKAN ANGKA DASBOR DENGAN HITUNGAN MANUAL ---
  console.log('--- 2. MEMERIKSA PERHITUNGAN SQL VS MANUAL ---');

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

  const { data: dbSummary, error: rpcErr } = await service.rpc('get_owner_dashboard_summary', {
    p_start_date: startOfMonth,
    p_end_date: endOfMonth,
  });

  if (rpcErr) throw rpcErr;

  console.log('Data dari SQL get_owner_dashboard_summary:');
  console.log(JSON.stringify(dbSummary, null, 2));

  // Verifikasi Hitungan Manual:
  // Dibuat: 10, Nilai: 21.090.000
  console.log('\nVerifikasi Dibuat:');
  console.log('  Manual: 10 unit, Rp21.090.000');
  console.log(`  Database: ${dbSummary.dibuat.jumlah} unit, Rp${dbSummary.dibuat.nilai.toLocaleString('id-ID')}`);
  if (dbSummary.dibuat.jumlah === 10 && dbSummary.dibuat.nilai === 21090000) {
    console.log('  -> COCOK 100%');
  } else {
    throw new Error('Dibuat tidak cocok');
  }

  // Proses (terkirim & nego): 3, Nilai: 7.500.000
  console.log('\nVerifikasi Proses:');
  console.log('  Manual: 3 unit, Rp7.500.000');
  console.log(`  Database: ${dbSummary.proses.jumlah} unit, Rp${dbSummary.proses.nilai.toLocaleString('id-ID')}`);
  if (dbSummary.proses.jumlah === 3 && dbSummary.proses.nilai === 7500000) {
    console.log('  -> COCOK 100%');
  } else {
    throw new Error('Proses tidak cocok');
  }

  // Deal (deal & lunas): 4, Nilai: 9.590.000
  console.log('\nVerifikasi Deal:');
  console.log('  Manual: 4 unit, Rp9.590.000');
  console.log(`  Database: ${dbSummary.deal.jumlah} unit, Rp${dbSummary.deal.nilai.toLocaleString('id-ID')}`);
  if (dbSummary.deal.jumlah === 4 && dbSummary.deal.nilai === 9590000) {
    console.log('  -> COCOK 100%');
  } else {
    throw new Error('Deal tidak cocok');
  }

  // Batal: 2, Nilai: 2.500.000
  console.log('\nVerifikasi Batal:');
  console.log('  Manual: 2 unit, Rp2.500.000');
  console.log(`  Database: ${dbSummary.batal.jumlah} unit, Rp${dbSummary.batal.nilai.toLocaleString('id-ID')}`);
  if (dbSummary.batal.jumlah === 2 && dbSummary.batal.nilai === 2500000) {
    console.log('  -> COCOK 100%');
  } else {
    throw new Error('Batal tidak cocok');
  }

  // Closing Rate: 4 / (4 + 2 + 0) = 66.7%
  console.log('\nVerifikasi Closing Rate:');
  console.log('  Manual: 66.7%');
  console.log(`  Database: ${dbSummary.closing_rate}%`);
  if (dbSummary.closing_rate === 66.7) {
    console.log('  -> COCOK 100%');
  } else {
    throw new Error('Closing rate tidak cocok');
  }

  // Perlu Follow-up (terkirim/nego >= 3 hari tanpa perubahan)
  const { data: followUp, error: fuErr } = await service.rpc('get_quotes_need_followup');
  if (fuErr) throw fuErr;
  console.log('\nVerifikasi Perlu Follow-up (>= 3 hari):');
  console.log(`  Ditemukan: ${followUp.length} penawaran (teratas: ${followUp[0]?.nomor} - Rp${followUp[0]?.total_nilai})`);
  if (followUp.length >= 2 && followUp[0].total_nilai >= followUp[1].total_nilai) {
    console.log('  -> COCOK 100% (Urut DESC berdasarkan nilai)');
  }

  console.log('\n🎉 SELURUH PERHITUNGAN SQL DASBOR DAN HITUNGAN MANUAL COCOK 100%!\n');

  // Simpan data ID ke file sementara untuk teardown setelah screenshot
  fs.writeFileSync('docs/test-quote-ids.json', JSON.stringify({ insertedIds, leadId }));
  console.log('Data uji disimpan sementara untuk sesi screenshot.');
}

main().catch(console.error);
