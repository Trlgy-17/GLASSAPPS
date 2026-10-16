import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  loginAsAdmin,
  loginAsOwner,
} from './helpers';

test.describe('A.1 Autentikasi & Otorisasi Pengguna', () => {
  test('1. Password salah memunculkan pesan error di halaman login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', 'PasswordSalah123!');
    await page.click('button[type="submit"]');

    // Pesan error harus muncul di UI
    const errorEl = page.locator('text=/invalid login credentials|salah/i');
    await expect(errorEl).toBeVisible({ timeout: 10000 });
  });

  test('2. Akun ADMIN diarahkan ke /balas setelah login berhasil', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/balas/, { timeout: 15000 });
    // Verifikasi navbar menampilkan elemen admin
    await expect(page.getByRole('link', { name: 'Balas Chat' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kalkulator' })).toBeVisible();
  });

  test('3. Akun OWNER diarahkan ke /dasbor setelah login berhasil', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', OWNER_EMAIL);
    await page.fill('#password', OWNER_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dasbor/, { timeout: 15000 });
    // Verifikasi navbar menampilkan elemen owner
    await expect(page.getByRole('link', { name: 'Dasbor' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Penawaran' })).toBeVisible();
  });

  test('4. Logout mengarahkan pengguna kembali ke halaman /login', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/balas/);

    // Klik tombol logout di pojok kanan atas
    const logoutBtn = page.locator('button[title="Keluar"]').or(page.locator('button:has-text("Keluar")'));
    await logoutBtn.click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('5. Sesi tidak ada / kadaluwarsa saat membuka halaman admin dialihkan ke /login', async ({ page, context }) => {
    // Bersihkan seluruh cookies / storage sesi
    await context.clearCookies();
    await page.goto('/balas');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    await page.goto('/penawaran/baru');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    await page.goto('/dasbor');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
