import { describe, it, expect } from 'vitest';
import { parseRupiah, formatRupiah, formatRupiahDigits } from './format-rupiah';
import { hitungPenawaran } from './pricing';
import { defaultPriceBookV1 } from './default-price-book';

describe('Parser dan Formatter Rupiah (format-rupiah.ts)', () => {
  it('1. Parsing "1.300.000" menghasilkan integer 1300000', () => {
    expect(parseRupiah('1.300.000')).toBe(1_300_000);
  });

  it('2. Parsing "1300000" menghasilkan integer 1300000', () => {
    expect(parseRupiah('1300000')).toBe(1_300_000);
  });

  it('3. Parsing "Rp 1.300.000" menghasilkan integer 1300000', () => {
    expect(parseRupiah('Rp 1.300.000')).toBe(1_300_000);
  });

  it('4. Parsing kosong atau whitespace menghasilkan default value (harga list)', () => {
    const listOngkir = 1_300_000;
    expect(parseRupiah('', listOngkir)).toBe(1_300_000);
    expect(parseRupiah('   ', listOngkir)).toBe(1_300_000);
    expect(parseRupiah(undefined, listOngkir)).toBe(1_300_000);
    expect(parseRupiah(null, listOngkir)).toBe(1_300_000);
  });

  it('5. Parsing "6" menghasilkan integer 6 dan ditolak di bawah batas, BUKAN dibaca 6 juta', () => {
    const parsed = parseRupiah('6');
    expect(parsed).toBe(6);

    // Diuji ke mesin harga: 6 rupiah harus menghasilkan error_merah karena jauh di bawah batas owner
    const res = hitungPenawaran(
      {
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 }],
        zona: 'luar_kota',
        ongkir_deal: parsed, // 6 rupiah
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(res.ongkir.status).toBe('error_merah');
    expect(res.ongkir.pesan).toMatch(/minimal Rp/i);
    expect(res.is_valid_untuk_pdf).toBe(false);
  });
  it('6. Formatter rupiah menghasilkan format Rp1.300.000 tanpa spasi', () => {
    expect(formatRupiah(1_300_000)).toBe('Rp1.300.000');
    expect(formatRupiah(2_590_000)).toBe('Rp2.590.000');
    expect(formatRupiahDigits(1_300_000)).toBe('1.300.000');
  });
});
