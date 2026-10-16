import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToBuffer, DocumentProps } from '@react-pdf/renderer';
import { hitungPenawaran } from '../src/lib/pricing/pricing';
import { defaultPriceBookV1 } from '../src/lib/pricing/default-price-book';
import { PenawaranDocument } from '../src/lib/pdf/PenawaranDocument';
import { PenawaranInput } from '../src/types/pricing';

describe('Render PDF Contoh Bagian 6', () => {
  it('Merender PDF penawaran contoh bagian 6 ke docs/hasil-render.pdf', async () => {
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 600,
          lebar_mm: 800,
          lampu: '3_warna',
          kontrol: 'sensor_baterai',
          antifog: true,
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
    expect(kalkulasi.total).toBe(2_590_000);
    expect(kalkulasi.dp_50).toBe(1_295_000);
    expect(kalkulasi.pelunasan).toBe(1_295_000);

    const doc = React.createElement(PenawaranDocument, {
      nomor: 'PG-Q-2610-0001',
      tanggal: '16 Oktober 2026',
      berlakuSampai: '23 Okt 2026',
      namaKlien: '[Nama Klien]',
      kotaKlien: 'Surabaya',
      kalkulasi,
      config: defaultPriceBookV1,
    });

    const buffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
    const outPath = path.resolve('docs/hasil-render.pdf');
    fs.writeFileSync(outPath, buffer);

    expect(fs.existsSync(outPath)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    console.log(`✓ Render PDF berhasil: ${outPath} (${buffer.length} bytes)`);
  });
});
