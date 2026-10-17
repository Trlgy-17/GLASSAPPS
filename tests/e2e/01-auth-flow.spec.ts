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
  test('1. Validasi keamanan kolom login: type=password, autocomplete, toggle mata, dan pesan ramah Indonesia', async ({ page }) => {
    await page.goto('/login');

    // Verifikasi Bug 2: input password type="password" saat dibuka
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');

    // Verifikasi email autocomplete
    const emailInput = page.locator('#email');
    await expect(emailInput).toHaveAttribute('autocomplete', 'username');

    // Verifikasi tombol mata show/hide password dengan aria-label
    const eyeBtn = page.locator('button[aria-label="Tampilkan password"]');
    await expect(eyeBtn).toBeVisible();
    await eyeBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    const hideEyeBtn = page.locator('button[aria-label="Sembunyikan password"]');
    await expect(hideEyeBtn).toBeVisible();
    await hideEyeBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Verifikasi Bug 4: Tidak ada keterangan peran yang tidak sesuai
    await expect(page.locator('text=Hak akses:')).toHaveCount(0);

    // Verifikasi Bug 3: Pesan error bahasa Indonesia yang jelas saat password salah
    await emailInput.fill(ADMIN_EMAIL);
    await passwordInput.fill('PasswordSalah123!');
    await page.click('button[type="submit"]');

    const errorEl = page.locator('.bg-warn-bg');
    await expect(errorEl).toBeVisible({ timeout: 10000 });
    await expect(errorEl).toContainText('Email atau password salah.');
  });

  test('2. Akun ADMIN diarahkan ke /balas setelah login berhasil', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/balas/, { timeout: 15000 });
    // Verifikasi navigasi admin
    await expect(page.locator('a[href="/balas"]:visible')).toBeVisible();
    await expect(page.locator('a[href="/penawaran/baru"]:visible')).toBeVisible();
  });

  test('3. Akun OWNER diarahkan ke /dasbor setelah login berhasil', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', OWNER_EMAIL);
    await page.fill('#password', OWNER_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dasbor/, { timeout: 15000 });
    // Verifikasi halaman dasbor owner
    await expect(page.locator('text=Dasbor Owner')).toBeVisible();
    await expect(page.locator('a[href="/dasbor"]:visible')).toBeVisible();
  });

  test('4. Logout mengarahkan pengguna kembali ke halaman /login', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/balas/);

    // Klik tombol logout di pojok kanan atas
    // Klik tombol logout
    const logoutBtn = page.locator('button[aria-label="Keluar dari aplikasi"]:visible, button[title="Keluar"]:visible').first();
    await expect(logoutBtn).toBeVisible({ timeout: 10000 });
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
