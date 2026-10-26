import { describe, it, expect } from 'vitest';
import { hitungPenawaran } from './pricing';
import { defaultPriceBookV1 } from './default-price-book';
import { PriceBookData, PenawaranInput } from '@/types/pricing';

describe('Mesin Harga Putra Glass (pricing.ts)', () => {
  // =========================================================================
  // 1. Contoh Hitung Bagian 6 (Baseline Mutlak)
  // =========================================================================
  it('1. Contoh Bagian 6: 1 cermin 60x80 cm Premium, sensor+baterai, antifog, Surabaya (luar kota), tanpa pasang -> Rp2.590.000', () => {
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 600, // 60 cm
          lebar_mm: 800,   // 80 cm
          lampu: '3_warna',
          kontrol: 'sensor_baterai', // +Rp250.000
          antifog: true,             // +Rp200.000
          sandblast: { pakai: false },
          qty: 1,
        },
      ],
      zona: 'luar_kota', // Pengiriman luar kota list = Rp1.300.000
      perlu_pasang: false,
      segmen: 'B2C',
      user_role: 'admin',
    };

    const hasil = hitungPenawaran(input, defaultPriceBookV1);

    expect(hasil.items).toHaveLength(1);
    const item = hasil.items[0];

    // Luas = 0.48 m2, tarif Premium B2C = 1.750.000 -> 0.48 * 1.750.000 = 840.000
    expect(item.luas_m2_display).toBe(0.48);
    expect(item.harga_cermin).toBe(840_000);

    // Add-on breakdown
    expect(item.add_on_breakdown).toEqual([
      {
        kode: 'sensor_baterai',
        label: 'Sensor Tangan + Baterai',
        harga_satuan: 250_000,
        total: 250_000,
      },
      {
        kode: 'antifog',
        label: 'Antifog Pad',
        harga_satuan: 200_000,
        total: 200_000,
      },
    ]);

    // Subtotal cermin: 840.000 + 250.000 + 200.000 = 1.290.000
    expect(item.harga_satuan_item).toBe(1_290_000);
    expect(hasil.subtotal_cermin).toBe(1_290_000);

    // Ongkir luar kota = 1.300.000
    expect(hasil.ongkir.list).toBe(1_300_000);
    expect(hasil.ongkir.deal).toBe(1_300_000);
    expect(hasil.pasang.deal).toBe(0);

    // Total = 1.290.000 + 1.300.000 = 2.590.000
    expect(hasil.total).toBe(2_590_000);

    // DP 50% = 1.295.000, Pelunasan = 1.295.000
    expect(hasil.dp_50).toBe(1_295_000);
    expect(hasil.pelunasan).toBe(1_295_000);
  });

  // =========================================================================
  // 2. Katalog SKU Lookup vs Rumus Custom
  // =========================================================================
  it('2. Katalog SKU Lookup: Capsule 60x40 sandblast kabel -> Rp650.000; Custom 120x70 -> per m2', () => {
    // 2a. SKU Katalog
    const inputSku: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'capsule',
          panjang_mm: 600,
          lebar_mm: 400,
          kontrol: 'touchscreen',
          sandblast: { pakai: true, lebar_mm: 30, jarak_tepi_mm: 20 },
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
    };
    const resSku = hitungPenawaran(inputSku, defaultPriceBookV1);
    expect(resSku.items[0].is_sku).toBe(true);
    expect(resSku.items[0].sku_kode).toBe('CAPSULE-40x60-SB-TC');
    expect(resSku.items[0].harga_cermin).toBe(650_000);

    // 2b. Custom 120x70 cm (1200x700 mm) = 0.84 m2 * 1.750.000 = 1.470.000
    const inputCustom: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'capsule',
          panjang_mm: 1200,
          lebar_mm: 700,
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
    };
    const resCustom = hitungPenawaran(inputCustom, defaultPriceBookV1);
    expect(resCustom.items[0].is_sku).toBe(false);
    expect(resCustom.items[0].harga_cermin).toBe(1_470_000);
  });

  // =========================================================================
  // 3. Harga Minimum per Item (Custom 35x50 cm) vs SKU Katalog
  // =========================================================================
  it('3. Harga minimum hanya berlaku untuk custom: 35x50 cm naik ke Rp650.000; SKU 30x45 tetap Rp570.000', () => {
    // Custom 35x50 cm: 0.175 m2 * 1.750.000 = 306.250 -> dibulatkan 310.000 -> naik ke minimum 650.000
    const inputCustomKecil: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 350,
          lebar_mm: 500,
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
    };
    const resCustomKecil = hitungPenawaran(inputCustomKecil, defaultPriceBookV1);
    expect(resCustomKecil.items[0].is_sku).toBe(false);
    expect(resCustomKecil.items[0].harga_cermin_raw).toBe(310_000);
    expect(resCustomKecil.items[0].harga_cermin).toBe(650_000);

    // SKU Katalog 30x45 cm tanpa sandblast seharga Rp570.000 (tidak dipaksa naik ke 650.000)
    const inputSkuKecil: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 450,
          lebar_mm: 300,
          sandblast: { pakai: true },
          kontrol: 'touchscreen',
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
    };
    const resSkuKecil = hitungPenawaran(inputSkuKecil, defaultPriceBookV1);
    expect(resSkuKecil.items[0].is_sku).toBe(true);
    expect(resSkuKecil.items[0].sku_kode).toBe('RECTANGLE-30x45-SB-TC');
    expect(resSkuKecil.items[0].harga_cermin).toBe(570_000);
  });

  // =========================================================================
  // 4. Pembulatan Nyata Cermin
  // =========================================================================
  it('4. Pembulatan cermin: custom 65x75 cm (4875 cm2 * 1.750.000 = 853.125) -> Rp855.000', () => {
    // 650x750 mm = 0.4875 m2 * 1.750.000 = 853.125 -> ceil kelipatan 5.000 = 855.000
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 650,
          lebar_mm: 750,
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
    };

    const res = hitungPenawaran(input, defaultPriceBookV1);
    expect(res.items[0].harga_cermin_raw).toBe(855_000);
    expect(res.items[0].harga_cermin).toBe(855_000);
  });

  // =========================================================================
  // 5. DP Ganjil & Pelunasan Eksak
  // =========================================================================
  it('5. DP Ganjil: total Rp1.185.000 -> DP Rp593.000, pelunasan Rp592.000', () => {
    // Custom cermin 35x50 cm (min Rp650.000) + Ongkir deal Rp535.000 = Rp1.185.000
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 350,
          lebar_mm: 500,
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      ongkir_deal: 535_000, // Di atas batas admin 500.000, valid tanpa approval
      perlu_pasang: false,
      segmen: 'B2C',
    };

    const res = hitungPenawaran(input, defaultPriceBookV1);
    expect(res.total).toBe(1_185_000);
    // dp = ceil(1.185.000 / 2000) * 1000 = 593 * 1000 = 593.000
    expect(res.dp_50).toBe(593_000);
    // pelunasan = 1.185.000 - 593.000 = 592.000
    expect(res.pelunasan).toBe(592_000);
    expect(res.dp_50 + res.pelunasan).toBe(res.total);
  });

  // =========================================================================
  // 6. Varian Basic Otomatis
  // =========================================================================
  it('6. Varian Basic: lampu 1_warna ATAU kontrol saklar -> tarif Basic Rp1.550.000/m2', () => {
    // 6a. 1_warna
    const input1Warna: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 1000,
          lebar_mm: 1000, // 1 m2 * 1.550.000 = 1.550.000
          lampu: '1_warna',
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
    };
    const res1Warna = hitungPenawaran(input1Warna, defaultPriceBookV1);
    expect(res1Warna.items[0].varian).toBe('basic');
    expect(res1Warna.items[0].tarif_m2_dipakai).toBe(1_550_000);
    expect(res1Warna.items[0].harga_cermin).toBe(1_550_000);

    // 6b. Saklar
    const inputSaklar: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 1000,
          lebar_mm: 1000,
          lampu: '3_warna',
          kontrol: 'saklar',
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
    };
    const resSaklar = hitungPenawaran(inputSaklar, defaultPriceBookV1);
    expect(resSaklar.items[0].varian).toBe('basic');
    expect(resSaklar.items[0].tarif_m2_dipakai).toBe(1_550_000);
    expect(resSaklar.items[0].harga_cermin).toBe(1_550_000);
    // 6c. Touchscreen + Baterai -> tarif Rp1.850.000/m2
    const inputTouchscreenBaterai: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 1000,
          lebar_mm: 1000,
          lampu: '3_warna',
          kontrol: 'touchscreen_baterai',
          qty: 1,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
    };
    const resTB = hitungPenawaran(inputTouchscreenBaterai, defaultPriceBookV1);
    expect(resTB.items[0].tarif_m2_dipakai).toBe(1_850_000);
    expect(resTB.items[0].harga_cermin).toBe(1_850_000);
  });
  // =========================================================================
  // 7. Multi-Item & Total Unit Dihitung per Penawaran
  // =========================================================================
  it('7. Multi-Item: 2 item berbeda + total unit (qty 1 + qty 2 = 3 unit) dihitung per penawaran', () => {
    const input: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 1000,
          lebar_mm: 500, // 0.5 m2 * 1.750.000 = 875.000
          qty: 1,
        },
        {
          bentuk_kode: 'round',
          panjang_mm: 850,
          lebar_mm: 850, // 0.7225 m2 * 1.750.000 = 1.264.375 -> dibulatkan 1.265.000
          qty: 2,        // 2 * 1.265.000 = 2.530.000
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2C',
    };

    const res = hitungPenawaran(input, defaultPriceBookV1);
    expect(res.items).toHaveLength(2);
    expect(res.total_unit).toBe(3);
    // 875.000 + 2.530.000 = 3.405.000
    expect(res.subtotal_cermin).toBe(3_405_000);
  });

  // =========================================================================
  // 8. Segmen B2B: Tingkat Kosong vs Tingkat Terisi
  // =========================================================================
  it('8. Segmen B2B: tabel tingkat kosong -> harga list Rp1.750.000/m2; terisi -> tarif tingkat', () => {
    // 8a. Tabel tingkat kosong (default v1)
    const inputB2BDefault: PenawaranInput = {
      items: [
        {
          bentuk_kode: 'rectangle',
          panjang_mm: 1000,
          lebar_mm: 1000,
          qty: 5,
        },
      ],
      zona: 'dalam_kota',
      perlu_pasang: false,
      segmen: 'B2B',
    };
    const resB2BDefault = hitungPenawaran(inputB2BDefault, defaultPriceBookV1);
    expect(resB2BDefault.items[0].tarif_m2_dipakai).toBe(1_750_000);

    // 8b. Tabel tingkat terisi (misal >= 5 unit tarif 1.600.000)
    const configB2BTier: PriceBookData = {
      ...defaultPriceBookV1,
      tingkat_b2b: [
        {
          min_unit: 5,
          max_unit: 10,
          tarif_m2: 1_600_000,
          wewenang: 'admin',
        },
      ],
    };
    const resB2BTier = hitungPenawaran(inputB2BDefault, configB2BTier);
    expect(resB2BTier.items[0].tarif_m2_dipakai).toBe(1_600_000);
    expect(resB2BTier.items[0].harga_cermin).toBe(1_600_000);
  });

  // =========================================================================
  // 9. Validasi Sandblast
  // =========================================================================
  it('9. Sandblast: lebar 2-5 cm & tepi 1-5 cm lolos; di luar itu ditolak', () => {
    // 9a. Lolos (lebar 30 mm = 3 cm, tepi 20 mm = 2 cm)
    expect(() =>
      hitungPenawaran(
        {
          items: [
            {
              bentuk_kode: 'rectangle',
              panjang_mm: 1000,
              lebar_mm: 1000,
              sandblast: { pakai: true, lebar_mm: 30, jarak_tepi_mm: 20 },
              qty: 1,
            },
          ],
          zona: 'dalam_kota',
          perlu_pasang: false,
          segmen: 'B2C',
        },
        defaultPriceBookV1
      )
    ).not.toThrow();

    // 9b. Lebar 10 mm (1 cm) -> ditolak
    expect(() =>
      hitungPenawaran(
        {
          items: [
            {
              bentuk_kode: 'rectangle',
              panjang_mm: 1000,
              lebar_mm: 1000,
              sandblast: { pakai: true, lebar_mm: 10, jarak_tepi_mm: 20 },
              qty: 1,
            },
          ],
          zona: 'dalam_kota',
          perlu_pasang: false,
          segmen: 'B2C',
        },
        defaultPriceBookV1
      )
    ).toThrow(/Lebar sandblast/);

    // 9c. Lebar 60 mm (6 cm) -> ditolak
    expect(() =>
      hitungPenawaran(
        {
          items: [
            {
              bentuk_kode: 'rectangle',
              panjang_mm: 1000,
              lebar_mm: 1000,
              sandblast: { pakai: true, lebar_mm: 60, jarak_tepi_mm: 20 },
              qty: 1,
            },
          ],
          zona: 'dalam_kota',
          perlu_pasang: false,
          segmen: 'B2C',
        },
        defaultPriceBookV1
      )
    ).toThrow(/Lebar sandblast/);
  });

  // =========================================================================
  // 10. Validasi Frame Aluminium (Master Bentuk)
  // =========================================================================
  it('10. Frame Aluminium: Rectangle siku lolos (+Rp400.000); Oval ditolak dengan error deskriptif', () => {
    // 10a. Rectangle siku lolos
    const resRect = hitungPenawaran(
      {
        items: [
          {
            bentuk_kode: 'rectangle',
            panjang_mm: 1000,
            lebar_mm: 1000,
            frame: 'aluminium',
            qty: 1,
          },
        ],
        zona: 'dalam_kota',
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(resRect.items[0].add_on_breakdown).toContainEqual(
      expect.objectContaining({ kode: 'frame_aluminium', total: 400_000 })
    );

    // 10b. Oval ditolak
    expect(() =>
      hitungPenawaran(
        {
          items: [
            {
              bentuk_kode: 'oval',
              panjang_mm: 1000,
              lebar_mm: 1000,
              frame: 'aluminium',
              qty: 1,
            },
          ],
          zona: 'dalam_kota',
          perlu_pasang: false,
          segmen: 'B2C',
        },
        defaultPriceBookV1
      )
    ).toThrow(/Frame aluminium hanya tersedia untuk bentuk persegi\/persegi panjang bersudut siku/);
  });

  // =========================================================================
  // 11. Batas Nego Pasang Bandung & Persetujuan Server
  // =========================================================================
  it('11. Pasang Bandung: Rp500.000 lolos admin; Rp400.000 ditolak tanpa konfirmasi/alasan, lolos dgn konfirmasi+alasan; Rp299.000 ditolak mutlak', () => {
    // 11a. Admin Rp500.000 (batas_admin = 500.000) -> lolos
    const resAdminOk = hitungPenawaran(
      {
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 1000, lebar_mm: 1000, qty: 1 }],
        zona: 'dalam_kota',
        perlu_pasang: true,
        pasang_deal: 500_000,
        segmen: 'B2C',
        user_role: 'admin',
      },
      defaultPriceBookV1
    );
    expect(resAdminOk.pasang.deal).toBe(500_000);

    // 11b. Admin Rp400.000 tanpa konfirmasi owner -> warning kuning & is_valid_untuk_pdf false
    const resNoConfirm = hitungPenawaran(
      {
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 1000, lebar_mm: 1000, qty: 1 }],
        zona: 'dalam_kota',
        perlu_pasang: true,
        pasang_deal: 400_000,
        segmen: 'B2C',
        user_role: 'admin',
      },
      defaultPriceBookV1
    );
    expect(resNoConfirm.pasang.status).toBe('warning_kuning');
    expect(resNoConfirm.pasang.pesan).toBe('Di bawah batas admin. Konfirmasi owner?');
    expect(resNoConfirm.is_valid_untuk_pdf).toBe(false);

    // 11c. Admin Rp400.000 dengan checkbox tapi alasan kosong -> tetap warning kuning
    const resEmptyReason = hitungPenawaran(
      {
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 1000, lebar_mm: 1000, qty: 1 }],
        zona: 'dalam_kota',
        perlu_pasang: true,
        pasang_deal: 400_000,
        segmen: 'B2C',
        user_role: 'admin',
        konfirmasi_owner: {
          pasang: {
            sudah_dikonfirmasi: true,
            alasan: '   ', // kosong
          },
        },
      },
      defaultPriceBookV1
    );
    expect(resEmptyReason.pasang.status).toBe('warning_kuning');
    expect(resEmptyReason.is_valid_untuk_pdf).toBe(false);

    // 11d. Admin Rp400.000 DENGAN konfirmasi owner + alasan sah -> lolos
    const resWithConfirmation = hitungPenawaran(
      {
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 1000, lebar_mm: 1000, qty: 1 }],
        zona: 'dalam_kota',
        perlu_pasang: true,
        pasang_deal: 400_000,
        segmen: 'B2C',
        user_role: 'admin',
        konfirmasi_owner: {
          pasang: {
            sudah_dikonfirmasi: true,
            alasan: 'Disetujui owner karena klien DP hari ini',
          },
        },
      },
      defaultPriceBookV1
    );
    expect(resWithConfirmation.pasang.deal).toBe(400_000);
    expect(resWithConfirmation.pasang.dikonfirmasi_owner).toBe(true);
    expect(resWithConfirmation.pasang.alasan).toBe('Disetujui owner karena klien DP hari ini');

    // 11e. Siapa pun (termasuk owner) isi Rp299.000 (di bawah batas owner 300.000) -> status merah
    const resBelowOwner = hitungPenawaran(
      {
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 1000, lebar_mm: 1000, qty: 1 }],
        zona: 'dalam_kota',
        perlu_pasang: true,
        pasang_deal: 299_000,
        segmen: 'B2C',
        user_role: 'owner',
        konfirmasi_owner: {
          pasang: {
            sudah_dikonfirmasi: true,
            alasan: 'Owner override',
          },
        },
      },
      defaultPriceBookV1
    );
    expect(resBelowOwner.pasang.status).toBe('error_merah');
    expect(resBelowOwner.pasang.pesan).toContain('Minimal Rp300.000');
    expect(resBelowOwner.is_valid_untuk_pdf).toBe(false);
  });

  // =========================================================================
  // 12. Add-on Tak Terdaftar -> Error perlu_owner
  // =========================================================================
  it('12. Add-on tak terdaftar: minta logo_custom -> throw error perlu_owner, bukan Rp0', () => {
    expect(() =>
      hitungPenawaran(
        {
          items: [
            {
              bentuk_kode: 'rectangle',
              panjang_mm: 1000,
              lebar_mm: 1000,
              add_ons_lain: ['logo_custom'],
              qty: 1,
            },
          ],
          zona: 'dalam_kota',
          perlu_pasang: false,
          segmen: 'B2C',
        },
        defaultPriceBookV1
      )
    ).toThrow(/perlu_owner: Add-on 'logo_custom'/);
  });

  // =========================================================================
  // 13. Immutability Versi Buku Harga & Validasi Ukuran
  // =========================================================================
  it('13. Versi Buku Harga & Validasi Ukuran: v1 tetap Rp840.000 saat v2 tarif Rp2.000.000; ukuran <= 0 error', () => {
    const itemInput = {
      bentuk_kode: 'rectangle',
      panjang_mm: 600,
      lebar_mm: 800,
      qty: 1,
    };

    // 13a. Hitung di V1
    const resV1 = hitungPenawaran(
      {
        items: [itemInput],
        zona: 'dalam_kota',
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(resV1.items[0].harga_cermin).toBe(840_000);

    // 13b. Hitung di V2 (tarif dinaikkan ke Rp2.000.000)
    const priceBookV2: PriceBookData = {
      ...defaultPriceBookV1,
      versi: 2,
      tarif_m2: {
        ...defaultPriceBookV1.tarif_m2,
        premium_b2c: 2_000_000,
      },
    };
    const resV2 = hitungPenawaran(
      {
        items: [itemInput],
        zona: 'dalam_kota',
        perlu_pasang: false,
        segmen: 'B2C',
      },
      priceBookV2
    );
    // 0.48 * 2.000.000 = 960.000
    expect(resV2.items[0].harga_cermin).toBe(960_000);

    // Penawaran lama yang disimpan dengan V1 tetap 840.000
    expect(resV1.items[0].harga_cermin).toBe(840_000);

    // 13c. Validasi ukuran negatif / nol
    expect(() =>
      hitungPenawaran(
        {
          items: [{ bentuk_kode: 'rectangle', panjang_mm: 0, lebar_mm: 800, qty: 1 }],
          zona: 'dalam_kota',
          perlu_pasang: false,
          segmen: 'B2C',
        },
        defaultPriceBookV1
      )
    ).toThrow(/lebih besar dari 0/);

    expect(() =>
      hitungPenawaran(
        {
          items: [{ bentuk_kode: 'rectangle', panjang_mm: 3500, lebar_mm: 800, qty: 1 }],
          zona: 'dalam_kota',
          perlu_pasang: false,
          segmen: 'B2C',
        },
        defaultPriceBookV1
      )
    ).toThrow(/Dimensi maksimal produksi/);
  });

  // =========================================================================
  // 14. Tambahan Tes SKU Katalog untuk Kontrol Sensor (ST) dan Baterai (BT)
  // =========================================================================
  it('14. SKU Katalog ST & BT: Rectangle 40x60 Sensor (ST) -> Rp755.000; Capsule 60x40 Baterai (BT) -> Rp850.000', () => {
    // 14a. SKU ST: Rectangle 40x60 sandblast sensor tangan (ST) di katalog = Rp755.000
    const resSt = hitungPenawaran(
      {
        items: [
          {
            bentuk_kode: 'rectangle',
            panjang_mm: 400,
            lebar_mm: 600,
            kontrol: 'sensor',
            sandblast: { pakai: true },
            qty: 1,
          },
        ],
        zona: 'dalam_kota',
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(resSt.items[0].is_sku).toBe(true);
    expect(resSt.items[0].sku_kode).toBe('RECTANGLE-40x60-SB-ST');
    expect(resSt.items[0].harga_cermin).toBe(755_000);
    expect(resSt.items[0].add_on_breakdown).toHaveLength(0);
    expect(resSt.items[0].harga_satuan_item).toBe(755_000);

    // 14b. SKU BT: Capsule 60x40 sandblast baterai (BT) di katalog = Rp850.000
    const resBt = hitungPenawaran(
      {
        items: [
          {
            bentuk_kode: 'capsule',
            panjang_mm: 600,
            lebar_mm: 400,
            kontrol: 'baterai',
            sandblast: { pakai: true },
            qty: 1,
          },
        ],
        zona: 'dalam_kota',
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(resBt.items[0].is_sku).toBe(true);
    expect(resBt.items[0].sku_kode).toBe('CAPSULE-40x60-SB-BT');
    expect(resBt.items[0].harga_cermin).toBe(850_000);
    expect(resBt.items[0].harga_satuan_item).toBe(850_000);
  });

  // =========================================================================
  // 15. Kasus Ongkir Luar Kota (Batas Admin 1.150.000, Batas Owner 650.000)
  // =========================================================================
  it('15. Ongkir Luar Kota: 1.150.000 (lolos), 900.000 + konfirmasi (lolos), 900.000 tanpa konfirmasi (total tampil, simpan ditolak), 650.000 + konfirmasi (lolos), 600.000 (merah/ditolak, batas owner 650.000)', () => {
    const baseItem = { bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 };

    // 15a. Ongkir 1.150.000 (lolos)
    const res1150 = hitungPenawaran(
      {
        items: [baseItem],
        zona: 'luar_kota',
        ongkir_deal: 1_150_000,
        alasan_potongan_ongkir: 'Diskon wewenang admin',
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(res1150.ongkir.deal).toBe(1_150_000);
    expect(res1150.ongkir.status).toBe('ok');
    expect(res1150.is_valid_untuk_pdf).toBe(true);

    // 15b. Ongkir 900.000 + konfirmasi (lolos)
    const res900Ok = hitungPenawaran(
      {
        items: [baseItem],
        zona: 'luar_kota',
        ongkir_deal: 900_000,
        alasan_potongan_ongkir: 'Promo proyek langganan',
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(res900Ok.ongkir.deal).toBe(900_000);
    expect(res900Ok.ongkir.status).toBe('ok');
    expect(res900Ok.ongkir.wewenang).toBe('perlu_alasan');
    expect(res900Ok.is_valid_untuk_pdf).toBe(true);
    // 15c. Ongkir 900.000 TANPA konfirmasi (simpan ditolak / is_valid_untuk_pdf: false, total tetap tampil!)
    const res900NoConfirm = hitungPenawaran(
      {
        items: [baseItem],
        zona: 'luar_kota',
        ongkir_deal: 900_000,
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(res900NoConfirm.ongkir.deal).toBe(900_000);
    expect(res900NoConfirm.ongkir.wewenang).toBe('perlu_alasan');
    expect(res900NoConfirm.is_valid_untuk_pdf).toBe(false);
    expect(res900NoConfirm.total).toBe(840_000 + 900_000); // Total tetap dihitung!

    // 15d. Ongkir 650.000 + konfirmasi (lolos - tepat di batas 50%)
    const res650Ok = hitungPenawaran(
      {
        items: [baseItem],
        zona: 'luar_kota',
        ongkir_deal: 650_000,
        alasan_potongan_ongkir: 'Ongkir maksimal dibagi 2 disetujui admin',
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(res650Ok.ongkir.deal).toBe(650_000);
    expect(res650Ok.ongkir.status).toBe('ok');
    expect(res650Ok.ongkir.wewenang).toBe('perlu_alasan');
    expect(res650Ok.is_valid_untuk_pdf).toBe(true);

    // 15e. Ongkir 600.000 (ditolak / status merah di bawah 50%)
    const res600Error = hitungPenawaran(
      {
        items: [baseItem],
        zona: 'luar_kota',
        ongkir_deal: 600_000,
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(res600Error.ongkir.deal).toBe(600_000);
    expect(res600Error.ongkir.status).toBe('error_merah');
    expect(res600Error.ongkir.wewenang).toBe('ditolak');
    expect(res600Error.ongkir.pesan).toContain('Ongkir maksimal dibagi dua, klien bayar minimal Rp650.000.');
    expect(res600Error.is_valid_untuk_pdf).toBe(false);
    expect(res600Error.total).toBe(840_000 + 600_000);
  });

  // =========================================================================
  // 16. Unit Test: 10 Kombinasi Aturan Ongkir Baru
  // =========================================================================
  it('16. 10 Kombinasi Aturan Ongkir Baru: Dalam/Luar/Kota Jauh x List/Net/Di Antara/50%/Di Bawah 50%', () => {
    const item = { bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 };

    // 1. Dalam Kota = List (Rp750.000) -> normal
    const k1 = hitungPenawaran({ items: [item], zona: 'dalam_kota', perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k1.ongkir.wewenang).toBe('normal');
    expect(k1.ongkir.status).toBe('ok');
    expect(k1.is_valid_untuk_pdf).toBe(true);

    // 2. Dalam Kota di antara list dan net (Rp600.000) tanpa alasan -> perlu_alasan, tidak boleh simpan
    const k2 = hitungPenawaran({ items: [item], zona: 'dalam_kota', ongkir_deal: 600_000, perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k2.ongkir.wewenang).toBe('perlu_alasan');
    expect(k2.ongkir.perlu_alasan).toBe(true);
    expect(k2.ongkir.perlu_konfirmasi).toBe(false); // Tanpa izin owner!
    expect(k2.is_valid_untuk_pdf).toBe(false);

    // 3. Dalam Kota di antara list dan net (Rp600.000) + alasan admin -> lolos tanpa izin owner
    const k3 = hitungPenawaran({ items: [item], zona: 'dalam_kota', ongkir_deal: 600_000, alasan_potongan_ongkir: 'Promo pembukaan', perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k3.ongkir.wewenang).toBe('perlu_alasan');
    expect(k3.ongkir.status).toBe('ok');
    expect(k3.ongkir.dikonfirmasi_owner).toBe(false);
    expect(k3.is_valid_untuk_pdf).toBe(true);

    // 4. Dalam Kota = Net (Rp500.000) + alasan admin -> lolos wewenang admin
    const k4 = hitungPenawaran({ items: [item], zona: 'dalam_kota', ongkir_deal: 500_000, alasan_potongan_ongkir: 'Batas net admin', perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k4.ongkir.wewenang).toBe('perlu_alasan');
    expect(k4.ongkir.status).toBe('ok');
    expect(k4.is_valid_untuk_pdf).toBe(true);

    // 5. Dalam Kota di bawah net (Rp400.000) tanpa alasan -> perlu_alasan, ditolak
    const k5 = hitungPenawaran({ items: [item], zona: 'dalam_kota', ongkir_deal: 400_000, perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k5.ongkir.wewenang).toBe('perlu_alasan');
    expect(k5.ongkir.perlu_alasan).toBe(true);
    expect(k5.is_valid_untuk_pdf).toBe(false);

    // 6. Dalam Kota 50% Floor (Rp375.000) + alasan admin -> lolos
    const k6 = hitungPenawaran({
      items: [item],
      zona: 'dalam_kota',
      ongkir_deal: 375_000,
      alasan_potongan_ongkir: 'Disetujui admin bagi dua',
      perlu_pasang: false,
      segmen: 'B2C',
    }, defaultPriceBookV1);
    expect(k6.ongkir.wewenang).toBe('perlu_alasan');
    expect(k6.ongkir.status).toBe('ok');
    expect(k6.is_valid_untuk_pdf).toBe(true);

    // 7. Dalam Kota di bawah 50% (Rp350.000) -> ditolak status merah
    const k7 = hitungPenawaran({ items: [item], zona: 'dalam_kota', ongkir_deal: 350_000, perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k7.ongkir.wewenang).toBe('ditolak');
    expect(k7.ongkir.status).toBe('error_merah');
    expect(k7.ongkir.pesan).toContain('Ongkir maksimal dibagi dua, klien bayar minimal Rp375.000.');
    expect(k7.is_valid_untuk_pdf).toBe(false);
    expect(k7.total).toBe(840_000 + 350_000); // Total tetap tampil!

    // 8. Luar Kota = List (Rp1.300.000) -> normal
    const k8 = hitungPenawaran({ items: [item], zona: 'luar_kota', perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k8.ongkir.wewenang).toBe('normal');
    expect(k8.is_valid_untuk_pdf).toBe(true);

    // 9. Luar Kota = Net (Rp1.150.000) + alasan admin -> lolos wewenang admin
    const k9 = hitungPenawaran({ items: [item], zona: 'luar_kota', ongkir_deal: 1_150_000, alasan_potongan_ongkir: 'Diskon admin luar kota', perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k9.ongkir.wewenang).toBe('perlu_alasan');
    expect(k9.ongkir.status).toBe('ok');
    expect(k9.is_valid_untuk_pdf).toBe(true);

    // 10. Luar Kota di bawah net s/d 50% (Rp900.000) + alasan admin -> lolos
    const k10 = hitungPenawaran({
      items: [item],
      zona: 'luar_kota',
      ongkir_deal: 900_000,
      alasan_potongan_ongkir: 'Admin approve luar kota',
      perlu_pasang: false,
      segmen: 'B2C',
    }, defaultPriceBookV1);
    expect(k10.ongkir.wewenang).toBe('perlu_alasan');
    expect(k10.ongkir.status).toBe('ok');
    expect(k10.is_valid_untuk_pdf).toBe(true);

    // 11. Kota Jauh Aktual (Rp2.000.000) Deal = List -> normal
    const k11 = hitungPenawaran({ items: [item], zona: 'luar_kota', ongkir_aktual: 2_000_000, ongkir_deal: 2_000_000, perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k11.ongkir.wewenang).toBe('normal');
    expect(k11.ongkir.list).toBe(2_000_000);
    expect(k11.is_valid_untuk_pdf).toBe(true);

    // 12. Kota Jauh Aktual (Rp2.000.000) dipotong ke 1.500.000 tanpa alasan -> perlu_alasan
    const k12 = hitungPenawaran({ items: [item], zona: 'luar_kota', ongkir_aktual: 2_000_000, ongkir_deal: 1_500_000, perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k12.ongkir.wewenang).toBe('perlu_alasan');
    expect(k12.ongkir.perlu_alasan).toBe(true);
    expect(k12.is_valid_untuk_pdf).toBe(false);

    // 13. Kota Jauh Aktual (Rp2.000.000) 50% Floor (Rp1.000.000) + alasan admin -> lolos
    const k13 = hitungPenawaran({
      items: [item],
      zona: 'luar_kota',
      ongkir_aktual: 2_000_000,
      ongkir_deal: 1_000_000,
      alasan_potongan_ongkir: 'Bagi dua ekspedisi jauh disetujui admin',
      perlu_pasang: false,
      segmen: 'B2C',
    }, defaultPriceBookV1);
    expect(k13.ongkir.wewenang).toBe('perlu_alasan');
    expect(k13.ongkir.status).toBe('ok');
    expect(k13.is_valid_untuk_pdf).toBe(true);

    // 14. Kota Jauh Aktual (Rp2.000.000) di bawah 50% (Rp800.000) -> ditolak status merah
    const k14 = hitungPenawaran({ items: [item], zona: 'luar_kota', ongkir_aktual: 2_000_000, ongkir_deal: 800_000, perlu_pasang: false, segmen: 'B2C' }, defaultPriceBookV1);
    expect(k14.ongkir.wewenang).toBe('ditolak');
    expect(k14.ongkir.status).toBe('error_merah');
    expect(k14.ongkir.pesan).toContain('Ongkir maksimal dibagi dua, klien bayar minimal Rp1.000.000.');
    expect(k14.is_valid_untuk_pdf).toBe(false);
    expect(k14.total).toBe(840_000 + 800_000);
  });

  // =========================================================================
  // 17. Sistem Volumetrik ala J&T Cargo
  // =========================================================================
  it('17. Sistem Volumetrik ala J&T Cargo: Volumetrik, Chargeable, Pembulatan ke Atas, Minimal 11 kg, Tarif Zona FastTrack & MaxTrack', () => {
    const item = { bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 };

    // 17a. Berat volumetrik > aktual: P=100cm, L=80cm, T=15cm -> (100*80*15)/5000 = 24 kg. Berat aktual = 10 kg -> Chargeable = 24 kg.
    // Luar kota tarif Rp4.000/kg -> ongkir dasar = 24 * 4.000 = Rp96.000
    const k1 = hitungPenawaran(
      {
        items: [item],
        zona: 'luar_kota',
        paket: { panjang_cm: 100, lebar_cm: 80, tinggi_cm: 15, berat_aktual_kg: 10 },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(k1.ongkir.berat_volumetrik).toBe(24);
    expect(k1.ongkir.berat_aktual).toBe(10);
    expect(k1.ongkir.berat_dikenakan).toBe(24);
    expect(k1.ongkir.tarif_per_kg).toBe(4_000);
    expect(k1.ongkir.ongkir_dasar).toBe(96_000);
    expect(k1.ongkir.list).toBe(96_000);
    expect(k1.ongkir.deal).toBe(96_000);
    expect(k1.ongkir.final).toBe(96_000);

    // 17b. Berat aktual > volumetrik: P=50cm, L=40cm, T=10cm -> 20000/5000 = 4 kg. Berat aktual = 15 kg -> Chargeable = 15 kg.
    // Dalam kota (Bandung Raya) tarif Rp2.500/kg -> ongkir dasar = 15 * 2.500 = Rp37.500
    const k2 = hitungPenawaran(
      {
        items: [item],
        zona: 'dalam_kota',
        paket: { panjang_cm: 50, lebar_cm: 40, tinggi_cm: 10, berat_aktual_kg: 15 },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(k2.ongkir.berat_volumetrik).toBe(4);
    expect(k2.ongkir.berat_aktual).toBe(15);
    expect(k2.ongkir.berat_dikenakan).toBe(15);
    expect(k2.ongkir.tarif_per_kg).toBe(2_500);
    expect(k2.ongkir.ongkir_dasar).toBe(37_500);
    expect(k2.ongkir.deal).toBe(37_500);

    // 17c. Pembulatan ke atas (Math.ceil): contoh 16,2 kg -> 17 kg
    // P=90, L=60, T=15 -> 81.000 / 5000 = 16.2 kg. Berat aktual = 12 kg -> Chargeable = 17 kg.
    const k3 = hitungPenawaran(
      {
        items: [item],
        zona: 'luar_kota',
        paket: { panjang_cm: 90, lebar_cm: 60, tinggi_cm: 15, berat_aktual_kg: 12 },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(k3.ongkir.berat_volumetrik).toBe(16.2);
    expect(k3.ongkir.berat_dikenakan).toBe(17);
    expect(k3.ongkir.ongkir_dasar).toBe(17 * 4_000); // 68.000

    // 17d. Pembulatan ke atas & aturan FastTrack minimal 11 kg
    const k4 = hitungPenawaran(
      {
        items: [item],
        zona: 'dalam_kota',
        paket: { panjang_cm: 20, lebar_cm: 20, tinggi_cm: 5, berat_aktual_kg: 4.1 },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(k4.ongkir.berat_volumetrik).toBe(0.4);
    expect(k4.ongkir.berat_dikenakan).toBe(11); // Minimal 11 kg FastTrack
    expect(k4.ongkir.ongkir_dasar).toBe(11 * 2_500); // 27.500

    // 17e. Sesuai Image #1: Dalam Kota, input berat aktual 20 kg -> Chargeable 20 kg -> Dasar Rp50.000
    const kImage1 = hitungPenawaran(
      {
        items: [item],
        zona: 'dalam_kota',
        paket: { panjang_cm: 0, lebar_cm: 0, tinggi_cm: 0, berat_aktual_kg: 20 },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(kImage1.ongkir.berat_volumetrik).toBe(0);
    expect(kImage1.ongkir.berat_dikenakan).toBe(20);
    expect(kImage1.ongkir.tarif_per_kg).toBe(2_500);
    expect(kImage1.ongkir.ongkir_dasar).toBe(50_000);

    // 17f. MaxTrack Khusus Pulau Jawa (>100 kg, >300 kg, >500 kg)
    const kMax100 = hitungPenawaran(
      {
        items: [item],
        zona: 'dki_jakarta',
        paket: { panjang_cm: 100, lebar_cm: 100, tinggi_cm: 60, berat_aktual_kg: 120 }, // 120 kg
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(kMax100.ongkir.berat_dikenakan).toBe(120);
    expect(kMax100.ongkir.tarif_per_kg).toBe(1_875); // >100 kg DKI Jakarta Rp1.875/kg
    expect(kMax100.ongkir.ongkir_dasar).toBe(120 * 1_875); // 225.000

    const kMax300 = hitungPenawaran(
      {
        items: [item],
        zona: 'dki_jakarta',
        paket: { panjang_cm: 0, lebar_cm: 0, tinggi_cm: 0, berat_aktual_kg: 350 }, // 350 kg
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(kMax300.ongkir.tarif_per_kg).toBe(1_750); // >300 kg DKI Jakarta Rp1.750/kg
    expect(kMax300.ongkir.ongkir_dasar).toBe(350 * 1_750);

    const kMax500 = hitungPenawaran(
      {
        items: [item],
        zona: 'dki_jakarta',
        paket: { panjang_cm: 0, lebar_cm: 0, tinggi_cm: 0, berat_aktual_kg: 600 }, // 600 kg
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(kMax500.ongkir.tarif_per_kg).toBe(1_500); // >500 kg DKI Jakarta Rp1.500/kg
    expect(kMax500.ongkir.ongkir_dasar).toBe(600 * 1_500);
  });

  // =========================================================================
  // 18. Fitur "Dibagi Dua" Opsional: Aktif vs Nonaktif
  // =========================================================================
  it('18. Fitur "Dibagi Dua" Opsional: Default Aktif (< 50% ditolak) vs Nonaktif (Bebas 0 - 100% wajib alasan)', () => {
    const item = { bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 };
    // Paket 20 kg luar kota -> ongkir dasar = 20 * 4.000 = Rp80.000. 50% = Rp40.000
    const paket20kg = { panjang_cm: 100, lebar_cm: 50, tinggi_cm: 20, berat_aktual_kg: 10 }; // (100*50*20)/5000 = 20 kg

    // 18a. AKTIF (default / bagi_dua_aktif: true): deal Rp30.000 (< 50% dari 80.000 = 40.000) -> Ditolak / error merah
    const kAktifDitolak = hitungPenawaran(
      {
        items: [item],
        zona: 'luar_kota',
        paket: paket20kg,
        ongkir_deal: 30_000,
        bagi_dua_aktif: true,
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(kAktifDitolak.ongkir.wewenang).toBe('ditolak');
    expect(kAktifDitolak.ongkir.status).toBe('error_merah');
    expect(kAktifDitolak.ongkir.pesan).toContain('Ongkir maksimal dibagi dua, klien bayar minimal Rp40.000.');
    expect(kAktifDitolak.is_valid_untuk_pdf).toBe(false);

    // 18b. AKTIF: deal Rp50.000 (antara 50% - 100%) + alasan -> Lolos
    const kAktifLolos = hitungPenawaran(
      {
        items: [item],
        zona: 'luar_kota',
        paket: paket20kg,
        ongkir_deal: 50_000,
        alasan_potongan_ongkir: 'Disetujui diskon kargo',
        bagi_dua_aktif: true,
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(kAktifLolos.ongkir.deal).toBe(50_000);
    expect(kAktifLolos.ongkir.status).toBe('ok');
    expect(kAktifLolos.is_valid_untuk_pdf).toBe(true);

    // 18c. NONAKTIF (bagi_dua_aktif: false): deal Rp20.000 (< 50% dari 80.000) + alasan -> Lolos tanpa batas 50%
    const kNonaktifLolos = hitungPenawaran(
      {
        items: [item],
        zona: 'luar_kota',
        paket: paket20kg,
        ongkir_deal: 20_000,
        alasan_potongan_ongkir: 'Promo subsidi ongkir penuh dari toko',
        bagi_dua_aktif: false,
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(kNonaktifLolos.ongkir.wewenang).toBe('perlu_alasan');
    expect(kNonaktifLolos.ongkir.status).toBe('ok');
    expect(kNonaktifLolos.is_valid_untuk_pdf).toBe(true);
    expect(kNonaktifLolos.ongkir.deal).toBe(20_000);
    // 18d. NONAKTIF: deal Rp0 (ambil sendiri / gratis ongkir) + alasan -> Lolos
    const kNonaktifRp0 = hitungPenawaran(
      {
        items: [item],
        zona: 'luar_kota',
        paket: paket20kg,
        ongkir_deal: 0,
        alasan_potongan_ongkir: 'Gratis ongkir event pameran',
        bagi_dua_aktif: false,
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(kNonaktifRp0.ongkir.wewenang).toBe('perlu_alasan');
    expect(kNonaktifRp0.ongkir.status).toBe('ok');
    expect(kNonaktifRp0.is_valid_untuk_pdf).toBe(true);
    expect(kNonaktifRp0.ongkir.deal).toBe(0);

    // 18e. NONAKTIF: deal di bawah dasar tanpa alasan -> warning kuning (tidak boleh simpan PDF)
    const kNonaktifTanpaAlasan = hitungPenawaran(
      {
        items: [item],
        zona: 'luar_kota',
        paket: paket20kg,
        ongkir_deal: 20_000,
        bagi_dua_aktif: false,
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(kNonaktifTanpaAlasan.ongkir.wewenang).toBe('perlu_alasan');
    expect(kNonaktifTanpaAlasan.ongkir.status).toBe('warning_kuning');
    expect(kNonaktifTanpaAlasan.is_valid_untuk_pdf).toBe(false);
  });

  // =========================================================================
  // 19. Biaya Tambahan: Asuransi 0.2%, Packing, Handling
  // =========================================================================
  it('19. Biaya Tambahan: Asuransi 0.2%, Packing, Handling pass-through tidak kena diskon 50%', () => {
    const item = { bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 };
    // Cermin custom 60x80 (0.48 m2 * 1.750.000 = Rp840.000)
    const paket10kg = { panjang_cm: 50, lebar_cm: 50, tinggi_cm: 20, berat_aktual_kg: 5 }; // 10 kg luar kota -> Rp500.000

    // 19a. Asuransi aktif (0.2% dari subtotal cermin 840.000 = 1.680 -> dibulatkan 1.680)
    // + Packing Rp75.000 + Handling Rp50.000 = Total Biaya Tambahan Rp126.680
    // Ongkir deal = Rp400.000 (dengan alasan)
    // Ongkir final = Rp400.000 + Rp126.680 = Rp526.680
    // Total = subtotal 840.000 + ongkir final 526.680 = Rp1.366.680
    const k1 = hitungPenawaran(
      {
        items: [item],
        zona: 'luar_kota',
        paket: paket10kg,
        ongkir_deal: 400_000,
        alasan_potongan_ongkir: 'Diskon admin',
        bagi_dua_aktif: false,
        biaya_tambahan: {
          asuransi_aktif: true,
          biaya_packing: 75_000,
          biaya_handling: 50_000,
        },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(k1.subtotal_cermin).toBe(840_000);
    expect(k1.ongkir.biaya_tambahan.asuransi_aktif).toBe(true);
    expect(k1.ongkir.biaya_tambahan.nilai_barang).toBe(840_000);
    expect(k1.ongkir.biaya_tambahan.nominal_asuransi).toBe(1_680); // Math.round(840.000 * 0.002)
    expect(k1.ongkir.biaya_tambahan.biaya_packing).toBe(75_000);
    expect(k1.ongkir.biaya_tambahan.biaya_handling).toBe(50_000);
    expect(k1.ongkir.biaya_tambahan.total).toBe(1_680 + 75_000 + 50_000); // 126.680
    expect(k1.ongkir.deal).toBe(400_000);
    expect(k1.ongkir.final).toBe(400_000 + 126_680); // 526.680
    expect(k1.total).toBe(840_000 + 526_680); // 1.366.680

    // 19b. Nilai barang custom diisi manual: misal 2.000.000 -> asuransi = 4.000
    const k2 = hitungPenawaran(
      {
        items: [item],
        zona: 'luar_kota',
        paket: paket10kg,
        biaya_tambahan: {
          asuransi_aktif: true,
          nilai_barang: 2_000_000,
          biaya_packing: 50_000,
        },
        perlu_pasang: false,
        segmen: 'B2C',
      },
      defaultPriceBookV1
    );
    expect(k2.ongkir.biaya_tambahan.nominal_asuransi).toBe(4_000);
    expect(k2.ongkir.biaya_tambahan.total).toBe(54_000);
    expect(k2.ongkir.final).toBe(k2.ongkir.deal + 54_000);
  });
});
