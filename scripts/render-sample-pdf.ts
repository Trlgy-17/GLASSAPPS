import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToFile, renderToBuffer, DocumentProps } from '@react-pdf/renderer';
import { hitungPenawaran } from '../src/lib/pricing/pricing';
import { defaultPriceBookV1 } from '../src/lib/pricing/default-price-book';
import { PenawaranDocument } from '../src/lib/pdf/PenawaranDocument';
import { PenawaranInput } from '../src/types/pricing';

async function main() {
  console.log('Rendering contoh bagian 6 ke docs/hasil-render.pdf...');

  // Contoh Bagian 6 PRD:
  // 1 cermin 60 x 80 cm, Premium, sensor tangan + baterai, antifog, Surabaya (luar kota), tanpa pasang
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
  console.log('Kalkulasi Total:', kalkulasi.total, '| DP:', kalkulasi.dp_50, '| Pelunasan:', kalkulasi.pelunasan);

  const doc = React.createElement(PenawaranDocument, {
    nomor: 'PG-Q-2610-0001',
    tanggal: '16 Oktober 2026',
    berlakuSampai: '23 Okt 2026',
    namaKlien: '[Nama Klien]',
    kotaKlien: 'Surabaya',
    kalkulasi: kalkulasi,
    config: defaultPriceBookV1,
  });

  const outPath = path.resolve('docs/hasil-render.pdf');
  const buffer = await renderToBuffer(doc as unknown as React.ReactElement<DocumentProps>);
  fs.writeFileSync(outPath, buffer);

  console.log(`✅ Berhasil merender ke ${outPath} (${buffer.length} bytes)`);
}

main().catch(console.error);
