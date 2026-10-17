import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsOwner, cleanupAllTestData } from './helpers';

test.describe('E. MATRIX DEVICE AUDIT - Responsivitas, Touch Targets & Fungsionalitas', () => {
  test.afterAll(async () => {
    await cleanupAllTestData();
  });

  test('1. Halaman Login: Bebas scroll horizontal & tombol minimal 44px', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('text=Putra Glass');

    // Cek tidak ada scroll horizontal
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Cek tombol submit minimal 44px
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    const box = await submitBtn.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('2. Halaman Balas Chat: Bebas scroll horizontal, tombol Kirim terjangkau & upload screenshot berfungsi', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/balas');
    await page.waitForSelector('h1:has-text("Balas Chat")');
    // Cek tidak ada scroll horizontal
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Cek tombol Buat Draf minimal 40px
    const btnKirim = page.locator('#btn-buat-draf');
    await expect(btnKirim).toBeVisible();
    const boxKirim = await btnKirim.boundingBox();
    expect(boxKirim?.height).toBeGreaterThanOrEqual(40);

    // Cek input teks
    const textarea = page.locator('textarea');
    await textarea.fill('Halo kak tanya harga cermin custom');
    await expect(textarea).toHaveValue('Halo kak tanya harga cermin custom');

    // Buat dummy 1x1 png image untuk uji upload
    const dummyPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(dummyPngBase64, 'base64');

    await page.setInputFiles('input[type="file"]', {
      name: 'screenshot-test.png',
      mimeType: 'image/png',
      buffer,
    });

    // Thumbnail gambar harus muncul
    await expect(page.locator('img[alt^="Screenshot 1"]')).toBeVisible({ timeout: 5000 });
  });

  test('3. Halaman Kalkulator Penawaran: Bebas scroll horizontal & download PDF berfungsi', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');
    await page.waitForSelector('h1:has-text("Kalkulator Penawaran")');
    // Cek tidak ada scroll horizontal
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Isi nama klien & alasan ongkir jika ada
    await page.fill('#input-nama-klien', '[TES] Klien Matrix Device');
    await page.locator('#select-zona-pengiriman').selectOption('dalam_kota');
    // Tombol Download PDF harus terlihat dan minimal 40px
    const btnDownload = page.locator('#btn-download-pdf:visible, #btn-download-pdf-mobile:visible').first();
    await expect(btnDownload).toBeVisible();
    const boxDownload = await btnDownload.boundingBox();
    expect(boxDownload?.height).toBeGreaterThanOrEqual(40);
    await expect(btnDownload).toBeEnabled({ timeout: 10000 });
    await btnDownload.click();
    await expect(page.locator('text=/berhasil disimpan/i')).toBeVisible({ timeout: 15000 });
  });

  test('4. Halaman Dasbor Owner: Bebas scroll horizontal di seluruh breakpoint', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/dasbor');
    await page.waitForSelector('text=Dasbor Owner');

    // Cek tidak ada scroll horizontal
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Cek judul dan komponen utama terlihat
    await expect(page.locator('text=Dasbor Owner')).toBeVisible();
  });
});
