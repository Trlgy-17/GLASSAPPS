import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  getServiceClient,
  getAuthToken,
  loginAsAdmin,
  loginAsOwner,
} from './helpers';

test.describe('11. Fitur Hapus Penawaran & Periode Closing Bulanan', () => {
  const service = getServiceClient();
  let adminUid: string;
  let ownerUid: string;
  let dummyAdminUid: string;
  let activePriceBookId: string;

  test.beforeAll(async () => {
    // Ambil UID admin dan owner
    const { data: adminUser } = await service.from('users').select('id').eq('email', ADMIN_EMAIL).single();
    const { data: ownerUser } = await service.from('users').select('id').eq('email', OWNER_EMAIL).single();
    adminUid = adminUser!.id;
    ownerUid = ownerUser!.id;

    // Ambil buku harga aktif
    const { data: pb } = await service.from('price_books').select('id').eq('aktif', true).single();
    activePriceBookId = pb?.id || '00000000-0000-0000-0000-000000000001';

    // Ambil admin lain jika ada, atau buat via auth.admin
    const { data: otherAdmin } = await service
      .from('users')
      .select('id')
      .eq('peran', 'admin')
      .neq('id', adminUid)
      .limit(1)
      .maybeSingle();

    if (otherAdmin) {
      dummyAdminUid = otherAdmin.id;
    } else {
      const { data: created } = await service.auth.admin.createUser({
        email: 'putraglass.id+dummyadmin@gmail.com',
        password: 'DummyAdminPass123!',
        email_confirm: true,
      });
      dummyAdminUid = created.user!.id;
      await service.from('users').upsert({
        id: dummyAdminUid,
        email: 'putraglass.id+dummyadmin@gmail.com',
        nama: 'Admin Lain',
        peran: 'admin',
      });
    }
  });

  test('1. Kasus 403: Owner dilarang keras menghapus penawaran (read-only)', async ({ request }) => {
    const ownerToken = await getAuthToken(OWNER_EMAIL, OWNER_PASSWORD);

    // Buat penawaran tes sementara
    const { data: lead } = await service
      .from('leads')
      .insert({
        brand_id: 'putraglass',
        nama: '[TES] Klien Cek Hapus 403 Owner',
        kota: 'Bandung',
      })
      .select('id')
      .single();

    const { data: quote } = await service
      .from('penawaran')
      .insert({
        nomor: `TES-403-OWNER-${Date.now().toString().slice(-4)}`,
        lead_id: lead!.id,
        price_book_id: activePriceBookId,
        items_json: [],
        ringkasan_json: { total: 500000 },
        status: 'draf',
        valid_until: '2026-12-31',
        total_nilai: 500000,
        created_by: adminUid,
      })
      .select('id')
      .single();

    const res = await request.delete('/api/penawaran', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      data: {
        id: quote!.id,
        alasan: 'Demo / percobaan',
      },
    });

    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Owner tidak diizinkan menghapus penawaran');

    // Bersihkan
    await service.from('penawaran').delete().eq('id', quote!.id);
    await service.from('leads').delete().eq('id', lead!.id);
  });

  test('2. Kasus 403: Admin dilarang menghapus penawaran milik admin lain', async ({ request }) => {
    const adminToken = await getAuthToken(ADMIN_EMAIL, ADMIN_PASSWORD);

    // Buat penawaran milik dummy admin
    const { data: lead } = await service
      .from('leads')
      .insert({
        brand_id: 'putraglass',
        nama: '[TES] Klien Admin Lain',
        kota: 'Surabaya',
      })
      .select('id')
      .single();

    const { data: quote } = await service
      .from('penawaran')
      .insert({
        nomor: `TES-403-OTHER-${Date.now().toString().slice(-4)}`,
        lead_id: lead!.id,
        price_book_id: activePriceBookId,
        items_json: [],
        ringkasan_json: { total: 750000 },
        status: 'terkirim',
        valid_until: '2026-12-31',
        total_nilai: 750000,
        created_by: dummyAdminUid,
      })
      .select('id')
      .single();

    const res = await request.delete('/api/penawaran', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        id: quote!.id,
        alasan: 'Salah input',
      },
    });

    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('hanya dapat menghapus penawaran milik sendiri');

    // Bersihkan
    await service.from('penawaran').delete().eq('id', quote!.id);
    await service.from('leads').delete().eq('id', lead!.id);
  });

  test('3. Kasus 403: Admin dilarang menghapus penawaran yang sudah Deal', async ({ request }) => {
    const adminToken = await getAuthToken(ADMIN_EMAIL, ADMIN_PASSWORD);

    const { data: lead } = await service
      .from('leads')
      .insert({
        brand_id: 'putraglass',
        nama: '[TES] Klien Sudah Deal',
        kota: 'Jakarta',
      })
      .select('id')
      .single();

    const { data: quote } = await service
      .from('penawaran')
      .insert({
        nomor: `TES-DEAL-LOCK-${Date.now().toString().slice(-4)}`,
        lead_id: lead!.id,
        price_book_id: activePriceBookId,
        items_json: [],
        ringkasan_json: { total: 1200000 },
        status: 'deal',
        deal_at: new Date().toISOString(),
        valid_until: '2026-12-31',
        total_nilai: 1200000,
        created_by: adminUid,
      })
      .select('id')
      .single();

    const res = await request.delete('/api/penawaran', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        id: quote!.id,
        alasan: 'Demo / percobaan',
      },
    });

    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('tidak dapat dihapus');

    // Bersihkan
    await service.from('penawaran').delete().eq('id', quote!.id);
    await service.from('leads').delete().eq('id', lead!.id);
  });

  test('4. Kasus Sukses: Admin soft delete penawaran miliknya sendiri via UI', async ({ page }) => {
    const quoteNomor = `TES-DEL-OK-${Date.now().toString().slice(-5)}`;

    const { data: lead } = await service
      .from('leads')
      .insert({
        brand_id: 'putraglass',
        nama: '[TES] Klien Siap Hapus',
        kota: 'Semarang',
      })
      .select('id')
      .single();

    const { data: quote } = await service
      .from('penawaran')
      .insert({
        nomor: quoteNomor,
        lead_id: lead!.id,
        price_book_id: activePriceBookId,
        items_json: [],
        ringkasan_json: { total: 950000 },
        status: 'terkirim',
        valid_until: '2026-12-31',
        total_nilai: 950000,
        created_by: adminUid,
      })
      .select('id')
      .single();

    await loginAsAdmin(page);
    await page.goto('/penawaran?include_test=true&periode=all');

    // Cari penawaran di tabel
    await page.waitForSelector('#input-cari-penawaran', { timeout: 15000 });
    const inputSearch = page.locator('#input-cari-penawaran');
    await inputSearch.fill(quoteNomor);
    await page.waitForTimeout(600);

    const btnHapus = page.locator(`button[data-testid="btn-hapus-${quoteNomor}"]`);
    await expect(btnHapus).toBeVisible({ timeout: 15000 });
    await btnHapus.click();

    // Modal konfirmasi harus muncul
    await expect(page.locator('text=Konfirmasi Hapus Penawaran')).toBeVisible();
    await expect(page.locator(`strong:has-text("${quoteNomor}")`)).toBeVisible();

    // Pilih alasan "Demo / percobaan"
    await page.click('button:has-text("Demo / percobaan")');
    await page.fill('textarea[placeholder*="nomor kontak salah"]', 'Catatan pengujian e2e automated');

    // Klik tombol konfirmasi hapus
    await page.click('#btn-confirm-delete');
    // Verifikasi penawaran hilang dari daftar admin
    await expect(page.locator('#table-daftar-penawaran').getByText(quoteNomor)).toHaveCount(0, { timeout: 10000 });

    // Verifikasi di database: baris MASIH ADA (Soft Delete)
    const { data: dbRow } = await service.from('penawaran').select('*').eq('id', quote!.id).single();
    expect(dbRow).not.toBeNull();
    expect(dbRow!.deleted_at).not.toBeNull();
    expect(dbRow!.deleted_by).toBe(adminUid);
    expect(dbRow!.delete_reason).toContain('Demo / percobaan');

    // Verifikasi audit log tercatat
    const { data: auditRow } = await service
      .from('audit_log')
      .select('*')
      .eq('aksi', 'HAPUS_PENAWARAN')
      .eq('objek', quoteNomor)
      .maybeSingle();

    expect(auditRow).not.toBeNull();

    // Bersihkan
    await service.from('audit_log').delete().eq('objek', quoteNomor);
    await service.from('penawaran_status_log').delete().eq('penawaran_id', quote!.id);
    await service.from('penawaran').delete().eq('id', quote!.id);
    await service.from('leads').delete().eq('id', lead!.id);
  });

  test('5. Interaksi UI: Filter Periode Closing & Kartu Perlu Follow-Up', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran');

    // 1. Verifikasi 5 kartu metrik ada di halaman
    await expect(page.locator('span:has-text("Terkirim")').first()).toBeVisible();
    await expect(page.locator('span:has-text("Deal")').first()).toBeVisible();
    await expect(page.locator('span:has-text("Nilai Deal")')).toBeVisible();
    await expect(page.locator('span:has-text("Closing Rate")')).toBeVisible();

    const cardFollowup = page.locator('#card-perlu-followup');
    await expect(cardFollowup).toBeVisible();

    // 2. Klik kartu Perlu Follow-Up -> memfilter tabel
    await cardFollowup.click();
    await expect(page.locator('text=Filter aktif')).toBeVisible();
    await expect(page.locator('text=Lepas filter follow-up')).toBeVisible();

    // Lepas filter
    await page.click('text=Lepas filter follow-up');
    await expect(page.locator('text=Filter aktif')).toHaveCount(0);

    // 3. Dropdown periode closing
    const selectPeriode = page.locator('#select-periode');
    await expect(selectPeriode).toBeVisible();
    await selectPeriode.selectOption('all');
    await expect(selectPeriode).toHaveValue('all');
  });
});
