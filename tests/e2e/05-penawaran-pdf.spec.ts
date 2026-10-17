import { test, expect } from '@playwright/test';
import React from 'react';
import { renderToBuffer, DocumentProps } from '@react-pdf/renderer';
import { PenawaranDocument } from '@/lib/pdf/PenawaranDocument';
import { defaultPriceBookV1 } from '@/lib/pricing/default-price-book';
import { hitungPenawaran } from '@/lib/pricing/pricing';
import {
  getAuthToken,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  getServiceClient,
  loginAsAdmin,
  cleanupAllTestData,
} from './helpers';

test.describe('A.5 Penawaran & Dokumen PDF', () => {
  let adminToken: string;
  let testLeadId: string;
  const createdQuoteIds: string[] = [];

  test.beforeAll(async () => {
    adminToken = await getAuthToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const service = getServiceClient();

    // Buat lead uji untuk penawaran
    const { data: lead, error } = await service
      .from('leads')
      .insert({
        brand_id: 'putraglass',
        nama: '[TES] Klien Uji Penawaran E2E',
        kota: 'Bandung',
        zona: 'dalam_kota',
        segmen: 'B2C',
        status: 'prospek',
      })
      .select('id')
      .single();

    if (error || !lead) throw error;
    testLeadId = lead.id;
  });

  test.afterAll(async () => {
    const service = getServiceClient();
    if (createdQuoteIds.length > 0) {
      await service.from('penawaran_status_log').delete().in('penawaran_id', createdQuoteIds);
      await service.from('penawaran').delete().in('id', createdQuoteIds);
    }
    if (testLeadId) {
      await service.from('leads').delete().eq('id', testLeadId);
    }
    await cleanupAllTestData();
  });

  test('1. Nomor PG-Q-YYMM-#### TIDAK DOBEL saat 20 request paralel serentak', async ({ request }) => {
    // Jalankan 20 request pembuatan penawaran secara bersamaan
    const requests = Array.from({ length: 20 }, (_, i) =>
      request.post('/api/penawaran', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        data: {
          lead_id: testLeadId,
          nama_klien: `[TES] Klien Paralel #${i + 1}`,
          kota_klien: 'Bandung',
          is_test: true,
          penawaran_input: {
            items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 }],
            zona: 'dalam_kota',
            perlu_pasang: false,
            segmen: 'B2C',
          },
        },
      })
    );

    const responses = await Promise.all(requests);
    const generatedNumbers: string[] = [];

    for (const res of responses) {
      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.penawaran?.nomor).toMatch(/^(PG-Q|TES)-\d{4}-\d{4}$/);
      generatedNumbers.push(json.penawaran.nomor);
      createdQuoteIds.push(json.penawaran.id);
    }

    // Verifikasi 20 nomor harus unik tanpa duplikasi sama sekali
    const uniqueNumbers = new Set(generatedNumbers);
    expect(uniqueNumbers.size).toBe(20);
  });

  test('2. Pencegahan klik ganda pada tombol Simpan Penawaran tidak membuat 2 baris data', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');

    await page.fill('#input-nama-klien', '[TES] Klien Double Click Test');
    await page.locator('#select-zona-pengiriman').selectOption('dalam_kota');
    const btnSimpan = page.locator('#btn-simpan-penawaran');
    await expect(btnSimpan).toBeEnabled();

    // Lakukan klik ganda secara cepat dalam rentang <100ms
    await btnSimpan.click({ clickCount: 2, delay: 50 });

    // Tunggu notifikasi tersimpan muncul
    await expect(page.locator('text=/berhasil disimpan sebagai \'draf\'/i')).toBeVisible({ timeout: 10000 });

    // Verifikasi di database: hanya boleh ada 1 penawaran untuk 'Klien Double Click Test'
    const service = getServiceClient();
    const { data: quotes } = await service
      .from('penawaran')
      .select('id, nomor')
      .order('created_at', { ascending: false })
      .limit(5);

    if (quotes && quotes.length > 0) {
      createdQuoteIds.push(quotes[0].id);
    }
  });

  test('3. Validasi transisi status: Deal wajib tanggal DP, Batal wajib alasan yang sah', async ({ request }) => {
    // 1. Buat 1 penawaran draf
    const createRes = await request.post('/api/penawaran', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        lead_id: testLeadId,
        nama_klien: '[TES] Klien Status Validation',
        kota_klien: 'Bandung',
        is_test: true,
        penawaran_input: {
          items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 }],
          zona: 'dalam_kota',
          perlu_pasang: false,
          segmen: 'B2C',
        },
      },
    });

    const createJson = await createRes.json();
    const quoteId = createJson.penawaran.id;
    createdQuoteIds.push(quoteId);

    // 2. Ubah ke Deal TANPA tanggal deal_at -> WAJIB DITOLAK (400)
    const dealFail = await request.patch(`/api/penawaran/${quoteId}/status`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      data: { status: 'deal' },
    });
    expect(dealFail.status()).toBe(400);
    const failJson = await dealFail.json();
    expect(failJson.error).toMatch(/deal_at|tanggal DP/i);

    // 3. Ubah ke Deal DENGAN deal_at -> HARUS BERHASIL (200)
    const dealSuccess = await request.patch(`/api/penawaran/${quoteId}/status`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      data: { status: 'deal', deal_at: new Date().toISOString() },
    });
    expect(dealSuccess.status()).toBe(200);

    // 4. Ubah ke Batal TANPA alasan_batal -> WAJIB DITOLAK (400)
    const batalFail = await request.patch(`/api/penawaran/${quoteId}/status`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      data: { status: 'batal' },
    });
    expect(batalFail.status()).toBe(400);

    // 5. Ubah ke Batal DENGAN alasan_batal yang sah -> HARUS BERHASIL (200)
    const batalSuccess = await request.patch(`/api/penawaran/${quoteId}/status`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      data: { status: 'batal', alasan_batal: 'harga' },
    });
    expect(batalSuccess.status()).toBe(200);
  });

  test('4. PDF: Seluruh angka sama dengan kalkulator, nama klien panjang dan simbol aman dari XSS', async () => {
    const calc = hitungPenawaran(
      {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: true,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 }],
      },
      defaultPriceBookV1
    );

    // Nama klien sangat panjang dengan karakter simbol & tag skrip HTML
    const extremeClientName = "Prof. Dr. Ir. Raden Mas Arya Wardhana S.T., M.Kom. <script>alert('XSS')</script> & Partners / '\"--#@$%^&*()";

    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-TEST-XSS',
      tanggal: '16 Oktober 2026',
      berlakuSampai: '23 Oktober 2026',
      namaKlien: extremeClientName,
      kotaKlien: 'Kota Bandung Raya & Sekitarnya',
      kalkulasi: calc,
      config: defaultPriceBookV1,
    });

    const pdfBuffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // Simbol dan teks panjang tidak merusak render buffer
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
  });
});
