import { describe, it, expect } from 'vitest';
import { hitungPenawaran } from './pricing';
import { defaultPriceBookV1 } from './default-price-book';
import { PenawaranInput } from '@/types/pricing';

describe('Pengujian Kalkulator CS App: 15 Kasus Referensi', () => {
  function hitungItem(
    p_mm: number,
    l_mm: number,
    lampu: '3_warna' | '1_warna',
    kontrol: 'touchscreen' | 'sensor_baterai',
    antifog: boolean,
    bentuk_kode: string = 'rectangle',
    qty: number = 1
  ): number {
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode,
          panjang_mm: p_mm,
          lebar_mm: l_mm,
          lampu,
          kontrol,
          antifog,
          qty,
        },
      ],
      perlu_pasang: false,
      segmen: 'B2C',
      user_role: 'admin',
    };

    const out = hitungPenawaran(input, defaultPriceBookV1);
    return out.items[0].harga_satuan_item;
  }

  it('1. 35x50 cm, LED 3 warna, touchscreen -> Rp650.000 (minimum custom)', () => {
    expect(hitungItem(500, 350, '3_warna', 'touchscreen', false)).toBe(650_000);
  });

  it('2. 60x80 cm, LED 3 warna, touchscreen, antifog -> Rp1.040.000 (Baseline Wajib)', () => {
    expect(hitungItem(800, 600, '3_warna', 'touchscreen', true)).toBe(1_040_000);
  });

  it('3. Round D60 cm, LED 3 warna, touchscreen -> Rp650.000 (SKU katalog)', () => {
    expect(hitungItem(600, 600, '3_warna', 'touchscreen', false, 'round')).toBe(650_000);
  });

  it('4. Oval 50x80 cm, LED 3 warna, touchscreen -> Rp700.000 (SKU katalog)', () => {
    expect(hitungItem(800, 500, '3_warna', 'touchscreen', false, 'oval')).toBe(700_000);
  });

  it('5. 60x80 cm, LED 1 warna, touchscreen -> Rp745.000 (Basic rate)', () => {
    expect(hitungItem(800, 600, '1_warna', 'touchscreen', false)).toBe(745_000);
  });

  it('6. 60x80 cm, LED 3 warna, sensor tangan + baterai -> Rp1.090.000', () => {
    expect(hitungItem(800, 600, '3_warna', 'sensor_baterai', false)).toBe(1_090_000);
  });

  it('7. 100x200 cm (200 cm), LED 3 warna, touchscreen -> Rp3.500.000 (Maksimal)', () => {
    expect(hitungItem(2000, 1000, '3_warna', 'touchscreen', false)).toBe(3_500_000);
  });

  it('8. 40x60 cm, LED 3 warna, touchscreen -> Rp600.000 (SKU katalog)', () => {
    expect(hitungItem(600, 400, '3_warna', 'touchscreen', false)).toBe(600_000);
  });

  it('9. 50x70 cm, LED 3 warna, touchscreen, antifog -> Rp850.000', () => {
    expect(hitungItem(700, 500, '3_warna', 'touchscreen', true)).toBe(850_000);
  });

  it('10. 70x100 cm, LED 3 warna, sensor tangan + baterai, antifog -> Rp1.675.000', () => {
    expect(hitungItem(1000, 700, '3_warna', 'sensor_baterai', true)).toBe(1_675_000);
  });

  it('11. 80x120 cm, LED 1 warna, touchscreen -> Rp1.490.000', () => {
    expect(hitungItem(1200, 800, '1_warna', 'touchscreen', false)).toBe(1_490_000);
  });

  it('12. 90x60 cm, LED 3 warna, touchscreen -> Rp945.000', () => {
    expect(hitungItem(900, 600, '3_warna', 'touchscreen', false)).toBe(945_000);
  });

  it('13. 120x70 cm, LED 3 warna, touchscreen -> Rp1.470.000', () => {
    expect(hitungItem(1200, 700, '3_warna', 'touchscreen', false, 'capsule')).toBe(1_470_000);
  });

  it('14. 150x80 cm, LED 3 warna, touchscreen, antifog -> Rp2.300.000', () => {
    expect(hitungItem(1500, 800, '3_warna', 'touchscreen', true)).toBe(2_300_000);
  });

  it('15. 60x80 cm, LED 1 warna, sensor tangan + baterai, antifog -> Rp1.195.000', () => {
    expect(hitungItem(800, 600, '1_warna', 'sensor_baterai', true)).toBe(1_195_000);
  });
});
