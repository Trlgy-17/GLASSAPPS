import { test, expect } from '@playwright/test';
import { hitungPenawaran } from '@/lib/pricing/pricing';
import { defaultPriceBookV1 } from '@/lib/pricing/default-price-book';
import { PenawaranInput, PriceBookData } from '@/types/pricing';
import { loginAsAdmin } from './helpers';

test.describe('A.4 Kalkulator Penawaran - 20 Kombinasi Rumus & Input Ekstrim', () => {
  // 20 Kombinasi Determinir Perhitungan Manual Rumus pricing.ts
  const KOMBINASI_20: Array<{
    nama: string;
    input: PenawaranInput;
    expectedTotal: number;
    expectedDp: number;
    expectedPelunasan: number;
    expectedHargaCermin: number;
    isSku: boolean;
  }> = [
    // 1. SKU 30x45 No-SB TC (530k) + Ongkir Bandung (750k) = 1.280.000
    {
      nama: '1. SKU 30x45 No-SB TC',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 450, lebar_mm: 300, lampu: '3_warna', kontrol: 'touchscreen', qty: 1 }],
      },
      expectedTotal: 1_280_000,
      expectedDp: 640_000,
      expectedPelunasan: 640_000,
      expectedHargaCermin: 530_000,
      isSku: true,
    },
    // 2. SKU 30x45 SB TC (570k) < Minimum Custom Rp650.000 (tidak boleh dinaikkan)
    {
      nama: '2. SKU 30x45 SB TC di bawah 650k',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 450, lebar_mm: 300, lampu: '3_warna', kontrol: 'touchscreen', sandblast: { pakai: true }, qty: 1 }],
      },
      expectedTotal: 1_320_000,
      expectedDp: 660_000,
      expectedPelunasan: 660_000,
      expectedHargaCermin: 570_000,
      isSku: true,
    },
    // 3. Custom ukuran kecil 30x30 cm (0.09 m2 * 1.750.000 = 157.500 -> dibulatkan 160.000 -> WAJIB minimum custom 650.000)
    {
      nama: '3. Custom kecil terkena harga minimum Rp650.000',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 300, lebar_mm: 300, lampu: '3_warna', kontrol: 'touchscreen', qty: 1 }],
      },
      expectedTotal: 650_000 + 750_000,
      expectedDp: 700_000,
      expectedPelunasan: 700_000,
      expectedHargaCermin: 650_000,
      isSku: false,
    },
    // 4. SKU 40x60 SB TC (650k)
    {
      nama: '4. SKU 40x60 SB TC',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 400, lampu: '3_warna', kontrol: 'touchscreen', sandblast: { pakai: true }, qty: 1 }],
      },
      expectedTotal: 650_000 + 750_000,
      expectedDp: 700_000,
      expectedPelunasan: 700_000,
      expectedHargaCermin: 650_000,
      isSku: true,
    },
    // 5. SKU 40x60 SB ST (Sensor Tangan 755k)
    {
      nama: '5. SKU 40x60 SB ST',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 400, lampu: '3_warna', kontrol: 'sensor', sandblast: { pakai: true }, qty: 1 }],
      },
      expectedTotal: 755_000 + 750_000,
      expectedDp: 753_000,
      expectedPelunasan: 752_000,
      expectedHargaCermin: 755_000,
      isSku: true,
    },
    // 6. SKU 40x60 SB BT (Baterai Type-C 850k)
    {
      nama: '6. SKU 40x60 SB BT',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 400, lampu: '3_warna', kontrol: 'baterai', sandblast: { pakai: true }, qty: 1 }],
      },
      expectedTotal: 850_000 + 750_000,
      expectedDp: 800_000,
      expectedPelunasan: 800_000,
      expectedHargaCermin: 850_000,
      isSku: true,
    },
    // 7. SKU 50x80 SB TC (765k) + Luar Kota (1.300k)
    {
      nama: '7. SKU 50x80 SB TC Luar Kota',
      input: {
        segmen: 'B2C',
        zona: 'luar_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 800, lebar_mm: 500, lampu: '3_warna', kontrol: 'touchscreen', sandblast: { pakai: true }, qty: 1 }],
      },
      expectedTotal: 765_000 + 1_300_000,
      expectedDp: 1_033_000,
      expectedPelunasan: 1_032_000,
      expectedHargaCermin: 765_000,
      isSku: true,
    },
    // 8. Custom 60x80 cm Premium (0.48 m2 * 1.750.000 = 840.000)
    {
      nama: '8. Custom 60x80 cm Premium',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'touchscreen', qty: 1 }],
      },
      expectedTotal: 840_000 + 750_000,
      expectedDp: 795_000,
      expectedPelunasan: 795_000,
      expectedHargaCermin: 840_000,
      isSku: false,
    },
    // 9. Custom 60x80 cm + Antifog (+200k) = 1.040.000
    {
      nama: '9. Custom 60x80 cm + Antifog',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'touchscreen', antifog: true, qty: 1 }],
      },
      expectedTotal: 1_040_000 + 750_000,
      expectedDp: 895_000,
      expectedPelunasan: 895_000,
      expectedHargaCermin: 840_000,
      isSku: false,
    },
    // 10. Custom 60x80 cm + Frame Aluminium (+400k) = 1.240.000
    {
      nama: '10. Custom 60x80 cm + Frame Aluminium',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'touchscreen', frame: 'aluminium', qty: 1 }],
      },
      expectedTotal: 1_240_000 + 750_000,
      expectedDp: 995_000,
      expectedPelunasan: 995_000,
      expectedHargaCermin: 840_000,
      isSku: false,
    },
    // 11. Custom 60x80 cm + Frame HPL (+200k) = 1.040.000
    {
      nama: '11. Custom 60x80 cm + Frame HPL',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'touchscreen', frame: 'hpl', qty: 1 }],
      },
      expectedTotal: 1_040_000 + 750_000,
      expectedDp: 895_000,
      expectedPelunasan: 895_000,
      expectedHargaCermin: 840_000,
      isSku: false,
    },
    // 12. Custom 60x80 cm + Sensor Tangan Baterai (+250k) = 1.090.000
    {
      nama: '12. Custom 60x80 cm + Sensor Baterai',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'sensor_baterai', qty: 1 }],
      },
      expectedTotal: 1_090_000 + 750_000,
      expectedDp: 920_000,
      expectedPelunasan: 920_000,
      expectedHargaCermin: 840_000,
      isSku: false,
    },
    // 13. Custom Basic 1 Warna 60x80 cm (0.48 * 1.550.000 = 744.000 -> dibulatkan 5000: 745.000)
    {
      nama: '13. Custom Basic 1 Warna 60x80 cm',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '1_warna', kontrol: 'touchscreen', qty: 1 }],
      },
      expectedTotal: 745_000 + 750_000,
      expectedDp: 748_000,
      expectedPelunasan: 747_000,
      expectedHargaCermin: 745_000,
      isSku: false,
    },
    // 14. Custom Basic Saklar 60x80 cm (745.000)
    {
      nama: '14. Custom Basic Saklar 60x80 cm',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'saklar', qty: 1 }],
      },
      expectedTotal: 745_000 + 750_000,
      expectedDp: 748_000,
      expectedPelunasan: 747_000,
      expectedHargaCermin: 745_000,
      isSku: false,
    },
    // 15. Kuantitas 2 unit 60x80 cm (840.000 * 2 = 1.680.000)
    {
      nama: '15. Kuantitas 2 Unit 60x80 cm',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'touchscreen', qty: 2 }],
      },
      expectedTotal: 1_680_000 + 750_000,
      expectedDp: 1_215_000,
      expectedPelunasan: 1_215_000,
      expectedHargaCermin: 840_000,
      isSku: false,
    },
    // 16. Ongkir Deal Dibagi 2 (Rp375.000) dengan konfirmasi owner
    {
      nama: '16. Ongkir Bandung Dibagi 2 (375k) Wajib Alasan Admin',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: false,
        ongkir_deal: 375_000,
        alasan_potongan_ongkir: 'Promo langganan',
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'touchscreen', qty: 1 }],
      },
      expectedTotal: 840_000 + 375_000,
      expectedDp: 608_000,
      expectedPelunasan: 607_000,
      expectedHargaCermin: 840_000,
      isSku: false,
    },
    // 17. Termasuk Pemasangan Dalam Kota (+800k)
    {
      nama: '17. Pemasangan Dalam Kota (+800k)',
      input: {
        segmen: 'B2C',
        zona: 'dalam_kota',
        perlu_pasang: true,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'touchscreen', qty: 1 }],
      },
      expectedTotal: 840_000 + 750_000 + 800_000,
      expectedDp: 1_195_000,
      expectedPelunasan: 1_195_000,
      expectedHargaCermin: 840_000,
      isSku: false,
    },
    // 18. Pemasangan Luar Kota (+1.300k) + Ongkir Luar Kota (1.300k)
    {
      nama: '18. Pemasangan dan Ongkir Luar Kota',
      input: {
        segmen: 'B2C',
        zona: 'luar_kota',
        perlu_pasang: true,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'touchscreen', qty: 1 }],
      },
      expectedTotal: 840_000 + 1_300_000 + 1_300_000,
      expectedDp: 1_720_000,
      expectedPelunasan: 1_720_000,
      expectedHargaCermin: 840_000,
      isSku: false,
    },
    // 19. B2B Tier Default (1.750.000/m2)
    {
      nama: '19. B2B Default Rate',
      input: {
        segmen: 'B2B',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'touchscreen', qty: 1 }],
      },
      expectedTotal: 840_000 + 750_000,
      expectedDp: 795_000,
      expectedPelunasan: 795_000,
      expectedHargaCermin: 840_000,
      isSku: false,
    },
    // 20. B2B Tier Volume (Tabel Tingkat >= 5 Unit: 1.600.000/m2 -> 0.48 * 1.600.000 = 768.000 -> 770.000 * 5 = 3.850.000)
    {
      nama: '20. B2B Tier Volume 5 Unit',
      input: {
        segmen: 'B2B',
        zona: 'dalam_kota',
        perlu_pasang: false,
        items: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, lampu: '3_warna', kontrol: 'touchscreen', qty: 5 }],
      },
      expectedTotal: (770_000 * 5) + 750_000,
      expectedDp: 2_300_000,
      expectedPelunasan: 2_300_000,
      expectedHargaCermin: 770_000,
      isSku: false,
    },
  ];

  const priceBookWithB2BTier: PriceBookData = {
    ...defaultPriceBookV1,
    tingkat_b2b: [
      { min_unit: 5, max_unit: 10, tarif_m2: 1_600_000, wewenang: 'admin' },
    ],
  };

  for (const { nama, input, expectedTotal, expectedDp, expectedPelunasan, expectedHargaCermin, isSku } of KOMBINASI_20) {
    test(`Pencocokan Rumus: ${nama}`, () => {
      const pb = nama.includes('B2B Tier Volume') ? priceBookWithB2BTier : defaultPriceBookV1;
      const calc = hitungPenawaran(input, pb);

      expect(calc.items[0].is_sku).toBe(isSku);
      expect(calc.items[0].harga_cermin).toBe(expectedHargaCermin);
      expect(calc.total).toBe(expectedTotal);
      expect(calc.dp_50).toBe(expectedDp);
      expect(calc.pelunasan).toBe(expectedPelunasan);
    });
  }

  test('Uji Ketahanan Input UI: desimal "60,5", 0, huruf, dan negatif di halaman /penawaran/baru', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');

    // Beralih ke Mode Custom Ukuran
    await page.click('button:has-text("Custom Ukuran")');

    const inputPanjang = page.locator('#input-panjang-0');
    const inputLebar = page.locator('#input-lebar-0');
    const labelTotal = page.locator('#label-total-penawaran');

    // 1. Masukkan desimal dengan koma "60,5"
    await inputPanjang.fill('60,5');
    await inputLebar.fill('80');
    // Total HARUS tetap tampil dan tidak melempar error "Gagal menghitung"
    await expect(labelTotal).toBeVisible();
    await expect(labelTotal).not.toHaveText(/gagal|NaN/i);

    // 2. Masukkan angka 0 atau huruf
    await inputPanjang.fill('0');
    await expect(labelTotal).toBeVisible();
    await expect(labelTotal).not.toHaveText(/gagal|NaN/i);

    await inputPanjang.fill('abc');
    await expect(labelTotal).toBeVisible();

    // 3. Masukkan angka negatif
    await inputPanjang.fill('-100');
    await expect(labelTotal).toBeVisible();
  });

  test('Uji UI: Ongkir dibagi 2 (Rp650.000) boleh oleh admin tanpa izin owner, wajib isi alasan potongan', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');
    // Pilih zona luar kota terlebih dahulu
    await page.locator('#select-zona-pengiriman').selectOption('luar_kota');

    const inputOngkirDeal = page.locator('#input-ongkir-deal');
    // Masukkan ongkir deal di bawah list (misal Rp650.000 / dibagi 2 luar kota)
    await inputOngkirDeal.fill('650000');
    await inputOngkirDeal.blur();

    // Checkbox konfirmasi owner ongkir HARUS TIDAK ADA (dihapus sesuai aturan baru)
    const checkKonfirmasi = page.locator('#check-konfirmasi-ongkir');
    await expect(checkKonfirmasi).toHaveCount(0);

    // Field alasan potongan ongkir wajib muncul
    const inputAlasan = page.locator('#input-alasan-ongkir');
    await expect(inputAlasan).toBeVisible();

    // Tombol Unduh PDF harus nonaktif jika belum ada alasan
    const btnDownload = page.locator('#btn-download-pdf');
    await expect(btnDownload).toBeDisabled();

    // Isi alasan potongan ongkir
    await inputAlasan.fill('Bagi dua pengiriman luar kota disetujui admin');

    // Tombol Unduh PDF harus menjadi aktif
    await expect(btnDownload).toBeEnabled();

    // Uji penolakan di bawah 50%: masukkan Rp600.000
    await inputOngkirDeal.fill('600000');
    await page.click('#label-total-penawaran');
    const pesanDitolak = page.locator('#error-ongkir-ditolak');
    await expect(pesanDitolak).toBeVisible({ timeout: 5000 });
    await expect(pesanDitolak).toContainText('Ongkir maksimal dibagi dua, klien bayar minimal Rp650.000.');
  });
});
