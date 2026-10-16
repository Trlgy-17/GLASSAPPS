import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  getServiceClient,
  ADMIN_EMAIL,
  cleanupAllTestData,
} from './helpers';

test.describe('Fitur Lanjutkan Percakapan Baru: Pencocokan Otomatis 30 Hari & Cari Manual', () => {
  let testLeadId: string;
  const createdQuoteIds: string[] = [];

  test.beforeAll(async () => {
    const service = getServiceClient();

    // Ambil UID admin
    const { data: adminUser } = await service.from('users').select('id').eq('email', ADMIN_EMAIL).single();
    const adminUid = adminUser!.id;

    // Ambil price_book aktif
    const { data: pb } = await service.from('price_books').select('id').eq('aktif', true).single();
    const priceBookId = pb!.id;

    // Buat 1 lead klien lama (misal: "[TES] Hendra Wijaya")
    const { data: lead } = await service
      .from('leads')
      .insert({
        brand_id: 'putraglass',
        nama: '[TES] Hendra Wijaya',
        kota: 'Kota Surabaya',
        zona: 'luar_kota',
        segmen: 'B2C',
        status: 'prospek',
      })
      .select('id')
      .single();
    testLeadId = lead!.id;

    // Buat 2 penawaran untuk Hendra Wijaya (3 hari lalu & 5 hari lalu) untuk menguji deduplikasi "(+1 penawaran lain)"
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();

    const { data: qOld } = await service
      .from('penawaran')
      .insert({
        nomor: 'PG-Q-2610-9901',
        lead_id: testLeadId,
        price_book_id: priceBookId,
        items_json: [{ bentuk_kode: 'rectangle', panjang_mm: 600, lebar_mm: 800, qty: 1 }],
        ringkasan_json: { total: 1_900_000, dp_50: 950_000, pelunasan: 950_000, is_test: true },
        status: 'terkirim',
        kanal: 'whatsapp',
        total_nilai: 1_900_000,
        valid_until: '2026-10-30',
        created_by: adminUid,
        created_at: fiveDaysAgo,
      })
      .select('id')
      .single();
    if (qOld) createdQuoteIds.push(qOld.id);

    const { data: qLatest } = await service
      .from('penawaran')
      .insert({
        nomor: 'PG-Q-2610-9902',
        lead_id: testLeadId,
        price_book_id: priceBookId,
        items_json: [{ bentuk_kode: 'oval', panjang_mm: 600, lebar_mm: 900, qty: 1 }],
        ringkasan_json: { total: 2_140_000, dp_50: 1_070_000, pelunasan: 1_070_000, is_test: true },
        status: 'terkirim',
        kanal: 'whatsapp',
        total_nilai: 2_140_000,
        valid_until: '2026-10-30',
        created_by: adminUid,
        created_at: threeDaysAgo,
      })
      .select('id')
      .single();
    if (qLatest) createdQuoteIds.push(qLatest.id);
  });

  test.afterAll(async () => {
    const service = getServiceClient();
    if (createdQuoteIds.length > 0) {
      await service.from('penawaran_status_log').delete().in('penawaran_id', createdQuoteIds);
      await service.from('penawaran').delete().in('id', createdQuoteIds);
    }
    if (testLeadId) {
      await service.from('leads').delete().eq('id', testLeadId);
    }
    await cleanupAllTestData();
  });

  test('1. Default halaman /balas bersih (tidak ada 5 chip permanen) & Klien baru tidak memunculkan banner penawaran lama', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/balas');

    // Pastikan TIDAK ADA 5 chip permanen di bagian atas
    await expect(page.locator('text=Lanjutkan percakapan dari penawaran terakhir:')).toHaveCount(0);

    // Simulasikan respons klien baru (tidak cocok dengan database)
    await page.route('**/api/balas/proses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          extraction: { nama_klien: 'Klien Baru Zulfikar', kota: 'Kota Malang', platform: 'whatsapp' },
          draf: {
            draf: [{ label: 'Dorong DP', bubbles: ['Halo Kak Zulfikar, untuk cermin harganya *Rp840.000*.'] }],
            angka_dipakai: [840000],
          },
          matched_penawaran: null,
        }),
      });
    });

    await page.locator('textarea').first().fill('Halo saya Zulfikar di Malang mau tanya cermin.');
    await page.locator('#btn-buat-draf').click();

    await expect(page.locator('text=Halo Kak Zulfikar')).toBeVisible();
    // Banner penawaran lama TIDAK BOLEH muncul untuk klien baru
    await expect(page.locator('#banner-matched-penawaran')).toHaveCount(0);
  });

  test('2. Klien lama (nama sama) -> banner muncul -> klik "Bukan, klien baru" menghilangkan banner, atau klik "Pakai sebagai konteks" membuat ulang draf memakai angka penawaran lama', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/balas');

    // Masukkan chat dari Hendra Wijaya (klien lama yang punya penawaran PG-Q-2610-9902 Rp2.140.000)
    const textarea = page.locator('textarea').first();
    await textarea.fill('Halo Kak, saya Hendra Wijaya. Jadi ambil cermin yang kemarin ya Kak, saya mau transfer DP sekarang.');
    await page.locator('#btn-buat-draf').click();

    // Tunggu banner kecocokan penawaran muncul di atas draf
    const banner = page.locator('#banner-matched-penawaran');
    await expect(banner).toBeVisible({ timeout: 45000 });
    await expect(banner).toContainText('Klien ini pernah dapat penawaran');
    await expect(banner).toContainText('PG-Q-2610-9902');
    await expect(banner).toContainText('Rp2.140.000');
    await expect(banner).toContainText('3 hari lalu');
    await expect(banner).toContainText('(+1 penawaran lain)');

    // Klik "Pakai sebagai konteks" -> draf dibuat ulang memakai angka penawaran itu (Rp2.140.000 / DP Rp1.070.000)
    const btnPakai = page.locator('#btn-pakai-sebagai-konteks');
    await btnPakai.click();

    // Banner kecocokan berganti menjadi status Riwayat Tersambung dan draf memuat angka penawaran lama
    await expect(page.locator('text=Riwayat Tersambung')).toBeVisible({ timeout: 45000 });
    const cerminPanel = page.locator('.cermin-led-panel');
    await expect(cerminPanel).toContainText(/Rp2\.140\.000|Rp1\.070\.000/, { timeout: 45000 });
  });

  test('3. Klik "Bukan, klien baru" -> banner hilang dan draf tetap tampil', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/balas');

    // Mock respons dengan matched_penawaran
    await page.route('**/api/balas/proses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          extraction: { nama_klien: 'Hendra Wijaya', kota: 'Kota Surabaya', platform: 'whatsapp' },
          draf: {
            draf: [{ label: 'Dorong DP', bubbles: ['Halo Kak Hendra, untuk cermin 60x80 harganya *Rp840.000*.'] }],
            angka_dipakai: [840000],
          },
          matched_penawaran: {
            id: 'test-match-id',
            nomor: 'PG-Q-2610-9902',
            nama_klien: 'Hendra Wijaya',
            kota: 'Kota Surabaya',
            zona: 'luar_kota',
            segmen: 'B2C',
            total_nilai: 2140000,
            tanggal: '14 Okt',
            waktu_lalu: '3 hari lalu',
            other_quotes_count: 1,
            status: 'terkirim',
          },
        }),
      });
    });

    await page.locator('textarea').first().fill('Halo saya Hendra Wijaya tanya cermin 60x80.');
    await page.locator('#btn-buat-draf').click();

    const banner = page.locator('#banner-matched-penawaran');
    await expect(banner).toBeVisible();

    // Klik "Bukan, klien baru"
    await page.locator('#btn-bukan-klien-baru').click();

    // Banner hilang, namun draf tetap ada
    await expect(banner).toHaveCount(0);
    await expect(page.locator('text=Halo Kak Hendra, untuk cermin 60x80')).toBeVisible();
  });
});
