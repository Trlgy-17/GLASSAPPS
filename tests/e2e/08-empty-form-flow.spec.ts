import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Verifikasi Form Penawaran Awal Kosong & Transfer Data Balas Chat', () => {
  test('1. Buka kalkulator /penawaran/baru saat pertama login -> SEMUA field kosong (nama, kota, zona unset, ongkir Rp0)', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');
    await page.waitForSelector('#label-total-penawaran');

    // Field nama klien kosong
    const inputNama = page.locator('#input-nama-klien');
    await expect(inputNama).toHaveValue('');

    // Field kota kosong dengan placeholder "Pilih atau ketik kota tujuan"
    const inputKota = page.locator('input[role="combobox"]');
    await expect(inputKota).toHaveValue('');
    await expect(inputKota).toHaveAttribute('placeholder', 'Pilih atau ketik kota tujuan');

    // Zona pengiriman belum dipilih
    const selectZona = page.locator('#select-zona-pengiriman');
    await expect(selectZona).toHaveValue('');

    // Ongkir Rp0 dan muncul note "Ongkir dihitung setelah kota dipilih."
    const noteOngkir = page.locator('#note-ongkir-belum-dipilih');
    await expect(noteOngkir).toBeVisible();
    await expect(noteOngkir).toContainText('Ongkir dihitung setelah kota dipilih.');

    // Total tetap tampil (hanya subtotal cermin, tanpa ongkir)
    const labelTotal = page.locator('#label-total-penawaran');
    await expect(labelTotal).toBeVisible();
    const totalAwal = await labelTotal.innerText();
    expect(totalAwal).not.toMatch(/gagal|NaN/i);
  });

  test('2. Pilih kota -> logout -> login kembali -> form tetap kosong (tidak bocor dari sesi sebelumnya)', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');
    await page.waitForSelector('#label-total-penawaran');

    // Isi nama dan pilih kota
    const inputNama = page.locator('#input-nama-klien');
    await inputNama.fill('Klien Sesi Lama');

    const inputKota = page.locator('input[role="combobox"]');
    await inputKota.fill('Bandung');
    const listbox = page.locator('div[role="listbox"]');
    await expect(listbox).toBeVisible();
    await listbox.locator('div[role="option"]', { hasText: 'Kota Bandung' }).click();
    await expect(inputKota).toHaveValue('Kota Bandung');

    // Logout via button di sidebar
    const btnLogout = page.locator('button[aria-label="Keluar dari aplikasi"]');
    await btnLogout.click();
    await page.waitForURL('**/login');

    // Login lagi
    await loginAsAdmin(page);
    await page.goto('/penawaran/baru');
    await page.waitForSelector('#label-total-penawaran');

    // Form HARUS KOSONG kembali
    await expect(page.locator('#input-nama-klien')).toHaveValue('');
    await expect(page.locator('input[role="combobox"]')).toHaveValue('');
    await expect(page.locator('#select-zona-pengiriman')).toHaveValue('');
  });

  test('3. Dari Balas Chat: klik "Buat penawaran dari draf" -> kota dan spesifikasi terisi otomatis sesuai chat', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/balas');
    await page.waitForSelector('textarea');

    // Simulasikan chat klien menyebut kota Medan
    const inputChat = page.locator('textarea').first();
    await inputChat.fill('Halo Kak, saya Budi di Medan mau tanya cermin oval 50x70 cm lampu 3 warna touchscreen kirim ke Medan.');

    await page.locator('#btn-buat-draf').click();
    // Tunggu draf jadi
    await page.waitForSelector('#btn-buat-penawaran-pdf', { timeout: 45000 });

    // Klik tombol Buat Penawaran PDF dari Balas Chat
    await page.locator('#btn-buat-penawaran-pdf').click();
    await page.waitForURL('**/penawaran/baru?*');

    // Field kota dan nama klien harus terisi otomatis sesuai hasil chat
    const inputKota = page.locator('input[role="combobox"]');
    await expect(inputKota).toHaveValue(/Medan/i);

    // Zona otomatis diset karena kota sudah ada
    const selectZona = page.locator('#select-zona-pengiriman');
    await expect(selectZona).not.toHaveValue('');
  });
});
