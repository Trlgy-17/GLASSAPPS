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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminEmail = process.env.TEST_ADMIN_EMAIL!;
const adminPassword = process.env.TEST_ADMIN_PASSWORD!;
const ownerEmail = process.env.TEST_OWNER_EMAIL!;
const ownerPassword = process.env.TEST_OWNER_PASSWORD!;

async function runSecurityTests() {
  console.log('================================================================');
  console.log('🔒 PENGUJIAN KEAMANAN RLS & SERVER GUARD: ADMIN, OWNER, & ANON');
  console.log('================================================================\n');

  if (!adminEmail || !adminPassword || !ownerEmail || !ownerPassword) {
    console.error('❌ Error: Kredensial TEST_* belum lengkap di .env.local');
    process.exit(1);
  }

  // 1. Inisialisasi Service Role Client (untuk setup & teardown data uji)
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // 2. Inisialisasi & Login Client Admin
  const adminClient = createClient(supabaseUrl, anonKey);
  const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (adminAuthErr || !adminAuth.user || !adminAuth.session) {
    console.error('❌ Gagal login sebagai ADMIN:', adminAuthErr?.message);
    process.exit(1);
  }
  const adminUid = adminAuth.user.id;
  const adminToken = adminAuth.session.access_token;

  // 3. Inisialisasi & Login Client Owner
  const ownerClient = createClient(supabaseUrl, anonKey);
  const { data: ownerAuth, error: ownerAuthErr } = await ownerClient.auth.signInWithPassword({
    email: ownerEmail,
    password: ownerPassword,
  });
  if (ownerAuthErr || !ownerAuth.user || !ownerAuth.session) {
    console.error('❌ Gagal login sebagai OWNER:', ownerAuthErr?.message);
    process.exit(1);
  }
  const ownerUid = ownerAuth.user.id;
  const ownerToken = ownerAuth.session.access_token;

  // 4. Client Anonim
  const anonClient = createClient(supabaseUrl, anonKey);

  console.log('✓ Inisialisasi client berhasil: Sesi Admin, Owner, & Anonim siap.\n');

  // 5. SETUP DATA UJI
  console.log('⏳ Menyiapkan data uji sementara via Service Role...');
  let testPriceBookId: string;
  const { data: existingPb } = await serviceClient.from('price_books').select('id').limit(1);
  if (existingPb && existingPb.length > 0) {
    testPriceBookId = existingPb[0].id;
  } else {
    const { data: newPb, error: pbErr } = await serviceClient
      .from('price_books')
      .insert({
        versi: 9999,
        aktif: true,
        data_json: { test: true },
        dibuat_oleh: adminUid,
      })
      .select('id')
      .single();
    if (pbErr) throw pbErr;
    testPriceBookId = newPb.id;
  }

  const { data: testLead, error: leadErr } = await serviceClient
    .from('leads')
    .insert({
      brand_id: 'putraglass',
      nama: 'TEST Security Lead',
      kota: 'Bandung',
      zona: 'dalam_kota',
      segmen: 'B2C',
      status: 'TEST',
    })
    .select('id')
    .single();
  if (leadErr) throw leadErr;
  const testLeadId = testLead.id;

  const { data: testPenawaran, error: penErr } = await serviceClient
    .from('penawaran')
    .insert({
      nomor: `PG-Q-TEST-${Date.now().toString().slice(-4)}`,
      lead_id: testLeadId,
      price_book_id: testPriceBookId,
      items_json: [],
      ringkasan_json: { total: 1000000 },
      status: 'draf',
      valid_until: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      created_by: adminUid,
      total_nilai: 1000000,
    })
    .select('id')
    .single();
  if (penErr) throw penErr;
  const testPenawaranId = testPenawaran.id;

  console.log('✓ Data uji sementara siap.\n');

  try {
    console.log('--- 1. PENGUJIAN ROLE ADMIN & ANONIM ---');

    // 1. ADMIN SELECT leads -> BOLEH
    const { data: leadsData, error: leadsErr } = await adminClient
      .from('leads')
      .select('id, nama')
      .eq('id', testLeadId);

    if (!leadsErr && leadsData && leadsData.length > 0) {
      console.log('✅ Tes 1 LULUS: ADMIN boleh SELECT leads (Data terbaca via RLS).');
    } else {
      throw new Error(`Tes 1 GAGAL: ADMIN ditolak SELECT leads. Pesan: ${leadsErr?.message}`);
    }

    // 2. ADMIN SELECT price_books langsung -> DITOLAK
    const { data: pbData, error: pbErr } = await adminClient
      .from('price_books')
      .select('id, versi')
      .limit(1);

    if (pbErr) {
      console.log(`✅ Tes 2 LULUS: ADMIN ditolak SELECT price_books langsung via client. (${pbErr.message})`);
    } else {
      throw new Error('Tes 2 GAGAL: ADMIN berhasil SELECT price_books langsung tanpa Service Role!');
    }

    // 3. ADMIN INSERT audit_log langsung -> DITOLAK
    const { error: insAuditErr } = await adminClient.from('audit_log').insert({
      aktor: adminUid,
      aksi: 'TEST_FRAUD',
      objek: 'test',
      alasan: 'TEST Ilegal',
    });

    if (insAuditErr) {
      console.log(`✅ Tes 3 LULUS: ADMIN ditolak INSERT langsung ke audit_log. (${insAuditErr.message})`);
    } else {
      throw new Error('Tes 3 GAGAL: ADMIN berhasil memanipulasi audit_log langsung!');
    }

    // 4. ADMIN INSERT penawaran langsung (tanpa API route service role) -> DITOLAK RLS
    const { error: insPenawaranErr } = await adminClient.from('penawaran').insert({
      nomor: 'PG-Q-ILLEGAL-0001',
      lead_id: testLeadId,
      price_book_id: testPriceBookId,
      items_json: [],
      ringkasan_json: {},
      status: 'aktif',
      valid_until: '2026-10-30',
      created_by: adminUid,
    });

    if (insPenawaranErr) {
      console.log(`✅ Tes 4 LULUS: ADMIN ditolak INSERT langsung ke penawaran via client. (${insPenawaranErr.message})`);
    } else {
      throw new Error('Tes 4 GAGAL: ADMIN berhasil meng-insert penawaran langsung tanpa API!');
    }

    // 5. ANONIM SELECT leads -> DITOLAK
    const { data: anonLeads, error: anonLeadsErr } = await anonClient
      .from('leads')
      .select('*')
      .limit(1);

    if (anonLeadsErr || !anonLeads || anonLeads.length === 0) {
      console.log('✅ Tes 5 LULUS: Role ANONIM ditolak mengakses tabel leads.');
    } else {
      throw new Error('Tes 5 GAGAL: Role anonim berhasil membaca tabel leads!');
    }

    console.log('\n--- 2. PENGUJIAN OWNER READ-ONLY (DITOLAK DI SERVER) ---');

    // 6. OWNER membuat penawaran via POST /api/penawaran -> DITOLAK (403)
    const resOwnerPenawaran = await fetch('http://localhost:3000/api/penawaran', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        lead_id: testLeadId,
        penawaran_input: {
          items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 }],
          zona: 'dalam_kota',
          perlu_pasang: false,
          segmen: 'B2C',
        },
      }),
    });

    if (resOwnerPenawaran.status === 403) {
      console.log('✅ Tes 6 LULUS: OWNER ditolak di server saat POST /api/penawaran (403 Forbidden).');
    } else {
      throw new Error(`Tes 6 GAGAL: OWNER tidak ditolak membuat penawaran! (Status: ${resOwnerPenawaran.status})`);
    }

    // 7. OWNER mengubah status via PATCH /api/penawaran/[id]/status -> DITOLAK (403)
    const resOwnerStatus = await fetch(`http://localhost:3000/api/penawaran/${testPenawaranId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        status: 'deal',
        deal_at: new Date().toISOString(),
      }),
    });

    if (resOwnerStatus.status === 403) {
      console.log('✅ Tes 7 LULUS: OWNER ditolak di server saat mengubah status penawaran (403 Forbidden).');
    } else {
      throw new Error(`Tes 7 GAGAL: OWNER tidak ditolak mengubah status penawaran! (Status: ${resOwnerStatus.status})`);
    }

    // 8. OWNER mengubah buku harga via POST /api/buku-harga -> DITOLAK (403)
    const resOwnerPriceBook = await fetch('http://localhost:3000/api/buku-harga', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        data_json: { test: true },
        catatan_perubahan: 'Owner coba ubah harga',
      }),
    });

    if (resOwnerPriceBook.status === 403) {
      console.log('✅ Tes 8 LULUS: OWNER ditolak di server saat mengubah buku harga (403 Forbidden).');
    } else {
      throw new Error(`Tes 8 GAGAL: OWNER tidak ditolak mengubah buku harga! (Status: ${resOwnerPriceBook.status})`);
    }

    console.log('\n================================================================');
    console.log('🎉 SELURUH 8 PENGUJIAN KEAMANAN RLS & SERVER GUARD LULUS 100%');
    console.log('================================================================\n');
  } finally {
    // TEARDOWN DATA UJI
    console.log('🧹 Membersihkan seluruh data uji dari database...');
    await serviceClient.from('penawaran_status_log').delete().eq('penawaran_id', testPenawaranId);
    await serviceClient.from('penawaran').delete().eq('id', testPenawaranId);
    await serviceClient.from('leads').delete().eq('id', testLeadId);
    await serviceClient.from('price_books').delete().eq('versi', 9999);
    console.log('✓ Pembersihan selesai: Database kembali bersih.');
  }
}

runSecurityTests().catch((err) => {
  console.error('\n❌ PENGUJIAN KEAMANAN GAGAL:');
  console.error(err.message || err);
  process.exit(1);
});
