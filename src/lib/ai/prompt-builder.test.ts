import { describe, it, expect } from 'vitest';
import { buildPrompts } from './prompt-builder';
import { defaultPriceBookV1 } from '../pricing/default-price-book';

describe('Prompt Builder & Keamanan Prompt (prompt-builder.ts)', () => {
  const baseParams = {
    priceBook: defaultPriceBookV1,
    namaAdmin: 'Mita',
    lead: {
      nama: 'Ibu Ratna',
      kota: 'Surabaya',
      zona: 'luar_kota' as const,
      segmen: 'B2C' as const,
      status: 'aktif',
      keberatanTerakhir: 'anggaran dan ongkir',
    },
    kanal: 'whatsapp',
    kalkulatorOutputJson: JSON.stringify({ total: 2590000, dp: 1295000 }),
    transkripMessages: [
      { pengirim: 'klien', waktu: '10:00', teks: 'Halo Kak, cermin 60x80 berapa ya?' },
      { pengirim: 'admin', waktu: '10:01', teks: 'Halo Bu Ratna, untuk ukuran 60x80 premium Rp840.000' },
      { pengirim: 'klien', waktu: '10:05', teks: 'Kalau kirim ke Surabaya plus sensor baterai totalnya berapa?' },
    ],
  };

  it('1. Tidak ada placeholder {{...}} yang tersisa di system prompt maupun context', () => {
    const { systemInstruction, userContext } = buildPrompts(baseParams);

    expect(systemInstruction).not.toMatch(/\{\{[^}]+\}\}/);
    expect(userContext).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('2. Keamanan Mutlak: batas_owner dan harga net B2B (Rp1.350.000) TIDAK PERNAH masuk ke prompt', () => {
    const { systemInstruction, userContext } = buildPrompts(baseParams);
    const combined = systemInstruction + ' ' + userContext;

    // 1.350.000 (net B2B owner)
    expect(combined).not.toContain('1.350.000');
    expect(combined).not.toContain('1350000');

    // 375.000 (batas owner ongkir Bandung)
    expect(combined).not.toContain('375.000');
    expect(combined).not.toContain('375000');
  });

  it('3. Lead B2B: tabel tingkat masuk jika ada, tetapi harga net owner tetap tidak bocor', () => {
    const b2bParams = {
      ...baseParams,
      lead: {
        ...baseParams.lead,
        segmen: 'B2B' as const,
      },
      priceBook: {
        ...defaultPriceBookV1,
        tingkat_b2b: [
          { min_unit: 5, max_unit: 10, tarif_m2: 1_600_000, wewenang: 'admin' as const },
        ],
      },
    };

    const { systemInstruction } = buildPrompts(b2bParams);
    expect(systemInstruction).toContain('Rp1.600.000/m2');
    expect(systemInstruction).not.toContain('1.350.000');
  });

  it('4. System prompt meletakkan instruksi statis di depan agar implicit prompt caching bekerja', () => {
    const { systemInstruction, userContext } = buildPrompts(baseParams);

    // System instruction diawali dengan PERAN
    expect(systemInstruction.trim().startsWith('# PERAN')).toBe(true);
    // User context memuat tanggal dan transkrip dinamis
    expect(userContext).toContain('<transkrip>');
  });
});
