import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  getServiceClient,
  loginAsAdmin,
} from './helpers';

test.describe('12. Proteksi Klik Ganda & Optimasi Respons Layar', () => {
  const service = getServiceClient();

  test('Klik ganda pada tombol simpan draf hanya menyimpan 1 penawaran di database', async ({ page }) => {
    const testClientName = `[TES] DoubleClick ${Date.now()}`;

    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');
    await page.waitForSelector('#label-total-penawaran');

    // Beralih ke Custom Ukuran agar kalkulasi valid
    await page.click('button:has-text("Custom Ukuran")');
    await page.waitForTimeout(300);

    // Isi nama klien
    const inputNama = page.locator('#input-nama-klien');
    await inputNama.fill(testClientName);

    // Pilih kota via CityCombobox
    const inputKota = page.locator('input[role="combobox"]');
    await inputKota.click();
    await inputKota.fill('Bandung');
    await page.locator('[role="option"]:has-text("Kota Bandung")').first().click();
    await page.waitForTimeout(300);

    const btnSimpan = page.locator('#btn-simpan-penawaran');
    await expect(btnSimpan).toBeEnabled();
    // Lakukan klik ganda secara cepat pada level DOM
    await page.evaluate(() => {
      const btn = document.getElementById('btn-simpan-penawaran') as HTMLButtonElement | null;
      btn?.click();
      btn?.click();
    });
    await expect(page.locator('text=berhasil disimpan')).toBeVisible({ timeout: 15000 });

    // Verifikasi di database: hanya ada tepat 1 penawaran tersimpan dengan nama klien tersebut
    const { data: matchedQuotes } = await service
      .from('penawaran')
      .select('id, nomor, lead_id, leads!inner(nama)')
      .ilike('leads.nama', `%${testClientName}%`);

    expect(matchedQuotes).not.toBeNull();
    expect(matchedQuotes!.length).toBe(1);

    // Bersihkan data uji
    for (const q of matchedQuotes || []) {
      await service.from('penawaran_status_log').delete().eq('penawaran_id', q.id);
      await service.from('audit_log').delete().eq('objek', q.nomor);
      await service.from('penawaran').delete().eq('id', q.id);
      await service.from('leads').delete().eq('id', q.lead_id);
    }
  });
});
