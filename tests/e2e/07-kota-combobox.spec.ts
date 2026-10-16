import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Fitur Kota Tujuan Kemendagri & Combobox Zona Otomatis', () => {
  test('Ketik kota -> pilih dari saran -> zona dan ongkir otomatis berubah -> total ikut berubah', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');

    await page.waitForSelector('#label-total-penawaran');

    // 1. Awalnya default kota adalah Surabaya (Luar Kota: Rp1.300.000)
    const selectZona = page.locator('#select-zona-pengiriman');
    await expect(selectZona).toHaveValue('luar_kota');

    const totalAwal = await page.locator('#label-total-penawaran').innerText();

    // 2. Klik/Ketik di CityCombobox: ketik "cimahi"
    const inputKota = page.locator('input[role="combobox"]');
    await inputKota.click();
    await inputKota.fill('cimahi');

    // Tunggu dropdown listbox muncul
    const listbox = page.locator('div[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5000 });

    // Pilih opsi "Kota Cimahi"
    const opsiCimahi = listbox.locator('li[role="option"]').filter({ hasText: 'Kota Cimahi' });
    await expect(opsiCimahi).toBeVisible();
    await opsiCimahi.click();

    // 3. Verifikasi otomatis berubah jadi Dalam Kota (Bandung Raya: Rp750.000)
    await expect(selectZona).toHaveValue('dalam_kota');
    await expect(inputKota).toHaveValue('Kota Cimahi');

    // Tombol "Ambil sendiri di workshop (Rp0)" harus muncul di mode dalam kota
    const btnAmbilWorkshop = page.locator('button', { hasText: 'Ambil sendiri di workshop' });
    await expect(btnAmbilWorkshop).toBeVisible();

    // Verifikasi total berubah (berkurang karena ongkir turun dari 1.3jt ke 750rb)
    const totalSetelahCimahi = await page.locator('#label-total-penawaran').innerText();
    expect(totalSetelahCimahi).not.toBe(totalAwal);

    // 4. Klik "Ambil sendiri di workshop (Rp0)" -> total berubah lagi
    await btnAmbilWorkshop.click();
    const totalWorkshop = await page.locator('#label-total-penawaran').innerText();
    expect(totalWorkshop).not.toBe(totalSetelahCimahi);

    // 5. Ganti ke kota luar: ketik "jayapura"
    await inputKota.click();
    await inputKota.fill('jayapura');
    await expect(listbox).toBeVisible();

    const opsiJayapura = listbox.locator('li[role="option"]').filter({ hasText: 'Kota Jayapura' });
    await expect(opsiJayapura).toBeVisible();
    await opsiJayapura.click();

    // Verifikasi otomatis kembali ke Luar Kota
    await expect(selectZona).toHaveValue('luar_kota');
    await expect(btnAmbilWorkshop).toHaveCount(0); // Tombol ambil workshop hilang untuk luar kota
  });

  test('Kota fiktif / tidak dikenal memunculkan opsi custom dan peringatan ongkir manual', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');

    const inputKota = page.locator('input[role="combobox"]');
    await inputKota.click();
    await inputKota.fill('Kota Atlantis Fiktif');

    const listbox = page.locator('div[role="listbox"]');
    await expect(listbox).toBeVisible();

    // Opsi Pakai custom harus ada
    const opsiCustom = listbox.locator('div[role="option"]').filter({ hasText: 'Kota Atlantis Fiktif' });
    await expect(opsiCustom).toBeVisible();
    await opsiCustom.click();

    await expect(inputKota).toHaveValue('Kota Atlantis Fiktif');
    // Muncul keterangan "Kota tidak dikenal di master Kemendagri"
    await expect(page.locator('text=Kota tidak dikenal di master Kemendagri')).toBeVisible();
  });
});
