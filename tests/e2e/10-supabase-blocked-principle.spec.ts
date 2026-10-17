import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, OWNER_EMAIL, OWNER_PASSWORD, loginAsAdmin, loginAsOwner, cleanupAllTestData } from './helpers';

test.describe('Prinsip Browser Bebas Supabase: Semua Akses Lewat Domain Sendiri', () => {
  let interceptedSupabaseRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    interceptedSupabaseRequests = [];
    // Blokir mutlak seluruh request browser ke domain supabase.co
    await page.route('**/*.supabase.co/**', (route) => {
      interceptedSupabaseRequests.push(route.request().url());
      return route.abort('blockedbyclient');
    });
  });

  test.afterAll(async () => {
    await cleanupAllTestData();
  });

  test('1. Login Admin & Owner berhasil 100% tanpa menyentuh domain supabase.co', async ({ page }) => {
    // A. Login Admin
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/balas/, { timeout: 15000 });

    // B. Logout
    const logoutBtn = page.locator('button[aria-label="Keluar dari aplikasi"]:visible, button[title="Keluar"]:visible').first();
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // C. Login Owner
    await page.fill('#email', OWNER_EMAIL);
    await page.fill('#password', OWNER_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dasbor/, { timeout: 15000 });
    await expect(page.locator('text=Dasbor Owner')).toBeVisible();

    // Verifikasi bahwa browser tidak mengirim request ke supabase.co
    expect(interceptedSupabaseRequests).toHaveLength(0);
  });

  test('2. Balas Chat, Kalkulator, Simpan Penawaran jalan normal tanpa supabase.co', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/balas/);

    // Balas Chat
    const textarea = page.locator('textarea');
    await textarea.fill('Halo mau tanya harga cermin custom oval');
    await expect(page.locator('#btn-buat-draf')).toBeEnabled();

    // Kalkulator
    await page.goto('/penawaran/baru');
    await page.waitForSelector('h1:has-text("Kalkulator Penawaran")');
    await page.fill('#input-nama-klien', '[TES] Klien Bebas Supabase');
    await page.locator('#select-zona-pengiriman').selectOption('dalam_kota');

    const btnSimpan = page.locator('#btn-simpan-penawaran:visible');
    await expect(btnSimpan).toBeEnabled({ timeout: 10000 });
    await btnSimpan.click();

    // Verifikasi notifikasi berhasil tersimpan
    await expect(page.locator('text=/berhasil disimpan/i')).toBeVisible({ timeout: 15000 });
    expect(interceptedSupabaseRequests).toHaveLength(0);
  });

  test('3. Klik "Lihat PDF" & "Unduh PDF": Respon 200, Content-Type application/pdf, langsung dari domain aplikasi sendiri', async ({
    page,
    request,
  }) => {
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/balas/);

    // Buat penawaran baru
    await page.goto('/penawaran/baru');
    await page.fill('#input-nama-klien', '[TES] Klien Test PDF Endpoint');
    await page.locator('#select-zona-pengiriman').selectOption('dalam_kota');

    const btnSimpan = page.locator('#btn-simpan-penawaran:visible');
    await expect(btnSimpan).toBeEnabled({ timeout: 10000 });
    await btnSimpan.click();

    // Tunggu notifikasi dan link PDF muncul
    await expect(page.locator('text=/berhasil disimpan/i')).toBeVisible({ timeout: 15000 });

    const btnLihatPdf = page.locator('a:has-text("Lihat PDF")');
    await expect(btnLihatPdf).toBeVisible();

    const pdfViewHref = await btnLihatPdf.getAttribute('href');
    expect(pdfViewHref).toMatch(/^\/api\/penawaran\/[a-f0-9-]+\/pdf$/);

    // Uji fetch langsung ke endpoint Lihat PDF (Harus 200, Content-Type: application/pdf, Disposition: inline)
    const resLihat = await page.request.get(pdfViewHref!);
    expect(resLihat.status()).toBe(200);
    expect(resLihat.headers()['content-type']).toContain('application/pdf');
    expect(resLihat.headers()['content-disposition']).toContain('inline');

    // Uji fetch endpoint Unduh PDF (Harus 200, Content-Type: application/pdf, Disposition: attachment)
    const resUnduh = await page.request.get(`${pdfViewHref}?download=true`);
    expect(resUnduh.status()).toBe(200);
    expect(resUnduh.headers()['content-type']).toContain('application/pdf');
    expect(resUnduh.headers()['content-disposition']).toContain('attachment');

    // Buka daftar penawaran dan pastikan tombol PDF di tabel juga memakai endpoint lokal
    await page.goto('/penawaran');
    await page.waitForSelector('h1:has-text("Daftar Penawaran")');
    await page.waitForTimeout(1000);
    const tablePdfLinks = page.locator('a[href*="/pdf"]');
    if ((await tablePdfLinks.count()) > 0) {
      const firstHref = await tablePdfLinks.first().getAttribute('href');
      expect(firstHref).toMatch(/^\/api\/penawaran\/[a-f0-9-]+\/pdf$/);
    }

    expect(interceptedSupabaseRequests).toHaveLength(0);
  });

  test('4. Halaman Pengaturan & Dasbor Owner beroperasi 100% tanpa akses supabase.co dari browser', async ({ page }) => {
    // A. Pengaturan (Admin)
    await loginAsAdmin(page);
    await page.goto('/pengaturan/buku-harga');
    await expect(page.locator('h1:has-text("Pengaturan")')).toBeVisible({ timeout: 15000 });

    // B. Dasbor (Owner)
    const logoutBtn = page.locator('button[aria-label="Keluar dari aplikasi"]:visible, button[title="Keluar"]:visible').first();
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    await loginAsOwner(page);
    await expect(page.locator('text=Dasbor Owner')).toBeVisible({ timeout: 15000 });

    // Verifikasi total request browser ke supabase.co tetap 0
    expect(interceptedSupabaseRequests).toHaveLength(0);
  });
});
