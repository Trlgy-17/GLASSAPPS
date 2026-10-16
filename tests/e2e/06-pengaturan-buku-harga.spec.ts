import { test, expect } from '@playwright/test';
import React from 'react';
import { renderToBuffer, DocumentProps } from '@react-pdf/renderer';
import { PenawaranDocument } from '@/lib/pdf/PenawaranDocument';
import { defaultPriceBookV1 } from '@/lib/pricing/default-price-book';
import { hitungPenawaran } from '@/lib/pricing/pricing';
import { buildPrompts } from '@/lib/ai/prompt-builder';
import {
  getAuthToken,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  getServiceClient,
} from './helpers';

test.describe('A.6 Pengaturan Buku Harga & Pencegahan Kebocoran Variabel', () => {
  let adminToken: string;
  let initialActiveVersion = 1;

  test.beforeAll(async () => {
    adminToken = await getAuthToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const service = getServiceClient();

    // Catat versi aktif awal
    const { data: currentPb } = await service
      .from('price_books')
      .select('versi')
      .eq('aktif', true)
      .single();

    if (currentPb) {
      initialActiveVersion = currentPb.versi;
    }
  });

  test.afterAll(async () => {
    const service = getServiceClient();
    // Kembalikan versi aktif ke awal
    await service.rpc('activate_price_book', { p_versi: initialActiveVersion });
  });

  test('1. Pembuatan dan pengaktifan buku harga baru tercatat lengkap di audit_log', async ({ request }) => {
    const service = getServiceClient();

    // Buat dan aktifkan buku harga baru via API
    const res = await request.post('/api/buku-harga', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        data_json: {
          ...defaultPriceBookV1,
          catatan_perubahan: 'E2E Test Price Book Update',
        },
        aktifkan_sekarang: true,
        catatan_perubahan: 'E2E Test Price Book Update',
      },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const newVersion = json.price_book.versi;

    // Periksa pencatatan di audit_log
    const { data: auditRows } = await service
      .from('audit_log')
      .select('*')
      .eq('aksi', 'CREATE_PRICE_BOOK')
      .eq('objek', `price_books:v${newVersion}`)
      .order('created_at', { ascending: false })
      .limit(1);

    expect(auditRows).toHaveLength(1);
    expect(auditRows![0].alasan).toBe('E2E Test Price Book Update');
    expect(auditRows![0].sesudah).toBeDefined();

    // Verifikasi buku harga baru berstatus aktif di database
    const { data: activePb } = await service
      .from('price_books')
      .select('versi, aktif')
      .eq('aktif', true)
      .single();

    expect(activePb?.versi).toBe(newVersion);
  });

  test('2. Variabel kosong tidak pernah bocor sebagai "{{...}}" ke AI Prompt Builder', () => {
    // Buku harga dengan variabel dokumen kosong / null
    const emptyVarPriceBook = {
      ...defaultPriceBookV1,
      dokumen_pdf: {
        ...defaultPriceBookV1.dokumen_pdf,
        nama_admin: '',
        bank_nama: '',
        bank_nomor: '',
        kontak_wa_resmi: '',
        kebijakan_ongkir_50: '',
        alamat_workshop: '',
      },
    };

    const built = buildPrompts({
      priceBook: emptyVarPriceBook,
      namaAdmin: '',
      lead: {
        nama: 'Klien Tanpa Variabel',
        kota: 'Bandung',
        zona: 'dalam_kota',
        segmen: 'B2C',
        status: 'prospek',
      },
      transkripMessages: [{ pengirim: 'klien', teks: 'Halo harga cermin berapa ya?' }],
      kanal: 'whatsapp',
    });

    // Verifikasi systemInstruction dan userContext TIDAK mengandung "{{...}}"
    expect(built.systemInstruction).not.toMatch(/\{\{.*?\}\}/);
    expect(built.userContext).not.toMatch(/\{\{.*?\}\}/);
  });

  test('3. Variabel kosong tidak pernah bocor sebagai "{{...}}" ke dokumen PDF', async () => {
    const calc = hitungPenawaran(
      {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 }],
      },
      defaultPriceBookV1
    );

    const emptyVarPriceBook = {
      ...defaultPriceBookV1,
      dokumen_pdf: {
        ...defaultPriceBookV1.dokumen_pdf,
        nama_admin: '',
        bank_nama: '',
        bank_nomor: '',
        bank_atas_nama: '',
        kontak_wa_resmi: '',
        instagram_handle: '',
      },
    };

    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-TEST-EMPTY-VARS',
      tanggal: '16 Oktober 2026',
      berlakuSampai: '23 Oktober 2026',
      namaKlien: 'Klien Uji Empty Vars',
      kotaKlien: 'Bandung',
      kalkulasi: calc,
      config: emptyVarPriceBook,
    });

    const pdfBuffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    const pdfContent = pdfBuffer.toString('latin1');
    expect(pdfContent).not.toMatch(/\{\{.*?\}\}/);
  });
});
