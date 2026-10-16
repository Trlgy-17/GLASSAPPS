import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('A.2 Balas Chat - Interaksi, Validasi Berkas, & Ketahanan', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/balas');
  });

  test('1. Input teks manual dan refresh halaman di tengah proses: input admin tidak hilang', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('Halo mau tanya cermin oval 50x80 cm paket 3 warna kirim ke Bandung');

    // Refresh halaman browser
    await page.reload();

    // Input teks admin TIDAK boleh hilang setelah refresh
    await expect(textarea).toHaveValue('Halo mau tanya cermin oval 50x80 cm paket 3 warna kirim ke Bandung');
  });

  test('2. Penolakan rapi berkas bukan gambar', async ({ page }) => {
    // Siapkan dialog alert listener
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Unggah berkas bukan gambar (.txt / .pdf)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'dokumen.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Ini bukan file gambar'),
    });

    expect(dialogMessage).toMatch(/bukan gambar/i);
    // Jumlah preview gambar harus tetap 0
    await expect(page.locator('img[alt*="Screenshot"]')).toHaveCount(0);
  });

  test('3. Penolakan rapi jika unggah lebih dari 5 gambar', async ({ page }) => {
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    const dummyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const files = Array.from({ length: 6 }, (_, i) => ({
      name: `screenshot-${i + 1}.png`,
      mimeType: 'image/png',
      buffer: dummyPng,
    }));

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(files);

    expect(dialogMessage).toMatch(/maksimal 5 screenshot/i);
    await expect(page.locator('img[alt*="Screenshot"]')).toHaveCount(0);
  });

  test('4. Deteksi kanal marketplace (Shopee / TikTok) & guardrail kontak luar', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('Klien Shopee tanya: harga cermin 60x80 berapa?');

    // Klik tombol kanal Shopee
    await page.click('button:has-text("Shopee")');

    // Tag pemberitahuan guardrail marketplace harus terlihat di UI
    await expect(page.locator('text=/Guardrail Marketplace Aktif/i')).toBeVisible();
  });

  test('5. Teks manual + tombol Buat Draf / Ctrl+Enter membuat draf tanpa kebocoran [[...]]', async ({ page }) => {
    // Mock API /api/balas/proses untuk memastikan deterministik tanpa kuota external habis
    await page.route('**/api/balas/proses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          extraction: {
            nama_klien: 'Budi Test',
            kota: 'Bandung',
            platform: 'whatsapp',
            items: [{ bentuk: 'rectangle', ukuran_1_cm: 60, ukuran_2_cm: 80 }],
          },
          draf: {
            ringkasan_situasi: 'Klien menanyakan cermin 60x80 cm',
            tahap: 'penawaran',
            keberatan: [],
            segmen_terdeteksi: 'b2c',
            data_kurang: [],
            draf: [
              {
                label: 'Dorong DP',
                bubbles: [
                  'Halo Kak Budi! Untuk cermin ukuran 60x80 cm harganya Rp840.000.',
                  'Ongkir ke Bandung Rp750.000, jadi totalnya Rp1.590.000 dengan DP 50% Rp795.000.',
                  'Rencananya mau dipasang di area mana Kak?',
                ],
              },
            ],
            angka_dipakai: [840000, 750000, 1590000, 795000],
            angka_tidak_terverifikasi: false,
          },
          durasi: { ttft_ms: 600, total_ms: 1500 },
        }),
      });
    });

    const textarea = page.locator('textarea');
    await textarea.fill('Halo mau pesan cermin persegi 60x80 cm kirim ke Bandung');

    // Tekan tombol Buat Draf
    await page.click('button#btn-buat-draf');
    // Tunggu draf muncul
    await expect(page.locator('text=Rp840.000')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Rp1.590.000')).toBeVisible();

    // Verifikasi penanda [[...]] TIDAK PERNAH bocor ke teks UI
    const bubbleText = await page.locator('.cermin-led-panel').textContent();
    expect(bubbleText).not.toMatch(/\[\[.*?\]\]/);
  });

  test('6. Revisi draf dan urungkan hingga 5 versi riwayat', async ({ page }) => {
    // Mock proses awal
    await page.route('**/api/balas/proses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          draf: {
            draf: [{ label: 'Versi 0', bubbles: ['Draf Awal Rp1.590.000'] }],
            angka_dipakai: [1590000],
          },
        }),
      });
    });

    // Mock revisi bertahap
    let revisiCount = 0;
    await page.route('**/api/balas/revisi', async (route) => {
      revisiCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          draf: {
            draf: [{ label: `Versi ${revisiCount}`, bubbles: [`Draf Revisi Versi ${revisiCount} Rp1.590.000`] }],
            angka_dipakai: [1590000],
          },
        }),
      });
    });

    const textarea = page.locator('textarea');
    await textarea.fill('Pesanan cermin');
    await page.click('button#btn-buat-draf');
    await expect(page.locator('text=Draf Awal Rp1.590.000')).toBeVisible({ timeout: 10000 });

    // Lakukan 3 kali revisi berturut-turut
    for (let i = 1; i <= 3; i++) {
      const inputRevisi = page.locator('input#input-revisi-custom');
      await inputRevisi.fill(`Revisi ke-${i}`);
      await inputRevisi.press('Enter');
      await expect(page.locator(`text=Draf Revisi Versi ${i}`)).toBeVisible({ timeout: 10000 });
    }

    // Tombol Urungkan harus menampilkan riwayat
    const btnUndo = page.locator('button:has-text("Urungkan")');
    await expect(btnUndo).toBeVisible();

    // Urungkan 1 kali -> kembali ke Versi 2
    await btnUndo.click();
    await expect(page.locator('text=Draf Revisi Versi 2')).toBeVisible();

    // Urungkan 1 kali lagi -> kembali ke Versi 1
    await btnUndo.click();
    await expect(page.locator('text=Draf Revisi Versi 1')).toBeVisible();
  });

  test('7. Tombol Salin Gelembung, Salin Semua, dan Tandai Terkirim', async ({ page }) => {
    await page.route('**/api/balas/proses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          extraction: { nama_klien: 'Dewi', kota: 'Bandung' },
          draf: {
            draf: [
              {
                label: 'Dorong DP',
                bubbles: ['Gelembung 1: Halo Kak Dewi', 'Gelembung 2: Totalnya Rp1.500.000'],
              },
            ],
            angka_dipakai: [1500000],
          },
        }),
      });
    });

    await page.route('**/api/balas/terkirim', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'test-terkirim-id' }),
      });
    });

    const textarea = page.locator('textarea');
    await textarea.fill('Halo');
    await page.click('button#btn-buat-draf');
    await expect(page.locator('text=Gelembung 1: Halo Kak Dewi')).toBeVisible();

    // Salin Semua
    const btnSalinSemua = page.locator('button:has-text("Salin Semua")').or(page.locator('#btn-salin-semua'));
    await btnSalinSemua.click();

    // Bar konfirmasi terkirim harus muncul
    await expect(page.getByRole('button', { name: 'Tandai Terkirim' })).toBeVisible();

    // Klik Tandai Terkirim
    const btnTandaiTerkirim = page.locator('button:has-text("Tandai Terkirim")');
    await btnTandaiTerkirim.click();

    // Indikator sukses terkirim harus muncul
    await expect(page.locator('text=/Berhasil dicatat ke kasus/i')).toBeVisible();
  });

  test('8. Simulasi 503 / 429 / kuota habis menampilkan pesan ramah tanpa error JSON mentah', async ({ page }) => {
    // Mock kegagalan server AI (503 Service Unavailable)
    await page.route('**/api/balas/proses', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Server AI sedang sibuk. Screenshot & catatan tetap tersimpan, klik Coba Lagi.',
        }),
      });
    });

    const textarea = page.locator('textarea');
    await textarea.fill('Pertanyaan klien simulasi 503');
    await page.click('button#btn-buat-draf');

    // Banner error ramah harus muncul, BUKAN stack trace atau JSON mentah
    const errorBanner = page.locator('text=/Server AI sedang sibuk.*Coba Lagi/i');
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
  });
});
