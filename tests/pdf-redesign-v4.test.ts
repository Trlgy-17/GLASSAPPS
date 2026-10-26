import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import zlib from 'zlib';
import { renderToBuffer, DocumentProps } from '@react-pdf/renderer';
import { PDFDocument, PDFName } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import jsQR from 'jsqr';
import QRCode from 'qrcode';

import { PenawaranDocument } from '../src/lib/pdf/PenawaranDocument';
import { defaultPriceBookV1 } from '../src/lib/pricing/default-price-book';
import { hitungPenawaran } from '../src/lib/pricing/pricing';
import { DEFAULT_SETTINGS, CompanySettings } from '../src/types/settings';
import { PenawaranInput } from '../src/types/pricing';

// Helper decoding QR langsung dari stream image XObject di dalam file PDF
async function decodeQrFromPdfBuffer(pdfBuffer: Buffer): Promise<string | null> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  for (const page of pdfDoc.getPages()) {
    const resources = page.node.Resources();
    if (!resources) continue;
    const xObject = resources.lookup(PDFName.of('XObject')) as any;
    if (!xObject || !xObject.dict) continue;

    for (const key of Array.from(xObject.dict.keys() as any[])) {
      const stream = xObject.lookup(key) as any;
      if (!stream || !stream.dict) continue;
      const subtype = stream.dict.lookup(PDFName.of('Subtype'))?.value();
      if (subtype !== '/Image') continue;

      const width = stream.dict.lookup(PDFName.of('Width'))?.value();
      const height = stream.dict.lookup(PDFName.of('Height'))?.value();
      if (!width || !height) continue;

      try {
        const decompressed = zlib.inflateSync(stream.getContents());
        if (decompressed.length === width * height * 3) {
          const rgba = new Uint8ClampedArray(width * height * 4);
          for (let i = 0, j = 0; i < decompressed.length; i += 3, j += 4) {
            rgba[j] = decompressed[i];
            rgba[j + 1] = decompressed[i + 1];
            rgba[j + 2] = decompressed[i + 2];
            rgba[j + 3] = 255;
          }
          const code = jsQR(rgba, width, height);
          if (code?.data) {
            return code.data;
          }
        }
      } catch {}
    }
  }
  return null;
}

// Helper ekstraksi teks dari PDF
async function extractTextFromPdfBuffer(pdfBuffer: Buffer) {
  const parser = new PDFParse({ data: pdfBuffer });
  await (parser as any).load();
  return parser.getText();
}

