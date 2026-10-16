import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { hitungPenawaran } from '../src/lib/pricing/pricing';
import { defaultPriceBookV1 } from '../src/lib/pricing/default-price-book';
import { PenawaranDocument } from '../src/lib/pdf/PenawaranDocument';
import { renderToBuffer, DocumentProps } from '@react-pdf/renderer';
import { executeUnifiedDraft } from '../src/lib/ai/provider';
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

describe('Uji Pencocokan Angka: Produk Jadi vs Custom (Kalkulator, Draf AI, & PDF)', () => {
  it('1. Penawaran Produk Jadi (Rectangle 40x60 ST Sandblast) angka cocok di semua media', async () => {
    // 1. Kalkulator Mesin Harga
    const calc = hitungPenawaran(
      {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [
          {
            bentuk_kode: 'rectangle',
            panjang_mm: 600,
            lebar_mm: 400,
            sandblast: { pakai: true },
            kontrol: 'sensor',
            qty: 1,
          },
        ],
      },
      defaultPriceBookV1
    );

    expect(calc.items[0].is_sku).toBe(true);
    expect(calc.items[0].sku_kode).toBe('RECTANGLE-40x60-SB-ST');
    expect(calc.items[0].harga_cermin).toBe(755_000);
    expect(calc.ongkir.deal).toBe(750_000);
    expect(calc.total).toBe(1_505_000);
    expect(calc.dp_50).toBe(753_000);
    expect(calc.pelunasan).toBe(752_000);

    // 2. Render PDF
    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-TEST-SKU',
      tanggal: '16 Oktober 2026',
      berlakuSampai: '23 Oktober 2026',
      namaKlien: 'Budi (SKU Produk Jadi)',
      kotaKlien: 'Bandung',
      kalkulasi: calc,
      config: defaultPriceBookV1,
    });
    const pdfBuffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    fs.writeFileSync('docs/hasil-penawaran-sku.pdf', pdfBuffer);
    expect(fs.existsSync('docs/hasil-penawaran-sku.pdf')).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // 3. Draf AI
    const aiRes = await executeUnifiedDraft({
      screenshots: [],
      pastedText: 'Halo saya mau pesan model jadi Rectangle 40x60 ST pakai sensor tangan dan sandblast kirim ke Bandung berapa totalnya?',
      overrideKanal: 'whatsapp',
      priceBook: defaultPriceBookV1,
      modelName: 'gemini-3.6-flash',
      thinkingLevel: ThinkingLevel.MINIMAL,
    });
    const drafText = (aiRes.draf.draf?.[0]?.bubbles || []).join('\n\n');
    console.log('\n[Draf AI Produk Jadi Output]:\n', drafText);

    expect(drafText).toContain('755.000');
    expect(drafText).toContain('1.505.000');
    expect(aiRes.draf.angka_tidak_terverifikasi).toBe(false);
  }, 35000);

  it('2. Penawaran Custom (60x80 cm LED 3 Warna Premium) angka cocok di semua media', async () => {
    // 1. Kalkulator Mesin Harga
    const calc = hitungPenawaran(
      {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [
          {
            bentuk_kode: 'rectangle',
            panjang_mm: 600,
            lebar_mm: 800,
            lampu: '3_warna',
            kontrol: 'touchscreen',
            frame: 'tanpa',
            qty: 1,
          },
        ],
      },
      defaultPriceBookV1
    );

    expect(calc.items[0].is_sku).toBe(false);
    expect(calc.items[0].luas_m2_display).toBe(0.48);
    expect(calc.items[0].harga_cermin).toBe(840_000);
    expect(calc.ongkir.deal).toBe(750_000);
    expect(calc.total).toBe(1_590_000);
    expect(calc.dp_50).toBe(795_000);
    expect(calc.pelunasan).toBe(795_000);

    // 2. Render PDF
    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-TEST-CUSTOM',
      tanggal: '16 Oktober 2026',
      berlakuSampai: '23 Oktober 2026',
      namaKlien: 'Rina (Custom Ukuran)',
      kotaKlien: 'Bandung',
      kalkulasi: calc,
      config: defaultPriceBookV1,
    });
    const pdfBuffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    fs.writeFileSync('docs/hasil-penawaran-custom.pdf', pdfBuffer);
    expect(fs.existsSync('docs/hasil-penawaran-custom.pdf')).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // 3. Draf AI
    const aiRes = await executeUnifiedDraft({
      screenshots: [],
      pastedText: 'Halo mau custom cermin ukuran 60x80 cm paket LED 3 warna premium touch screen kirim ke Bandung berapa ya totalnya?',
      overrideKanal: 'whatsapp',
      priceBook: defaultPriceBookV1,
      modelName: 'gemini-3.6-flash',
      thinkingLevel: ThinkingLevel.MINIMAL,
    });
    const drafText = (aiRes.draf.draf?.[0]?.bubbles || []).join('\n\n');
    console.log('\n[Draf AI Custom Output]:\n', drafText);

    expect(drafText).toContain('840.000');
    expect(drafText).toContain('1.590.000');
    expect(aiRes.draf.angka_tidak_terverifikasi).toBe(false);
  }, 35000);
});
