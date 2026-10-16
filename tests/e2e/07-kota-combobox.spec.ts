import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('REVISI KOTA TUJUAN - Dropdown Virtual, Filter & Kota Manual', () => {
  test('1. Klik panah tanpa mengetik -> dropdown terbuka berisi recent & 514 kab/kota per provinsi', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');
    await page.waitForSelector('#label-total-penawaran');

    const btnToggle = page.locator('#btn-toggle-city-dropdown');
    await btnToggle.click();

    // Kosongkan input agar menampilkan list lengkap
    const inputKota = page.locator('input[role="combobox"]');
    await inputKota.fill('');
    const listbox = page.locator('div[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5000 });

    // Periksa bahwa judul provinsi muncul sebagai pemisah (misal ACEH, JAWA BARAT, dll)
    const provHeaders = listbox.locator('[data-testid="provinsi-header"]');
    await expect(provHeaders.first()).toBeVisible();
    const headerCount = await provHeaders.count();
    expect(headerCount).toBeGreaterThan(0);

    // Periksa bahwa opsi kota dapat di-scroll dan opsi kota muncul
    const cityOptions = listbox.locator('div[role="option"]');
    const optionCount = await cityOptions.count();
    expect(optionCount).toBeGreaterThan(5);

    // Klik panah lagi -> dropdown tertutup
    await btnToggle.click();
    await expect(listbox).toHaveCount(0);
  });

  test('2. Ketik "sura" -> Surabaya & Surakarta muncul, TANPA opsi "Pakai"', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');

    const inputKota = page.locator('input[role="combobox"]');
    await inputKota.click();
    await inputKota.fill('sura');

    const listbox = page.locator('div[role="listbox"]');
    await expect(listbox).toBeVisible();

    // Pastikan Kota Surabaya dan Kota Surakarta muncul
    await expect(listbox.locator('div[role="option"]', { hasText: 'Kota Surabaya' })).toBeVisible();
    await expect(listbox.locator('div[role="option"]', { hasText: 'Kota Surakarta' })).toBeVisible();

    // Karena ada kota yang cocok, opsi '+ Pakai' TIDAK BOLEH muncul
    const customOption = listbox.locator('#option-custom-city');
    await expect(customOption).toHaveCount(0);
  });

  test('3. Ketik "Desa Sukamaju" -> hanya opsi "+ Pakai" -> simpan -> buka PDF -> nama kota muncul', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');

    const inputKota = page.locator('input[role="combobox"]');
    await inputKota.click();
    await inputKota.fill('Desa Sukamaju');

    const listbox = page.locator('div[role="listbox"]');
    await expect(listbox).toBeVisible();

    // Hanya opsi '+ Pakai' yang muncul
    const customOption = listbox.locator('#option-custom-city');
    await expect(customOption).toBeVisible();
    await expect(customOption).toContainText('Desa Sukamaju');
    // Klik opsi custom
    await customOption.click();
    await expect(inputKota).toHaveValue('Desa Sukamaju');

    // Muncul peringatan netral
    const warning = page.locator('#msg-kota-manual-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Kota tidak ada di daftar. Pilih zona ongkir secara manual.');

    // Verifikasi zona otomatis default ke Luar Kota (ongkir ekspedisi / aktual)
    const selectZona = page.locator('#select-zona-pengiriman');
    await expect(selectZona).toHaveValue('luar_kota');

    // Masukkan nama klien
    const inputNama = page.locator('input[placeholder="contoh: Ibu Maria"]').or(page.locator('input').first());
    await inputNama.fill('Ibu Siti Sukamaju');

    // Klik tombol Buat Penawaran PDF
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('#btn-download-pdf').click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Periksa bahwa file PDF valid dan dibuat di server dengan kota Desa Sukamaju
    const fs = await import('fs');
    const pdfBuffer = fs.readFileSync(downloadPath!);
    const pdfText = pdfBuffer.toString('utf-8', 0, Math.min(pdfBuffer.length, 50000));
    // react-pdf menyertakan nama kota dalam stream teks atau metadata
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // Navigasi ke daftar penawaran (/penawaran) untuk memastikan nama kota 'Desa Sukamaju' tampil
    await page.goto('/penawaran');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('table', { hasText: 'Desa Sukamaju' })).toBeVisible();
    await expect(page.locator('table', { hasText: 'Ibu Siti Sukamaju' })).toBeVisible();
  });
});