describe('Pengujian Redesign PDF Penawaran (PenawaranDocument.tsx) & Kontak QR', () => {
  it('Kasus (a): Luar kota 3 item - 1 halaman, angka cocok kalkulator, QR ter-decode = maps_url persis', async () => {
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 600,
          lebar_mm: 400,
          sandblast: { pakai: true },
          kontrol: 'touchscreen',
          qty: 1,
        },
        {
          bentuk_kode: 'capsule',
          panjang_mm: 800,
          lebar_mm: 500,
          sandblast: { pakai: true },
          kontrol: 'sensor',
          qty: 1,
        },
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 800,
          lebar_mm: 600,
          lampu: '3_warna',
          kontrol: 'touchscreen',
          antifog: false,
          sandblast: { pakai: false },
          qty: 1,
        },
      ],
      zona: 'luar_kota',
      perlu_pasang: false,
      segmen: 'B2C',
      user_role: 'admin',
    };

    const kalkulasi = hitungPenawaran(input, defaultPriceBookV1);
    const expectedSubtotal = 650_000 + 890_000 + 840_000; // 2.380.000
    const expectedOngkir = 1_300_000;
    const expectedTotal = expectedSubtotal + expectedOngkir; // 3.680.000

    expect(kalkulasi.subtotal_cermin).toBe(expectedSubtotal);
    expect(kalkulasi.ongkir.deal).toBe(expectedOngkir);
    expect(kalkulasi.total).toBe(expectedTotal);
    expect(kalkulasi.dp_50).toBe(Math.ceil(expectedTotal / 2000) * 1000);

    const qrDataUrl = await QRCode.toDataURL(DEFAULT_SETTINGS.maps_url, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 256,
    });

    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-0011',
      tanggal: '17 Oktober 2026',
      berlakuSampai: '24 Okt 2026',
      namaKlien: 'Ibu Ratna',
      kotaKlien: 'Surabaya',
      kalkulasi,
      config: defaultPriceBookV1,
      settings: DEFAULT_SETTINGS,
      qrDataUrl,
      kanal: 'whatsapp',
      namaAdmin: 'Mita (CS)',
    });

    const buffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    const outPath = path.resolve('docs/hasil-penawaran-kasus-a-luar-kota.pdf');
    fs.writeFileSync(outPath, buffer);

    // 1. Cek tepat 1 halaman
    const pdfDoc = await PDFDocument.load(buffer);
    expect(pdfDoc.getPageCount()).toBe(1);

    // 2. Decode QR langsung dari PDF harus persis maps_url
    const decodedUrl = await decodeQrFromPdfBuffer(buffer);
    expect(decodedUrl).toBe(DEFAULT_SETTINGS.maps_url);

    // 3. Cek teks PDF mencantumkan angka kalkulator
    const textData = await extractTextFromPdfBuffer(buffer);
    expect(textData.text).toContain('PG-Q-2610-0011');
    expect(textData.text).toContain('Ibu Ratna');
    expect(textData.text).toContain('Surabaya');
    expect(textData.text).toContain('Rp3.680.000');
    expect(textData.text).toContain('Rp1.840.000');
    expect(textData.text).toContain('2782484011');
    expect(textData.text).toContain('Septiani Sitrulroaeni');
  });

  it('Kasus (b): Dalam kota + ambil sendiri Rp0 - 1 halaman, label ambil sendiri Rp0 cocok', async () => {
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 600,
          lebar_mm: 400,
          sandblast: { pakai: true },
          kontrol: 'touchscreen',
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      ongkir_deal: 0,
      perlu_pasang: false,
      segmen: 'B2C',
      user_role: 'admin',
    };

    const kalkulasi = hitungPenawaran(input, defaultPriceBookV1);
    expect(kalkulasi.subtotal_cermin).toBe(650_000);
    expect(kalkulasi.ongkir.deal).toBe(0);
    expect(kalkulasi.total).toBe(650_000);

    const qrDataUrl = await QRCode.toDataURL(DEFAULT_SETTINGS.maps_url, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 256,
    });

    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-0012',
      tanggal: '17 Oktober 2026',
      berlakuSampai: '24 Okt 2026',
      namaKlien: 'Pak Hendra',
      kotaKlien: 'Kota Bandung',
      kalkulasi,
      config: defaultPriceBookV1,
      settings: DEFAULT_SETTINGS,
      qrDataUrl,
      kanal: 'whatsapp',
      namaAdmin: 'Mita (CS)',
    });

    const buffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    const outPath = path.resolve('docs/hasil-penawaran-kasus-b-ambil-sendiri.pdf');
    fs.writeFileSync(outPath, buffer);

    const pdfDoc = await PDFDocument.load(buffer);
    expect(pdfDoc.getPageCount()).toBe(1);

    const textData = await extractTextFromPdfBuffer(buffer);
    expect(textData.text).toContain('Ongkos kirim (ambil sendiri)');
    expect(textData.text).toContain('Rp650.000');
    expect(textData.text).toContain('Rp325.000');
  });

  it('Kasus (c): Ongkir dibagi dua - 1 halaman, label ongkir dibagi dua Rp650.000 cocok', async () => {
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 800,
          lebar_mm: 600,
          lampu: '3_warna',
          kontrol: 'touchscreen',
          antifog: false,
          sandblast: { pakai: false },
          qty: 1,
        },
      ],
      zona: 'luar_kota',
      ongkir_deal: 650_000,
      alasan_potongan_ongkir: 'Klien deal proyek minta bagi dua',
      konfirmasi_owner: {
        ongkir: { sudah_dikonfirmasi: true, alasan: 'Klien deal proyek minta bagi dua' },
      },
      segmen: 'B2C',
      perlu_pasang: false,
      user_role: 'admin',
    };

    const kalkulasi = hitungPenawaran(input, defaultPriceBookV1);
    expect(kalkulasi.subtotal_cermin).toBe(840_000);
    expect(kalkulasi.ongkir.deal).toBe(650_000);
    expect(kalkulasi.total).toBe(840_000 + 650_000); // 1.490.000

    const qrDataUrl = await QRCode.toDataURL(DEFAULT_SETTINGS.maps_url, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 256,
    });

    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-0013',
      tanggal: '17 Oktober 2026',
      berlakuSampai: '24 Okt 2026',
      namaKlien: 'Bapak Surya',
      kotaKlien: 'Semarang',
      kalkulasi,
      config: defaultPriceBookV1,
      settings: DEFAULT_SETTINGS,
      qrDataUrl,
      kanal: 'whatsapp',
      namaAdmin: 'Admin Putra Glass',
    });

    const buffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    const outPath = path.resolve('docs/hasil-penawaran-kasus-c-ongkir-dibagi-dua.pdf');
    fs.writeFileSync(outPath, buffer);

    const pdfDoc = await PDFDocument.load(buffer);
    expect(pdfDoc.getPageCount()).toBe(1);

    const textData = await extractTextFromPdfBuffer(buffer);
    expect(textData.text).toContain('Ongkos kirim (ongkir dibagi dua)');
    expect(textData.text).toContain('Rp1.490.000');
    expect(textData.text).toContain('Rp745.000');
  });

  it('Kasus (d): 12 item - tepat 2 halaman, pita kontak hanya di halaman 2, header ringkas di halaman 2', async () => {
    const shapes = ['rectangle', 'capsule', 'oval', 'leaf', 'hex', 'round'];
    const items = Array.from({ length: 12 }).map((_, i) => ({
      bentuk_kode: shapes[i % shapes.length],
      panjang_mm: 600 + (i % 3) * 100,
      lebar_mm: 400 + (i % 2) * 100,
      lampu: '3_warna' as const,
      kontrol: 'touchscreen' as const,
      antifog: false,
      sandblast: { pakai: false },
      qty: 1,
    }));

    const input: PenawaranInput = {
      items,
      zona: 'luar_kota',
      perlu_pasang: false,
      segmen: 'B2C',
      user_role: 'admin',
    };

    const kalkulasi = hitungPenawaran(input, defaultPriceBookV1);

    const qrDataUrl = await QRCode.toDataURL(DEFAULT_SETTINGS.maps_url, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 256,
    });

    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-0014',
      tanggal: '17 Oktober 2026',
      berlakuSampai: '24 Okt 2026',
      namaKlien: 'Hotel Grand Bandung',
      kotaKlien: 'Bandung',
      kalkulasi,
      config: defaultPriceBookV1,
      settings: DEFAULT_SETTINGS,
      qrDataUrl,
      kanal: 'whatsapp',
      namaAdmin: 'Mita (CS)',
    });

    const buffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    const outPath = path.resolve('docs/hasil-penawaran-kasus-12-item.pdf');
    fs.writeFileSync(outPath, buffer);

    // 1. Tepat 2 halaman
    const pdfDoc = await PDFDocument.load(buffer);
    expect(pdfDoc.getPageCount()).toBe(2);

    // 2. Periksa teks per halaman
    const textData = await extractTextFromPdfBuffer(buffer);
    expect(textData.pages).toHaveLength(2);

    // Halaman 1 ada keterangan berlanjut
    expect(textData.pages[0].text).toContain('Penawaran berlanjut ke Halaman 2');
    expect(textData.pages[0].text).toContain('Hal. 1 / 2');

    // Halaman 2 ada header ringkas dan pita bawah kontak
    expect(textData.pages[1].text).toContain('Lanjutan Penawaran');
    expect(textData.pages[1].text).toContain('WORKSHOP');
    expect(textData.pages[1].text).toContain('HUBUNGI KAMI');
    expect(textData.pages[1].text).toContain('Hal. 2 / 2');

    // Halaman 1 TIDAK mengandung pita kontak (pita hanya di halaman terakhir)
    expect(textData.pages[0].text).not.toContain('HUBUNGI KAMI');
  });

  it('Kasus (e): Varian Marketplace (TikTok/Shopee) - tidak ada rekening, wa, qr, maps, atau medsos', async () => {
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 600,
          lebar_mm: 400,
          sandblast: { pakai: true },
          kontrol: 'touchscreen',
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
      user_role: 'admin',
    };

    const kalkulasi = hitungPenawaran(input, defaultPriceBookV1);

    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-0015',
      tanggal: '17 Oktober 2026',
      berlakuSampai: '24 Okt 2026',
      namaKlien: 'Buyer TikTok',
      kotaKlien: 'Jakarta',
      kalkulasi,
      config: defaultPriceBookV1,
      settings: DEFAULT_SETTINGS,
      kanal: 'tiktok',
      namaAdmin: 'Mita (CS)',
    });

    const buffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    const outPath = path.resolve('docs/hasil-penawaran-marketplace.pdf');
    fs.writeFileSync(outPath, buffer);

    const textData = await extractTextFromPdfBuffer(buffer);
    const pdfText = textData.text;

    // 1. Kartu transfer diganti info marketplace
    expect(pdfText).toContain('Pembayaran melalui platform marketplace');

    // 2. Tidak boleh ada rekening, no WA, link maps, wa.me, ig, tiktok
    expect(pdfText).not.toContain('2782484011');
    expect(pdfText).not.toContain('812-3753');
    expect(pdfText).not.toContain('maps.app');
    expect(pdfText).not.toContain('wa.me');
    expect(pdfText).not.toContain('instagram.com');
    expect(pdfText).not.toContain('tiktok.com');
  });

  it('Kasus (f): Ubah nomor WA di Pengaturan -> PDF baru langsung ikut berubah', async () => {
    const customSettings: CompanySettings = {
      ...DEFAULT_SETTINGS,
      whatsapp: '+62 899-1234-5678',
    };

    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 600,
          lebar_mm: 400,
          sandblast: { pakai: true },
          kontrol: 'touchscreen',
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
      user_role: 'admin',
    };

    const kalkulasi = hitungPenawaran(input, defaultPriceBookV1);

    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-0016',
      tanggal: '17 Oktober 2026',
      berlakuSampai: '24 Okt 2026',
      namaKlien: 'Klien Dinamis',
      kotaKlien: 'Bandung',
      kalkulasi,
      config: defaultPriceBookV1,
      settings: customSettings,
      kanal: 'whatsapp',
      namaAdmin: 'Mita (CS)',
    });

    const buffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    const textData = await extractTextFromPdfBuffer(buffer);

    expect(textData.text).toContain('+62 899-1234-5678');
    expect(textData.text).not.toContain('812-3753-3173');
  });

  it('Kasus (g): PDF penawaran sesudah nego memuat angka negosiasi, subtotal sebelum nego, dan selisih diskon', async () => {
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 800,
          lebar_mm: 600,
          lampu: '3_warna',
          kontrol: 'touchscreen',
          antifog: false,
          sandblast: { pakai: false },
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
      user_role: 'admin',
    };

    const kalkulasi = hitungPenawaran(input, defaultPriceBookV1);
    // Simulasi penawaran setelah nego disetujui
    const nilaiSebelumNego = kalkulasi.total; // e.g. 840.000 + 750.000 = 1.590.000
    const nilaiNego = 1_450_000;
    const kalkulasiNego = {
      ...kalkulasi,
      total: nilaiNego,
      dp_50: Math.ceil(nilaiNego / 2000) * 1000,
      pelunasan: nilaiNego - Math.ceil(nilaiNego / 2000) * 1000,
    };

    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-0664',
      tanggal: '26 Oktober 2026',
      berlakuSampai: '2 November 2026',
      namaKlien: 'Ibu Riri',
      kotaKlien: 'Bandung',
      kalkulasi: kalkulasiNego,
      config: defaultPriceBookV1,
      kanal: 'whatsapp',
      namaAdmin: 'Admin Putra Glass',
      nego: {
        nilai_sebelum_nego: nilaiSebelumNego,
        nilai_nego: nilaiNego,
        selisih: nilaiSebelumNego - nilaiNego,
        tipe_nego: 'Kesepakatan',
        catatan_nego: 'Diskon deal DP hari ini disetujui',
      },
    });

    const buffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    const textData = await extractTextFromPdfBuffer(buffer);

    // Memastikan angka negosiasi dan catatan tampil di teks PDF
    expect(textData.text).toContain('TOTAL SETELAH NEGO');
    expect(textData.text).toContain('Subtotal sebelum nego');
    expect(textData.text).toContain('Penyesuaian nego');
    expect(textData.text).toContain('Diskon deal DP hari ini disetujui');
  });
});
