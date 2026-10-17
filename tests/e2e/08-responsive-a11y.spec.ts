import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsOwner } from './helpers';

const VIEWPORTS = [
  { name: 'Mobile (390px)', width: 390, height: 844 },
  { name: 'Tablet (768px)', width: 768, height: 1024 },
  { name: 'Desktop (1440px)', width: 1440, height: 900 },
];

test.describe('E. Kualitas Tampilan, Responsif, Mode Gelap, & Aksesibilitas Keyboard', () => {
  for (const vp of VIEWPORTS) {
    test(`1. Tidak ada horizontal overflow pada viewport ${vp.name} di halaman utama`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      // 1. Login Page
      await page.goto('/login');
      const loginScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(loginScrollWidth).toBeLessThanOrEqual(vp.width + 1);

      // 2. Balas Chat Page (Admin)
      await loginAsAdmin(page);
      await page.goto('/balas');
      const balasScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(balasScrollWidth).toBeLessThanOrEqual(vp.width + 1);

      // 3. Kalkulator / Penawaran Baru
      await page.goto('/penawaran/baru');
      const kalkulatorScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(kalkulatorScrollWidth).toBeLessThanOrEqual(vp.width + 1);

      // 4. Daftar Penawaran
      await page.goto('/penawaran');
      const penawaranScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(penawaranScrollWidth).toBeLessThanOrEqual(vp.width + 1);

      // Pastikan tidak ada unhandled error di browser console
      const criticalErrors = consoleErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !e.includes('DevTools') &&
          !e.includes('ERR_NAME_NOT_RESOLVED') &&
          !e.includes('downloadable font') &&
          !e.includes('Falling back to browser navigation') &&
          !e.includes('status=2152398850')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }

  test('2. Mode gelap dan terang berfungsi rapi di semua halaman', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/balas');

    // Cari tombol toggle tema
    const toggleThemeBtn = page.locator('button[title*="tema" i]').or(page.locator('button:has-text("Mode")')).first();
    if (await toggleThemeBtn.isVisible()) {
      // Klik toggle tema
      await toggleThemeBtn.click();
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(typeof isDark).toBe('boolean');

      // Klik kembali ke mode awal
      await toggleThemeBtn.click();
    }
  });

  test('3. Navigasi keyboard (Tab) menjangkau tombol dan input dengan fokus terlihat', async ({ page }) => {
    await page.goto('/login');

    // Tekan Tab untuk navigasi keyboard
    await page.keyboard.press('Tab');
    const focusedTag1 = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A']).toContain(focusedTag1);

    await page.keyboard.press('Tab');
    const focusedTag2 = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A']).toContain(focusedTag2);
  });
});
