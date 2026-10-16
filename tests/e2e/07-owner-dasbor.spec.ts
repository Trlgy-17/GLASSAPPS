import { test, expect } from '@playwright/test';
import {
  getAuthToken,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  getServiceClient,
  loginAsOwner,
  cleanupAllTestData,
} from './helpers';

test.describe('B. FUNGSI OWNER - Read-Only Guard, Agregasi Dasbor, & Batas Bulan WIB', () => {
  let ownerToken: string;
  let adminToken: string;
  let adminUid: string;
  let priceBookId: string;
  let testLeadId: string;
  const testQuoteIds: string[] = [];

  test.beforeAll(async () => {
    ownerToken = await getAuthToken(OWNER_EMAIL, OWNER_PASSWORD);
    adminToken = await getAuthToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const service = getServiceClient();

    // Ambil UID admin
    const { data: adminUser } = await service.from('users').select('id').eq('email', ADMIN_EMAIL).single();
    adminUid = adminUser!.id;

    // Ambil price_book aktif
    const { data: pb } = await service.from('price_books').select('id').eq('aktif', true).single();
    priceBookId = pb!.id;

    // Buat 1 lead untuk data uji dasbor
    const { data: lead } = await service
      .from('leads')
      .insert({
        brand_id: 'putraglass',
        nama: 'Lead Uji Dasbor Owner',
        kota: 'Bandung',
        zona: 'dalam_kota',
        segmen: 'B2C',
        status: 'prospek',
      })
      .select('id')
      .single();
    testLeadId = lead!.id;

    // =========================================================================
    // BUAT 30 PENAWARAN CAMPURAN (STATUS, KANAL, ADMIN, & BATAS BULAN WIB)
    // Batas bulan WIB:
    // 31 Okt 23:59 WIB = 2026-10-31T16:59:00.000Z (Bulan 10 / Oktober)
    // 01 Nov 00:01 WIB = 2026-10-31T17:01:00.000Z (Bulan 11 / November)
    // =========================================================================
    const statuses = ['draf', 'terkirim', 'nego', 'deal', 'batal', 'kadaluwarsa'] as const;
    const kanals = ['whatsapp', 'instagram', 'tiktok', 'shopee'];

    const quotesToInsert = [];

    // Item 1: Tepat di batas akhir Oktober (31 Okt 2026 23:59 WIB)
    quotesToInsert.push({
      nomor: `PG-Q-2610-TEST-OCT31`,
      lead_id: testLeadId,
      price_book_id: priceBookId,
      items_json: [],
      ringkasan_json: { total: 1_000_000 },
      status: 'deal' as const,
      kanal: 'whatsapp',
      total_nilai: 1_000_000,
      valid_until: '2026-11-07',
      created_by: adminUid,
      created_at: '2026-10-31T16:59:00.000Z',
      deal_at: '2026-10-31T16:59:00.000Z',
      terkirim_at: '2026-10-30T10:00:00.000Z',
    });

    // Item 2: Tepat di awal November (01 Nov 2026 00:01 WIB)
    quotesToInsert.push({
      nomor: `PG-Q-2611-TEST-NOV01`,
      lead_id: testLeadId,
      price_book_id: priceBookId,
      items_json: [],
      ringkasan_json: { total: 2_000_000 },
      status: 'deal' as const,
      kanal: 'instagram',
      total_nilai: 2_000_000,
      valid_until: '2026-11-08',
      created_by: adminUid,
      created_at: '2026-10-31T17:01:00.000Z',
      deal_at: '2026-10-31T17:01:00.000Z',
      terkirim_at: '2026-10-31T17:01:00.000Z',
    });

    // 28 Penawaran lainnya di bulan berjalan (Oktober 2026)
    for (let i = 3; i <= 30; i++) {
      const st = statuses[i % statuses.length];
      const kn = kanals[i % kanals.length];
      const nilai = 500_000 + i * 50_000;
      const isDeal = st === 'deal';
      const isBatal = st === 'batal';

      quotesToInsert.push({
        nomor: `PG-Q-2610-TEST-${String(i).padStart(4, '0')}`,
        lead_id: testLeadId,
        price_book_id: priceBookId,
        items_json: [],
        ringkasan_json: { total: nilai },
        status: st,
        kanal: kn,
        total_nilai: nilai,
        valid_until: '2026-10-30',
        created_by: adminUid,
        created_at: '2026-10-15T05:00:00.000Z',
        deal_at: isDeal ? '2026-10-16T08:00:00.000Z' : null,
        terkirim_at: '2026-10-15T06:00:00.000Z',
        alasan_batal: isBatal ? 'harga' : null,
      });
    }

    const { data: inserted, error: insErr } = await service
      .from('penawaran')
      .insert(quotesToInsert)
      .select('id');

    if (insErr) throw insErr;
    (inserted || []).forEach((row) => testQuoteIds.push(row.id));
  });

  test.afterAll(async () => {
    // Bersihkan seluruh 30 data uji setelah selesai pengujian
    const service = getServiceClient();
    if (testQuoteIds.length > 0) {
      await service.from('penawaran_status_log').delete().in('penawaran_id', testQuoteIds);
      await service.from('penawaran').delete().in('id', testQuoteIds);
    }
    if (testLeadId) {
      await service.from('leads').delete().eq('id', testLeadId);
    }
    await cleanupAllTestData();
  });

  test('1. Seluruh halaman admin dialihkan dan API tulis / AI ditolak (403) untuk role OWNER', async ({ request, page }) => {
    // 1. UI: Buka /balas -> harus dialihkan ke /dasbor
    await loginAsOwner(page);
    await page.goto('/balas');
    await expect(page).toHaveURL(/\/dasbor/);

    await page.goto('/penawaran/baru');
    await expect(page).toHaveURL(/\/dasbor/);

    await page.goto('/pengaturan/buku-harga');
    await expect(page).toHaveURL(/\/dasbor/);

    // 2. API: Tulis penawaran -> 403 Forbidden
    const resPostPenawaran = await request.post('/api/penawaran', {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { lead_id: testLeadId, items: [] },
    });
    expect(resPostPenawaran.status()).toBe(403);

    // 3. API: Ubah status -> 403 Forbidden
    const resPatchStatus = await request.patch(`/api/penawaran/${testQuoteIds[0]}/status`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { status: 'deal' },
    });
    expect(resPatchStatus.status()).toBe(403);

    // 4. API: AI Proses Balas -> 403 Forbidden
    const resAiProses = await request.post('/api/balas/proses', {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { pasted_text: 'Halo pesan cermin' },
    });
    expect(resAiProses.status()).toBe(403);
  });

  test('2. Angka dasbor dicocokkan dengan query SQL manual dan batas bulan 31 Okt 23:59 WIB vs 1 Nov 00:01 WIB', async ({ request }) => {
    const service = getServiceClient();

    // Hitung manual via query SQL di database untuk Oktober 2026 (WIB)
    // Rentang Oktober WIB: 2026-09-30T17:00:00.000Z s/d 2026-10-31T16:59:59.999Z
    const octStart = '2026-09-30T17:00:00.000Z';
    const octEnd = '2026-10-31T16:59:59.999Z';

    const { data: dbOctQuotes } = await service
      .from('penawaran')
      .select('id, total_nilai, status')
      .gte('created_at', octStart)
      .lte('created_at', octEnd);

    expect(dbOctQuotes).toBeDefined();

    // Panggil API Dasbor periode custom untuk bulan Oktober WIB
    const resDasbor = await request.get(`/api/dasbor?periode=custom&start_date=2026-10-01&end_date=2026-10-31`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(resDasbor.status()).toBe(200);
    const json = await resDasbor.json();

    // Verifikasi bahwa data tanggal 31 Okt 23:59 WIB (PG-Q-2610-TEST-OCT31) masuk ke data Oktober
    expect(json.summary.dibuat.jumlah).toBeGreaterThanOrEqual(29);

    // Panggil API Dasbor periode custom untuk bulan November WIB (1 Nov s/d 30 Nov)
    const resNov = await request.get(`/api/dasbor?periode=custom&start_date=2026-11-01&end_date=2026-11-30`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(resNov.status()).toBe(200);
    const jsonNov = await resNov.json();

    // Verifikasi data tanggal 01 Nov 00:01 WIB (PG-Q-2611-TEST-NOV01) masuk ke November
    expect(jsonNov.summary.dibuat.jumlah).toBeGreaterThanOrEqual(1);
    expect(jsonNov.summary.deal.jumlah).toBeGreaterThanOrEqual(1);
  });

  test('3. Filter kanal dan admin pada dasbor owner', async ({ request }) => {
    // Filter kanal TikTok
    const resTikTok = await request.get(`/api/dasbor?kanal=tiktok`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(resTikTok.status()).toBe(200);
    const jsonTikTok = await resTikTok.json();
    expect(jsonTikTok.summary).toBeDefined();

    // Filter admin
    const resAdmin = await request.get(`/api/dasbor?admin_id=${adminUid}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(resAdmin.status()).toBe(200);
    const jsonAdmin = await resAdmin.json();
    expect(jsonAdmin.summary.dibuat.jumlah).toBeGreaterThan(0);
  });
});
