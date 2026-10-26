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

describe('Sistem Ongkos Kirim Volumetrik ala J&T Cargo', () => {
  const sampleItem = {
    bentuk_kode: 'rectangle',
    panjang_mm: 800,
    lebar_mm: 600,
    lampu: '3_warna' as const,
    kontrol: 'touchscreen' as const,
    antifog: false,
    qty: 1,
  };

  it('16. Menghitung berat volumetrik, chargeable = max(aktual, volumetrik), pembulatan ke atas, dan minimal 11 kg (J&T FastTrack)', () => {
    // P=70cm, L=50cm, T=20cm -> volumetrik = (70*50*20)/5000 = 14 kg. Berat aktual = 8 kg -> chargeable = 14 kg
    const res1 = hitungPenawaran(
      {
        items: [sampleItem],
        zona: 'dalam_kota',
        paket: { panjang_cm: 70, lebar_cm: 50, tinggi_cm: 20, berat_aktual_kg: 8 },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(res1.ongkir.berat_volumetrik).toBe(14);
    expect(res1.ongkir.berat_aktual).toBe(8);
    expect(res1.ongkir.berat_dikenakan).toBe(14);
    expect(res1.ongkir.tarif_per_kg).toBe(2_500); // Rp2.500/kg (Bandung Raya FastTrack)
    expect(res1.ongkir.ongkir_dasar).toBe(14 * 2_500); // Rp35.000

    // Desimal dibulatkan ke atas: 14.1 kg -> 15 kg
    const res2 = hitungPenawaran(
      {
        items: [sampleItem],
        zona: 'dalam_kota',
        paket: { panjang_cm: 70, lebar_cm: 50, tinggi_cm: 20, berat_aktual_kg: 14.1 },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(res2.ongkir.berat_dikenakan).toBe(15);
    expect(res2.ongkir.ongkir_dasar).toBe(15 * 2_500); // Rp37.500

    // Sesuai flyer J&T: FastTrack minimal 11 kg (di bawah 11 kg tetap dikenakan 11 kg)
    const res3 = hitungPenawaran(
      {
        items: [sampleItem],
        zona: 'dki_jakarta',
        paket: { panjang_cm: 10, lebar_cm: 10, tinggi_cm: 10, berat_aktual_kg: 0.2 },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(res3.ongkir.berat_dikenakan).toBe(11);
    expect(res3.ongkir.tarif_per_kg).toBe(3_000); // Rp3.000/kg DKI Jakarta
    expect(res3.ongkir.ongkir_dasar).toBe(11 * 3_000); // Rp33.000
  });

  it('17. Toggle "dibagi dua": aktif (< 50% ditolak) vs nonaktif (0-100% bebas dengan alasan)', () => {
    const paket10kg = { panjang_cm: 50, lebar_cm: 50, tinggi_cm: 20, berat_aktual_kg: 10 }; // 10 kg -> minimal 11 kg luar kota (Rp4.000/kg) -> Rp44.000 dasar

    // Aktif: ongkir deal 20.000 (< 50% dari 44.000 = 22.000) -> error_merah
    const resAktif = hitungPenawaran(
      {
        items: [sampleItem],
        zona: 'luar_kota',
        paket: paket10kg,
        ongkir_deal: 20_000,
        bagi_dua_aktif: true,
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(resAktif.ongkir.status).toBe('error_merah');
    expect(resAktif.ongkir.wewenang).toBe('ditolak');
    expect(resAktif.is_valid_untuk_pdf).toBe(false);

    // Nonaktif: ongkir deal 10.000 (< 50%) dengan alasan -> ok
    const resNonaktif = hitungPenawaran(
      {
        items: [sampleItem],
        zona: 'luar_kota',
        paket: paket10kg,
        ongkir_deal: 10_000,
        alasan_potongan_ongkir: 'Disetujui diskon khusus',
        bagi_dua_aktif: false,
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(resNonaktif.ongkir.status).toBe('ok');
    expect(resNonaktif.ongkir.wewenang).toBe('perlu_alasan');
    expect(resNonaktif.is_valid_untuk_pdf).toBe(true);
  });

  it('18. Biaya tambahan opsional: asuransi 0.2%, packing, dan handling ditambahkan di atas deal secara terpisah', () => {
    // Subtotal cermin 60x80 premium custom: Rp840.000
    const paket10kg = { panjang_cm: 50, lebar_cm: 50, tinggi_cm: 20, berat_aktual_kg: 10 };

    const res = hitungPenawaran(
      {
        items: [sampleItem],
        zona: 'luar_kota',
        paket: paket10kg,
        ongkir_deal: 500_000,
        biaya_tambahan: {
          asuransi_aktif: true,
          biaya_packing: 100_000,
          biaya_handling: 50_000,
        },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );

    // Asuransi = 0.2% * 840.000 = 1.680
    // Total biaya tambahan = 1.680 + 100.000 + 50.000 = 151.680
    // Ongkir final = 500.000 + 151.680 = 651.680
    // Total penawaran = 840.000 + 651.680 = 1.491.680
    expect(res.ongkir.biaya_tambahan.nominal_asuransi).toBe(1_680);
    expect(res.ongkir.biaya_tambahan.total).toBe(151_680);
    expect(res.ongkir.final).toBe(651_680);
    expect(res.total).toBe(840_000 + 651_680);
  });
});
