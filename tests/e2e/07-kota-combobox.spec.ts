import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('REVISI DROPDOWN KOTA BERTINGKAT: Provinsi -> Kota & Kabupaten', () => {
  test('1. Klik panah -> 38 provinsi (Jawa Barat paling atas) -> klik Jawa Barat -> Kota & Kabupaten -> kembali -> pilih Kota Cimahi', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');
    await page.waitForSelector('#label-total-penawaran');

    // Klik tombol panah saat field kosong
    const btnToggle = page.locator('#btn-toggle-city-dropdown');
    await btnToggle.click();

    const listbox = page.locator('div[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5000 });

    // 1. Verifikasi 38 provinsi tampil dan Jawa Barat paling atas
    const provRows = listbox.locator('[data-testid="provinsi-row"]');
    await expect(provRows).toHaveCount(38);
    await expect(provRows.first()).toContainText('Jawa Barat');
    await expect(provRows.first()).toContainText('27 daerah');

    // 2. Klik Jawa Barat -> masuk ke daftar Kota dan Kabupaten di Jawa Barat
    await provRows.first().click();

    const btnBack = listbox.locator('#btn-kembali-semua-provinsi');
    await expect(btnBack).toBeVisible();
    await expect(btnBack).toContainText('Semua provinsi');
    await expect(btnBack).toContainText('Jawa Barat');

    // Verifikasi judul grup "Kota" dan "Kabupaten"
    await expect(listbox.locator('[data-testid="group-header-kota"]')).toBeVisible();
    await expect(listbox.locator('[data-testid="group-header-kabupaten"]')).toBeVisible();

    // Verifikasi isi Kota Bandung, Kota Cimahi, Kab. Bandung, Kab. Bandung Barat
    await expect(listbox.locator('div[role="option"]', { hasText: 'Kota Bandung' })).toBeVisible();
    await expect(listbox.locator('div[role="option"]', { hasText: 'Kota Cimahi' })).toBeVisible();
    await expect(listbox.locator('div[role="option"]', { hasText: 'Kab. Bandung Barat' })).toBeVisible();

    // 3. Klik "← Semua provinsi" -> kembali ke daftar 38 provinsi
    await btnBack.click();
    await expect(listbox.locator('[data-testid="provinsi-row"]')).toHaveCount(38);

    // 4. Masuk lagi ke Jawa Barat -> pilih Kota Cimahi -> zona otomatis Dalam kota
    await listbox.locator('[data-testid="provinsi-row"]').first().click();
    await listbox.locator('div[role="option"]', { hasText: 'Kota Cimahi' }).click();

    // Dropdown tertutup, input berisi Kota Cimahi, dan zona otomatis Dalam kota
    await expect(listbox).toHaveCount(0);
    await expect(page.locator('input[role="combobox"]')).toHaveValue('Kota Cimahi');
    await expect(page.locator('#select-zona-pengiriman')).toHaveValue('dalam_kota');
  });

  test('2. Ketik "sura" -> Kota Surabaya & Kota Surakarta langsung muncul (format "Kota Surabaya — Jawa Timur") tanpa opsi "Pakai"', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');

    const inputKota = page.locator('input[role="combobox"]');
    await inputKota.click();
    await inputKota.fill('sura');

    const listbox = page.locator('div[role="listbox"]');
    await expect(listbox).toBeVisible();

    // Pastikan Kota Surabaya — Jawa Timur dan Kota Surakarta — Jawa Tengah muncul
    const optSurabaya = listbox.locator('div[role="option"]', { hasText: 'Kota Surabaya' });
    await expect(optSurabaya).toBeVisible();
    await expect(optSurabaya).toContainText('Jawa Timur');

    const optSurakarta = listbox.locator('div[role="option"]', { hasText: 'Kota Surakarta' });
    await expect(optSurakarta).toBeVisible();
    await expect(optSurakarta).toContainText('Jawa Tengah');

    // Karena ada kota yang cocok, opsi '+ Pakai' TIDAK BOLEH muncul
    const customOption = listbox.locator('#option-custom-city');
    await expect(customOption).toHaveCount(0);

    // Uji ketik nama provinsi "jawa timur" -> muncul baris provinsi Jawa Timur
    await inputKota.fill('jawa timur');
    const provOpt = listbox.locator('[data-testid="provinsi-option"]', { hasText: 'Jawa Timur' });
    await expect(provOpt).toBeVisible();
    await provOpt.click();

    // Klik provinsi hasil cari langsung membuka daftar kota di Jawa Timur
    await expect(listbox.locator('#btn-kembali-semua-provinsi')).toContainText('Jawa Timur');
    await expect(listbox.locator('div[role="option"]', { hasText: 'Kota Surabaya' })).toBeVisible();
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

    // Verifikasi zona otomatis default ke Luar Kota
    const selectZona = page.locator('#select-zona-pengiriman');
    await expect(selectZona).toHaveValue('luar_kota');

    // Masukkan nama klien
    const inputNama = page.locator('#input-nama-klien');
    await inputNama.fill('Ibu Siti Sukamaju');

    // Klik tombol Buat Penawaran PDF
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('#btn-download-pdf').click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Navigasi ke daftar penawaran (/penawaran) untuk memastikan nama kota 'Desa Sukamaju' tampil
    await page.goto('/penawaran');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('table', { hasText: 'Desa Sukamaju' })).toBeVisible();
    await expect(page.locator('table', { hasText: 'Ibu Siti Sukamaju' })).toBeVisible();
  });
});
